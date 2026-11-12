use near_contract_standards::non_fungible_token::{
    core::{NonFungibleTokenCore, NonFungibleTokenResolver},
    enumeration::NonFungibleTokenEnumeration,
    events::NftMint,
    metadata::{NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC},
    NonFungibleToken, Token, TokenId,
};
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, require, AccountId, Gas, NearToken,
    PanicOnDefault, Promise, PromiseOrValue, PromiseResult,
    collections::LookupMap, json_types::U128,
};
use std::collections::HashMap;

const WEEK: u64 = 604_800_000_000_000;
const MAX_BATCH: usize = 20;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct PendingSpend { amount: u128, window: u64 }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Reward {
    pub balance: u128,
    pub weekly_limit: u128,
    pub minted_at: u64,
    pub window: u64,
    pub spent: u128,
    pub pending: Option<PendingSpend>,
}

#[near(serializers = [json])]
pub struct Recipient { pub account_id: AccountId, pub amount: U128 }

#[near(serializers = [json])]
pub struct RewardView {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub balance: U128,
    pub weekly_limit: U128,
    pub spent_this_week: U128,
    pub available: U128,
    pub resets_at: String,
    pub pending: bool,
}

#[ext_contract(ext_self)]
trait Callbacks { fn resolve_spend(&mut self, token_id: TokenId) -> bool; }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    tokens: NonFungibleToken,
    rewards: LookupMap<TokenId, Reward>,
    transfer_calls: LookupMap<TokenId, bool>,
    next_id: u64,
    collection_name: String,
    minter_id: AccountId,
    minted: bool,
}

#[near]
impl Contract {
    #[init]
    #[payable]
    pub fn new(collection_name: String, minter_id: AccountId, metadata: TokenMetadata, weekly_limit: U128, recipients: Vec<Recipient>) -> Self {
        require!(!collection_name.trim().is_empty() && collection_name.len() <= 120, "Collection name required (max 120 bytes)");
        let mut contract = Self {
            tokens: NonFungibleToken::new(b"t".to_vec(), env::current_account_id(),
                Some(b"m".to_vec()), Some(b"e".to_vec()), None::<Vec<u8>>),
            rewards: LookupMap::new(b"r".to_vec()),
            transfer_calls: LookupMap::new(b"c".to_vec()), next_id: 0,
            collection_name, minter_id, minted: false,
        };
        contract.create_airdrop(metadata, weekly_limit, recipients);
        contract
    }

    /// Permissionless, fully funded atomic airdrop. No setter, clawback or upgrade method.
    #[payable]
    pub fn create_airdrop(&mut self, metadata: TokenMetadata, weekly_limit: U128, recipients: Vec<Recipient>) -> Vec<TokenId> {
        require!(!self.minted, "Collection already minted");
        require!(env::predecessor_account_id() == self.minter_id, "Only the factory can mint this collection");
        require!(!recipients.is_empty() && recipients.len() <= MAX_BATCH, "Use 1 to 20 recipients");
        require!(weekly_limit.0 > 0, "Weekly limit must be positive");
        require!(metadata.title.as_ref().is_some_and(|s| !s.trim().is_empty() && s.len() <= 120), "Title required (max 120 bytes)");
        require!(near_sdk::serde_json::to_vec(&metadata).unwrap().len() <= 8192, "Metadata exceeds 8 KiB");
        let funding = recipients.iter().try_fold(0u128, |sum, r| {
            require!(r.amount.0 > 0, "Reward must be positive");
            sum.checked_add(r.amount.0)
        }).expect("Funding overflow");
        let before = env::storage_usage();
        let mut ids = Vec::new();
        for recipient in recipients {
            let id = self.next_id.to_string();
            self.next_id = self.next_id.checked_add(1).expect("Token overflow");
            self.tokens.internal_mint_with_refund(id.clone(), recipient.account_id.clone(), Some(metadata.clone()), None);
            self.rewards.insert(&id, &Reward {
                balance: recipient.amount.0, weekly_limit: weekly_limit.0,
                minted_at: env::block_timestamp(), window: 0, spent: 0, pending: None,
            });
            NftMint { owner_id: &recipient.account_id, token_ids: &[&id], memo: Some("Keydrop contributor reward") }.emit();
            ids.push(id);
        }
        // Include a small permanent reserve per NFT for pending state and transfer bookkeeping.
        let storage = u128::from(env::storage_usage() - before + ids.len() as u64 * 512)
            .checked_mul(env::storage_byte_cost().as_yoctonear()).expect("Storage overflow");
        let required = funding.checked_add(storage).expect("Deposit overflow");
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached >= required, format!("Attach at least {} yoctoNEAR for rewards and storage", required));
        self.minted = true;
        if attached > required { Promise::new(env::signer_account_id()).transfer(NearToken::from_yoctonear(attached - required)); }
        ids
    }

    pub fn get_reward(&self, token_id: TokenId) -> Option<RewardView> {
        let r = self.rewards.get(&token_id)?;
        let window = (env::block_timestamp() - r.minted_at) / WEEK;
        let spent = if window == r.window { r.spent } else { 0 };
        Some(RewardView {
            owner_id: self.tokens.owner_by_id.get(&token_id)?, token_id: token_id.clone(),
            balance: U128(r.balance), weekly_limit: U128(r.weekly_limit), spent_this_week: U128(spent),
            available: U128(if r.pending.is_some() || self.transfer_calls.get(&token_id).unwrap_or(false) { 0 } else { r.balance.min(r.weekly_limit.saturating_sub(spent)) }),
            resets_at: ((r.minted_at + (window + 1) * WEEK) / 1_000_000).to_string(),
            pending: r.pending.is_some() || self.transfer_calls.get(&token_id).unwrap_or(false),
        })
    }

    /// Useful to other contracts via cross-contract view. Ownership alone grants access.
    pub fn has_access(&self, account_id: AccountId) -> bool {
        self.tokens.nft_supply_for_owner(account_id).0 > 0
    }

    #[payable]
    pub fn spend(&mut self, token_id: TokenId, amount: U128, receiver_id: AccountId) -> Promise {
        assert_one_yocto();
        require!(env::prepaid_gas() >= Gas::from_tgas(30), "Attach at least 30 Tgas");
        require!(self.tokens.owner_by_id.get(&token_id) == Some(env::predecessor_account_id()), "Only current holder can spend");
        require!(receiver_id != env::current_account_id(), "Cannot pay this contract");
        self.assert_unlocked(&token_id);
        let mut r = self.rewards.get(&token_id).expect("Reward missing");
        let window = (env::block_timestamp() - r.minted_at) / WEEK;
        if window != r.window { r.window = window; r.spent = 0; }
        require!(amount.0 > 0 && amount.0 <= r.balance, "Insufficient reward balance");
        if amount.0 > r.weekly_limit.saturating_sub(r.spent) {
            env::panic_str("Weekly spending limit exceeded");
        }
        r.balance -= amount.0;
        r.spent += amount.0;
        r.pending = Some(PendingSpend { amount: amount.0, window });
        self.rewards.insert(&token_id, &r);
        Promise::new(receiver_id).transfer(NearToken::from_yoctonear(amount.0)).then(
            ext_self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(10)).resolve_spend(token_id))
    }

    #[private]
    pub fn resolve_spend(&mut self, token_id: TokenId) -> bool {
        let mut r = self.rewards.get(&token_id).expect("Reward missing");
        let pending = r.pending.take().expect("No pending spend");
        let success = matches!(env::promise_result(0), PromiseResult::Successful(_));
        if !success {
            r.balance += pending.amount;
            if r.window == pending.window { r.spent -= pending.amount; }
        }
        self.rewards.insert(&token_id, &r);
        success
    }
}

impl Contract {
    fn assert_unlocked(&self, token_id: &TokenId) {
        require!(self.rewards.get(token_id).expect("Reward missing").pending.is_none(), "Spend pending; wait for settlement");
        require!(!self.transfer_calls.get(token_id).unwrap_or(false), "Transfer call pending");
    }
}

#[near]
impl NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>) {
        self.assert_unlocked(&token_id);
        self.tokens.nft_transfer(receiver_id, token_id, approval_id, memo);
    }
    #[payable]
    fn nft_transfer_call(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>, msg: String) -> PromiseOrValue<bool> {
        self.assert_unlocked(&token_id);
        self.transfer_calls.insert(&token_id, &true);
        self.tokens.nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }
    fn nft_token(&self, token_id: TokenId) -> Option<Token> { self.tokens.nft_token(token_id) }
}

#[near]
impl NonFungibleTokenResolver for Contract {
    #[private]
    fn nft_resolve_transfer(&mut self, previous_owner_id: AccountId, receiver_id: AccountId, token_id: TokenId, approved_account_ids: Option<HashMap<AccountId, u64>>) -> bool {
        self.transfer_calls.remove(&token_id);
        self.tokens.nft_resolve_transfer(previous_owner_id, receiver_id, token_id, approved_account_ids)
    }
}

#[near]
impl NonFungibleTokenEnumeration for Contract {
    fn nft_total_supply(&self) -> U128 { self.tokens.nft_total_supply() }
    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> { self.tokens.nft_tokens(from_index, limit) }
    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 { self.tokens.nft_supply_for_owner(account_id) }
    fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> { self.tokens.nft_tokens_for_owner(account_id, from_index, limit) }
}

#[near]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata { spec: NFT_METADATA_SPEC.into(), name: self.collection_name.clone(), symbol: "KEYDROP".into(), icon: None, base_uri: None, reference: None, reference_hash: None }
    }
}

#[cfg(test)]
mod tests;
