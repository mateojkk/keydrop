use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_sdk::{
    collections::Vector, env, json_types::U128, near, require, AccountId, Gas, NearToken,
    PanicOnDefault, Promise, PromiseResult,
};
use near_sdk::serde_json::json;
use std::collections::HashSet;

const CHILD_CODE: &[u8] = include_bytes!("../../contract/target/wasm32-unknown-unknown/release/keydrop.wasm");
const CHILD_HEADROOM_BYTES: u128 = 60_000;
const REGISTRY_BUDGET_BYTES: u128 = 5_000;
const PER_TOKEN_STORAGE_BYTES: u128 = 12_000;

#[near(serializers = [json])]
pub struct Recipient { pub account_id: AccountId, pub amount: U128 }

#[near(serializers = [borsh, json])]
pub struct CollectionInfo {
    pub account_id: AccountId,
    pub name: String,
    pub creator_id: AccountId,
    pub created_at: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Factory { collections: Vector<CollectionInfo>, next_id: u64 }

#[near]
impl Factory {
    #[init]
    pub fn new() -> Self { Self { collections: Vector::new(b"l".to_vec()), next_id: 0 } }

    pub fn get_required(&self, total_funding: U128, recipient_count: u8) -> U128 {
        require!(recipient_count > 0 && recipient_count <= 20, "Use 1 to 20 recipients");
        U128(total_funding.0
            .checked_add(self.child_seed()).unwrap()
            .checked_add(self.storage_budget(recipient_count)).unwrap()
            .checked_add(self.registry_budget()).unwrap())
    }

    pub fn list_collections(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<CollectionInfo> {
        let start = from_index.unwrap_or(0).min(self.collections.len());
        let end = (start + limit.unwrap_or(50).min(100)).min(self.collections.len());
        (start..end).filter_map(|i| self.collections.get(i)).collect()
    }

    pub fn collection_count(&self) -> u64 { self.collections.len() }

    #[payable]
    pub fn create_collection(&mut self, collection_name: String, metadata: TokenMetadata,
        weekly_limit: U128, recipients: Vec<Recipient>) -> Promise {
        require!(!collection_name.trim().is_empty() && collection_name.len() <= 120,
            "Collection name required (max 120 bytes)");
        require!(metadata.title.as_ref().is_some_and(|s| !s.trim().is_empty() && s.len() <= 120),
            "Reward title required (max 120 bytes)");
        require!(near_sdk::serde_json::to_vec(&metadata).unwrap().len() <= 8192,
            "Metadata exceeds 8 KiB");
        require!(weekly_limit.0 > 0, "Weekly limit must be positive");
        require!(!recipients.is_empty() && recipients.len() <= 20, "Use 1 to 20 recipients");
        let mut seen = HashSet::new();
        let total = recipients.iter().try_fold(0u128, |sum, recipient| {
            require!(seen.insert(&recipient.account_id), "Duplicate recipient");
            require!(recipient.amount.0 > 0, "Reward must be positive");
            sum.checked_add(recipient.amount.0)
        }).expect("Funding overflow");
        let required = self.get_required(U128(total), recipients.len() as u8).0;
        require!(env::attached_deposit().as_yoctonear() >= required,
            format!("Attach at least {} yoctoNEAR", required));

        let creator_id = env::predecessor_account_id();
        let recipient_count = recipients.len() as u8;
        let child_id: AccountId = format!("c{}.{}", self.next_id, env::current_account_id()).parse().unwrap();
        self.next_id = self.next_id.checked_add(1).expect("Collection ID overflow");
        let init_args = json!({
            "collection_name": collection_name, "minter_id": env::current_account_id(),
            "metadata": metadata, "weekly_limit": weekly_limit, "recipients": recipients,
        }).to_string().into_bytes();
        let child_deposit = total + self.storage_budget(recipient_count);
        let attached_excess = env::attached_deposit().as_yoctonear() - required;
        let registry_budget = self.registry_budget() + attached_excess;
        Promise::new(child_id.clone())
            .create_account()
            .transfer(NearToken::from_yoctonear(self.child_seed()))
            .deploy_contract(CHILD_CODE.to_vec())
            .function_call("new".into(), init_args, NearToken::from_yoctonear(child_deposit), Gas::from_tgas(140))
            .then(Self::ext(env::current_account_id()).with_static_gas(Gas::from_tgas(25))
                .on_created(child_id, collection_name, creator_id, U128(registry_budget)))
    }

    #[private]
    pub fn on_created(&mut self, account_id: AccountId, name: String, creator_id: AccountId,
        registry_budget: U128) -> bool {
        if !matches!(env::promise_result(0), PromiseResult::Successful(_)) {
            Promise::new(creator_id).transfer(NearToken::from_yoctonear(registry_budget.0));
            return false;
        }
        let before = env::storage_usage();
        self.collections.push(&CollectionInfo {
            account_id, name, creator_id: creator_id.clone(),
            created_at: env::block_timestamp_ms().to_string(),
        });
        let used = u128::from(env::storage_usage() - before) * env::storage_byte_cost().as_yoctonear();
        require!(registry_budget.0 >= used, "Registry storage budget exhausted");
        if registry_budget.0 > used {
            Promise::new(creator_id).transfer(NearToken::from_yoctonear(registry_budget.0 - used));
        }
        true
    }
}

impl Factory {
    fn child_seed(&self) -> u128 {
        (CHILD_CODE.len() as u128 + CHILD_HEADROOM_BYTES) * env::storage_byte_cost().as_yoctonear()
    }
    fn registry_budget(&self) -> u128 {
        REGISTRY_BUDGET_BYTES * env::storage_byte_cost().as_yoctonear()
    }
    fn storage_budget(&self, recipients: u8) -> u128 {
        u128::from(recipients) * PER_TOKEN_STORAGE_BYTES * env::storage_byte_cost().as_yoctonear()
    }
}
