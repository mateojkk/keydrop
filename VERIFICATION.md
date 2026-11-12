# Verification status

## Source and build

- Public repository: https://github.com/mateojkk/keydrop
- [GitHub Actions run 43122049807](https://github.com/mateojkk/keydrop/actions/runs/43122049807) passed frontend checks, Rust native contract tests, and optimized WASM build. The release WASM was deployed to testnet; SHA-256: `CFF7271AB332E51562847B07CE8FA169099D88DDFF8D4C94B6F7C45F6A32B924` (469,531 bytes).
- Local `npm test` passed all three input/amount test groups; `npm run build` passed TypeScript and Vite. Headless Brave initialized Wallet Selector on testnet with `meteor-wallet` and `my-near-wallet`, opened the custom chooser, and confirmed that MyNearWallet opens `https://testnet.mynearwallet.com/login/` for `keydrop-mateo.testnet`.
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

## Remaining submission steps

- Wallet gallery indexing and an interactive wallet signature were not observed in browser automation. The on-chain transactions above were signed by ordinary account keys using NEAR CLI, and Wallet Selector module initialization was tested in browser.
- The public X post with video or screenshots and the single hackathon form submission still require the project owner to publish. The private Sites preview is not the required public X demo post.

## Repeat browser QA

Run the Vite dev server at `http://127.0.0.1:5173`, then run `node scripts/browser-qa.mjs` with `KEYDROP_BROWSER` pointing to Chromium. `KEYDROP_PLAYWRIGHT_MODULE` may point to an existing Playwright module using a `file:///` URL. On PowerShell, set those as `$env:` variables before the command. `KEYDROP_QA_URL` can override the preview URL.
