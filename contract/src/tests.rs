use super::*;
use near_sdk::{test_utils::VMContextBuilder, testing_env};

fn account(name: &str) -> AccountId { name.parse().unwrap() }
fn context(who: &str, deposit: u128, time: u64) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(account("keydrop.testnet")).predecessor_account_id(account(who))
        .signer_account_id(account(who)).attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(1000)).prepaid_gas(Gas::from_tgas(300)).block_timestamp(time);
    testing_env!(b.build());
}
fn minted() -> Contract {
    context("project.testnet", 20 * 10u128.pow(24), 1);
    let mut c = Contract::new();
    c.create_airdrop(TokenMetadata { title: Some("Contributor".into()), ..Default::default() },
        U128(3), vec![Recipient { account_id: account("alice.testnet"), amount: U128(10) }, Recipient { account_id: account("bob.testnet"), amount: U128(20) }]);
    c
}
fn settle(c: &mut Contract, success: bool) {
    let callback_time = env::block_timestamp() + 1;
    let mut b = VMContextBuilder::new();
    b.current_account_id(account("keydrop.testnet")).predecessor_account_id(account("keydrop.testnet")).block_timestamp(callback_time);
    testing_env!(b.build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(),
        vec![if success { PromiseResult::Successful(vec![]) } else { PromiseResult::Failed }]);
    assert_eq!(c.resolve_spend("0".into()), success);
}
#[test]
fn airdrop_and_successful_spend() {
    let mut c = minted();
    assert_eq!(c.nft_total_supply().0, 2);
    assert_eq!(c.get_reward("1".into()).unwrap().balance.0, 20);
    context("alice.testnet", 1, 2);
    c.spend("0".into(), U128(2), account("alice.testnet"));
    settle(&mut c, true);
    assert_eq!(c.get_reward("0".into()).unwrap().balance.0, 8);
    assert_eq!(c.get_reward("0".into()).unwrap().available.0, 1);
}
#[test]
#[should_panic(expected = "Weekly spending limit exceeded")]
fn rejects_excess() {
    let mut c = minted(); context("alice.testnet", 1, 2);
    c.spend("0".into(), U128(4), account("alice.testnet"));
}
#[test]
fn failed_payment_restores_balance_and_allowance() {
    let mut c = minted(); context("alice.testnet", 1, 2);
    c.spend("0".into(), U128(3), account("absent.testnet"));
    settle(&mut c, false);
    assert_eq!(c.get_reward("0".into()).unwrap().balance.0, 10);
    assert_eq!(c.get_reward("0".into()).unwrap().available.0, 3);
}
#[test]
fn transfer_preserves_usage_and_moves_access() {
    let mut c = minted(); context("alice.testnet", 1, 2);
    c.spend("0".into(), U128(2), account("alice.testnet")); settle(&mut c, true);
    context("alice.testnet", 1, 3);
    c.nft_transfer(account("carol.testnet"), "0".into(), None, None);
    assert!(!c.has_access(account("alice.testnet")));
    assert!(c.has_access(account("carol.testnet")));
    let r = c.get_reward("0".into()).unwrap();
    assert_eq!(r.balance.0, 8); assert_eq!(r.available.0, 1);
    context("carol.testnet", 1, WEEK + 1);
    assert_eq!(c.get_reward("0".into()).unwrap().available.0, 3);
}
#[test]
#[should_panic(expected = "Only current holder can spend")]
fn old_holder_cannot_spend() {
    let mut c = minted(); context("alice.testnet", 1, 2);
    c.nft_transfer(account("carol.testnet"), "0".into(), None, None);
    c.spend("0".into(), U128(1), account("alice.testnet"));
}
#[test]
#[should_panic(expected = "Spend pending")]
fn cannot_transfer_unsettled_funds() {
    let mut c = minted(); context("alice.testnet", 1, 2);
    c.spend("0".into(), U128(1), account("alice.testnet"));
    c.nft_transfer(account("carol.testnet"), "0".into(), None, None);
}
#[test]
#[should_panic(expected = "Attach at least")]
fn underfunding_rejected() {
    let mut c = minted(); context("project.testnet", 0, 2);
    c.create_airdrop(TokenMetadata { title: Some("Test".into()), ..Default::default() }, U128(1),
        vec![Recipient { account_id: account("carol.testnet"), amount: U128(10) }]);
}

#[test]
#[should_panic(expected = "Spend pending")]
fn cannot_start_second_unsettled_payment() {
    let mut c = minted(); context("alice.testnet", 1, 2);
    c.spend("0".into(), U128(1), account("alice.testnet"));
    c.spend("0".into(), U128(1), account("alice.testnet"));
}

#[test]
#[should_panic(expected = "Transfer call pending")]
fn receiver_cannot_spend_during_transfer_call() {
    let mut c = minted(); context("alice.testnet", 1, 2);
    c.nft_transfer_call(account("carol.testnet"), "0".into(), None, None, "".into());
    context("carol.testnet", 1, 3);
    c.spend("0".into(), U128(1), account("carol.testnet"));
}

#[test]
fn rejected_transfer_call_restores_owner_and_unlocks_reward() {
    let mut c = minted(); context("alice.testnet", 1, 2);
    c.nft_transfer_call(account("carol.testnet"), "0".into(), None, None, "".into());
    assert_eq!(c.get_reward("0".into()).unwrap().available.0, 0);
    let mut b = VMContextBuilder::new();
    b.current_account_id(account("keydrop.testnet")).predecessor_account_id(account("keydrop.testnet")).block_timestamp(3);
    testing_env!(b.build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(),
        vec![PromiseResult::Successful(b"true".to_vec())]);
    assert!(!c.nft_resolve_transfer(account("alice.testnet"), account("carol.testnet"), "0".into(), None));
    assert!(c.has_access(account("alice.testnet")));
    assert!(!c.has_access(account("carol.testnet")));
    let r = c.get_reward("0".into()).unwrap();
    assert_eq!(r.balance.0, 10); assert_eq!(r.available.0, 3); assert!(!r.pending);
}

#[test]
fn available_never_exceeds_remaining_balance() {
    let mut c = minted();
    for i in 0..3 {
        context("alice.testnet", 1, WEEK * i + 2);
        c.spend("0".into(), U128(3), account("alice.testnet"));
        settle(&mut c, true);
    }
    context("alice.testnet", 1, WEEK * 3 + 2);
    let r = c.get_reward("0".into()).unwrap();
    assert_eq!(r.balance.0, 1); assert_eq!(r.available.0, 1);
}
