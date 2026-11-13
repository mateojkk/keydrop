# Verification status

The current judge checks are `npm run format:check`, `npm test`, `node scripts/verify-global-code.mjs`, and `npm run build`; GitHub Actions also runs Rust tests and WASM builds for both contracts. [README.md](README.md) lists the expected results and live read-only check. The sections below preserve the transaction evidence from the deployed testnet versions.

## Lower-cost shared-code deployment (current factory)

- [GitHub Actions run 43304128725](https://github.com/mateojkk/keydrop/actions/runs/43304128725) passed frontend checks, child tests/build, factory tests/build, including the new quote test. The factory source pins the SHA-256 of [keydrop-global.wasm](artifacts/keydrop-global.wasm), which is the same child code already exercised by the first two testnet collections.
- [Global code publication](https://explorer.testnet.near.org/transactions/DB85fEgYocn7s6emUNZCYBePDVw6rRygkUAV5hAFMtBc) published child hash `BF521C30B4A9D4909C956E8FB4A88BF0A8B95F92A6351EB01BC6DFB264802D1B` once. Keydrop paid 47.7418 testnet NEAR for this shared infrastructure. [Factory upgrade](https://explorer.testnet.near.org/transactions/A2Vvzx4ijiFmYqDRb7CgRA3K8bRceoTVTgF6AvVijPQi) preserved its existing two-collection registry.
- Live `get_required` now returns **0.37032 NEAR upfront** for one 0.1 NEAR reward, versus 5.64381 NEAR before shared code. Its 0.12 NEAR per-token storage allowance and 0.05 NEAR registry allowance refund unused amounts; the small collection state reserve remains in the child.
- [Low-cost collection creation](https://explorer.testnet.near.org/transactions/GLUg36a8MMo1tCV6JkppJhSaAnoRHwrx4nDqtR9JwELq) minted token 0 directly to Bob at `c2.keydrop.testnet`. `nft_metadata().name` returned **Shared Code Thanks**. The account reported global code by hash, 1.2 KB total storage, and zero access keys.
- Bob [spent 0.02 NEAR](https://explorer.testnet.near.org/transactions/9d7mcizxfxah8dmmVP42g2w3HmFwqA1KUZRV41Lb38oW). A subsequent [0.04 NEAR attempt](https://explorer.testnet.near.org/transactions/GeHovmYcRr5Gm1QB7FJ7fXGTBYcSYT1RrRSnyiGGeXzo) failed over the remaining 0.03 NEAR weekly allowance. Bob then transferred the NFT to Alice; final on-chain reads returned 0.08 NEAR balance, 0.03 NEAR available, Bob access `false`, and Alice access `true`.

## Earlier per-collection-code deployment

- [GitHub Actions run 43267576070](https://github.com/mateojkk/keydrop/actions/runs/43267576070) passed the frontend build and tests, native child contract tests, child WASM build, and factory WASM build. The exact CI artifacts deployed were 477,381-byte child WASM (SHA-256 `BF521C30B4A9D4909C956E8FB4A88BF0A8B95F92A6351EB01BC6DFB264802D1B`) and 801,483-byte factory WASM (SHA-256 `4FEFF3DFE2B9C79BFAF432C1E660AAF9BF64893739700E54DD172356D3724B64`).
- [Factory deployment](https://explorer.testnet.near.org/transactions/9Nai7x9WMPhHS1nwpJmR3bo1WgLdbBG6iKM9zvDCNnku) initialized `keydrop.testnet`. Its on-chain `get_required` quoted 5.64381 NEAR for one 0.1 NEAR recipient and 5.86381 NEAR for two 0.1 NEAR recipients.
- [First collection creation](https://explorer.testnet.near.org/transactions/GMgagv4RGQaLSJK8RVhmDjRrJvX38h3q5TJRit9JSW8Q) made `c0.keydrop.testnet`. `nft_metadata().name` returned **Builder Collective**; token 0 was minted to Alice. Its access-key list was empty.
- [Successful spend](https://explorer.testnet.near.org/transactions/EQjzpcnwbqZBA6xQauPhyhhVFd3rmiWWQkztawLkmzJN) paid 0.02 NEAR to Alice. The token balance became 0.08 NEAR and weekly available amount 0.03 NEAR. A [0.04 NEAR request](https://explorer.testnet.near.org/transactions/5589uoUyZGLTtrQV3qVYfDZRzm2SCdiLQEPARoZwXZw4) failed because it exceeded the remaining weekly allowance.
- [Transfer](https://explorer.testnet.near.org/transactions/HJMMMHYRaZfvsEqnR8Le7nTAFH7pnoKkGLZCU4NPRDDY) moved token 0 to Carol. Final RPC reads returned Alice access `false`, Carol access `true`, balance 0.08 NEAR, available 0.03 NEAR.
- A second factory call created `c1.keydrop.testnet` with the distinct collection name **Open Source Thank You**. Its two tokens went directly to Alice and Bob. The factory's on-chain collection count is 2. This verifies that collection names are independent per airdrop, not a shared factory label.

The factory key remains available; child accounts have no access keys.

## Source and build

- Public repository: https://github.com/mateojkk/keydrop
- [GitHub Actions run 43122049807](https://github.com/mateojkk/keydrop/actions/runs/43122049807) passed frontend checks, Rust native contract tests, and optimized WASM build. The release WASM was deployed to testnet; SHA-256: `CFF7271AB332E51562847B07CE8FA169099D88DDFF8D4C94B6F7C45F6A32B924` (469,531 bytes).
- Headless Brave initialized Wallet Selector on testnet with `meteor-wallet` and `my-near-wallet`, opened the custom chooser, and confirmed that MyNearWallet opens `https://testnet.mynearwallet.com/login/` for `keydrop-mateo.testnet`.
- `scripts/browser-qa.mjs` passed desktop (1440px) and mobile (390px) flows: standalone landing page, direct `/create` and `/rewards` routes, browser back/forward, the Meteor/MyNearWallet chooser, image upload and compact WebP, live preview, exact funding total, review dialog, duplicate rejection, empty recipient state, and no uncaught runtime errors or mobile overflow. On mobile, the form appears before the preview. UI screenshots and the result are in `artifacts/`.

## Real testnet transactions

Contract: [`keydrop-mateo.testnet`](https://testnet.nearblocks.io/address/keydrop-mateo.testnet). Project sender: `keydrop-project-mateo.testnet`. Each account below is a regular NEAR testnet account with its own signing key.

| Step | Transaction | Observed final state |
| --- | --- | --- |
| Deploy and initialize | [3SQNDLWvcW8ECZriu9PydYgYnK5McqmZLzNVaidjw6qL](https://testnet.nearblocks.io/txns/3SQNDLWvcW8ECZriu9PydYgYnK5McqmZLzNVaidjw6qL) | NEP-171 metadata and zero initial supply returned. |
| Airdrop two funded NFTs | [HHKbQTiwLqa3ZdUu5c8nkqZ6bWVKYVuPW9fdfqLtgJJH](https://testnet.nearblocks.io/txns/HHKbQTiwLqa3ZdUu5c8nkqZ6bWVKYVuPW9fdfqLtgJJH) | Token 0 to Alice, token 1 to Bob. Each had 1 NEAR reward balance and 0.4 NEAR weekly limit. Supply became 2. |
| Alice spends 0.2 NEAR | [6uo7jYJ2XHLppPWmwGWondVzSYVuvBSuhzfsrwdtJ6TL](https://testnet.nearblocks.io/txns/6uo7jYJ2XHLppPWmwGWondVzSYVuvBSuhzfsrwdtJ6TL) | Payout callback returned success. Token 0 balance became 0.8; weekly available became 0.2. |
| Alice requests 0.25 NEAR more | [BCCa1E49K3EA3pqdEda2d6VctKmvdEQNVGoJ9Z38wZAo](https://testnet.nearblocks.io/txns/BCCa1E49K3EA3pqdEda2d6VctKmvdEQNVGoJ9Z38wZAo) | Transaction failed in the contract; balance remained 0.8 and weekly available remained 0.2. The CLI reports the WASM trap as generic `unreachable`, so the on-chain state is the definitive check. |
| Redeploy final code | [GJtnq85CfBoUKyvDj2RXwY4vpTFKghVwmJdc9pr6KLys](https://testnet.nearblocks.io/txns/GJtnq85CfBoUKyvDj2RXwY4vpTFKghVwmJdc9pr6KLys) | Preserved existing NFT state. Code hash `EzoyeDzFwdAu274y82C2ZLJHhTAx4BQB5igXrNcndEAw`. |
| Alice transfers token 0 to Carol | [5mCiak1TCsYbrCidFqLws8eQR9Lsy6wzfayBAVsmeVLy](https://testnet.nearblocks.io/txns/5mCiak1TCsYbrCidFqLws8eQR9Lsy6wzfayBAVsmeVLy) | Carol owns token 0 with 0.8 NEAR remaining and 0.2 NEAR available this week. Carol has access; Alice has none. Bob still owns token 1 and has access. |

The final full-access deployment key was removed in [transaction 3G6GVhVMNDWEjrDhST6pVRZJLNt69EVfMdBda7PfpQ7E](https://testnet.nearblocks.io/txns/3G6GVhVMNDWEjrDhST6pVRZJLNt69EVfMdBda7PfpQ7E). A fresh final-state `view_access_key_list` RPC query returned an empty list, preventing code replacement by an account signer. The contract has no admin method that can change a token's funded balance or weekly limit. [README.md](README.md) includes commands for a fresh deployment and independently querying the public contract.

## Browser verification scope

- Wallet gallery indexing and an interactive wallet signature were not observed in browser automation. The on-chain transactions above were signed by ordinary account keys using NEAR CLI, and Wallet Selector module initialization was tested in browser.
- The public frontend is [keydrop-one.vercel.app](https://keydrop-one.vercel.app/). The on-chain transactions above provide reproducible behavior beyond the browser automation.

## Repeat browser QA

Run the Vite dev server at `http://127.0.0.1:5173`, then run `node scripts/browser-qa.mjs` with `KEYDROP_BROWSER` pointing to Chromium. `KEYDROP_PLAYWRIGHT_MODULE` may point to an existing Playwright module using a `file:///` URL. On PowerShell, set those as `$env:` variables before the command. `KEYDROP_QA_URL` can override the preview URL.
