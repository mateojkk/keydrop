# Keydrop

Contributor Reward NFTs built for **NEAR HACKATHON 2026**, track **NFTs That Do Something** (`nfts`). Projects fund an NFT for each contributor. Its current holder can withdraw NEAR up to an immutable weekly limit, and ownership provides an on-chain access check.

## What is implemented

- Rust NEP-171 core (including transfer-and-call and resolution), NEP-177 metadata, NEP-181 enumeration, and NEP-297 NFT mint/transfer events using `near-contract-standards`.
- Permissionless atomic airdrop of 1–20 NFTs directly to ordinary NEAR accounts. Every recipient can receive a different funded amount. No claim or special recipient account.
- Per-token balances and weekly limits. Seven-day windows are **anchored at mint**, not calendar weeks. Allowance does not roll over. The remaining balance caps every payment.
- Holder-only native NEAR payments. Spending reserves balance and allowance before scheduling payment; failed payments restore both. A pending payment locks spending and transfers until its callback settles. Transfer-and-call also locks spending and transfers until resolution, including a rejected receiver call.
- Transfers preserve balance, mint timestamp, and current-window spending. Access follows NFT ownership; a holder with multiple NFTs retains access until their last NFT leaves. A fully spent NFT still grants access.
- React/TypeScript frontend with campaign metadata, artwork upload, per-recipient amounts, a funding review, Meteor and HERE testnet wallet selection, recipient balances, withdrawals, transfers, and an on-chain access check.

There are no balance/limit setters, clawbacks, admin withdrawals, or upgrade methods. The live deployment account's keys were removed after verification, so its code cannot be replaced by a signed deployment transaction.

## Live testnet deployment

- Contract: [`keydrop-mateo.testnet`](https://testnet.nearblocks.io/address/keydrop-mateo.testnet); public source: [`mateojkk/keydrop`](https://github.com/mateojkk/keydrop).
- Frontend: [Keydrop testnet app](https://keydrop-contributor-rewards.ripedulse1.chatgpt.site). This preview may require owner access until a public site is enabled; the repository can always be run locally.
- Deployed code hash: `EzoyeDzFwdAu274y82C2ZLJHhTAx4BQB5igXrNcndEAw`. The account access-key list was verified empty after deployment. See [VERIFICATION.md](VERIFICATION.md) for transactions and outcomes.

## Reproduce locally

Prerequisites: Git, Node.js 22+ / npm, Rust 1.93 or newer (use current stable), and a native C/C++ toolchain for Rust tests. On Windows, use Visual Studio Build Tools with Desktop development with C++, or a supported GNU toolchain. Linux/macOS are easiest for contract development.

```sh
npm ci
npm test
npm run build
```

PowerShell may block `npm.ps1`; use `npm.cmd` instead of `npm` in that case.

Create `.env` from `.env.example`, then run:

```sh
npm run dev
```

Open the Local URL printed by Vite. You can edit and preview a campaign without a wallet. Transactions require `VITE_CONTRACT_ID` to point to this deployed contract. No fake wallet connection or simulated mint success is used.

## Deploy the monorepo on Vercel

Import [`mateojkk/keydrop`](https://github.com/mateojkk/keydrop) as one Vercel project. Set **Root Directory** to the repository root (`.`), **Framework Preset** to Vite, and use the committed `vercel.json` settings: `npm ci`, `npm run build`, and output directory `dist`. The Rust contract in `contract/` is a separate package in the same repository; Vercel deploys the frontend and `api/` function, not the contract WASM. The contract is already deployed on NEAR testnet.

The committed `.env.production` configures the live testnet contract for the Vite build. If deploying a different contract, set `VITE_CONTRACT_ID` and `VITE_RPC_URL` in Vercel's project environment variables before rebuilding. These `VITE_` values are public in the browser bundle; never put keys or provider secrets there. For the optional serverless `GET /api/status` function, set `NEAR_CONTRACT_ID` and `NEAR_RPC_URL` only if overriding its default Mateo testnet contract and RPC endpoint. A successful status response includes the contract ID and live NFT supply; RPC failures return HTTP 503. The SPA rewrite excludes `/api/` so requests reach the function.

For local frontend development, run `npm run dev` and open `http://127.0.0.1:5173`. To run Vercel's function routing locally too, link the project with Vercel CLI and run `vercel dev` from the repository root; this needs a Vercel account. The app itself reads and signs against NEAR directly and does not depend on the status function.

## Test and build the contract

```sh
rustup update stable
rustup target add wasm32-unknown-unknown
cd contract
cargo test
cargo build --target wasm32-unknown-unknown --release
```

The contract is `contract/target/wasm32-unknown-unknown/release/keydrop.wasm`. The exact near SDK and standards versions are pinned in `contract/Cargo.toml` and `contract/Cargo.lock`. CI runs native unit tests, a WASM build, and frontend checks.

Tests cover batch balances, successful spending, rejected overspending, failed-payment restoration, seven-day resets, ownership and access changes, transfers preserving allowance, old-holder rejection, in-flight locks, and underfunding. Native unit tests use NEAR's mocked VM. Complete the testnet walkthrough below to verify wallet discovery and asynchronous receipts on the real network.

## Deploy to testnet

Install [near-cli-rs](https://github.com/near/near-cli-rs#installation) and create/import a funded **dedicated contract account** using its interactive prompts:

```sh
near account create-account sponsor-by-faucet-service YOUR_CONTRACT.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
```

Create separate ordinary testnet accounts for the project, Alice, Bob, and Carol; fund the project account for rewards and gas. Import recipient accounts into Meteor with **testnet** selected. Testnet tokens have no real monetary value. The contract account needs its own initial balance for code/storage; 5 testnet NEAR is a practical starting balance.

Replace `YOUR_CONTRACT.testnet` throughout. Deploy and initialize atomically to avoid an initialization race:

```sh
near contract deploy YOUR_CONTRACT.testnet use-file contract/target/wasm32-unknown-unknown/release/keydrop.wasm with-init-call new json-args '{}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
```

Run this command from the repository root (after leaving `contract/`). CLI flags follow the [official CLI guide](https://github.com/near/near-cli-rs/blob/main/docs/GUIDE.en.md). Use its interactive equivalent if your installed CLI has renamed a prompt.

Configure `.env`:

```dotenv
VITE_CONTRACT_ID=YOUR_CONTRACT.testnet
VITE_RPC_URL=https://test.rpc.fastnear.com
```

Restart Vite after changing environment variables. They are compiled into static builds; set them before `npm run build` when hosting. RPC URLs must support browser CORS. The app uses final state for views and inspects transaction and receipt failures before showing confirmation.

### Remove deployment keys after verification

First inspect code and run the demo with test funds. Then list the **dedicated contract account's** keys:

```sh
near account list-keys YOUR_CONTRACT.testnet network-config testnet now
```

Remove every access key. For each public key:

```sh
near account delete-keys YOUR_CONTRACT.testnet public-keys ed25519:REPLACE_WITH_PUBLIC_KEY network-config testnet sign-with-keychain send
```

If multiple full-access keys exist, remove the others first and the signing key last. Re-run `list-keys` and verify the list is empty. Removing the final key is irreversible: code cannot be upgraded and the dedicated account can no longer sign transactions. The contract continues accepting calls signed by project and recipient wallets, and contract-generated payouts continue working. Do **not** remove keys from the project or recipient accounts. No code path in this contract creates new keys or deploys code.

Capture the deployed code hash, contract ID, and empty access-key list in demo evidence. The live `keydrop-mateo.testnet` deployment has completed this step. For a new deployment, verify its own key list before describing it as immutable.

## Artwork and metadata

Drag/drop or choose a PNG/JPEG/WebP/GIF up to 5 MB. By default, the browser makes a compact WebP (up to 6,000 URI characters), and the NFT stores that data URI on-chain. GIF uploads become a still frame. Keep the original source artwork separately. Some wallet galleries may not display data URIs; **use a public HTTPS/IPFS image URL for the broadest wallet-gallery compatibility**. The app renders both.

For full-resolution uploads, configure `VITE_UPLOAD_URL` with your own HTTPS pinning proxy. It must accept multipart `file` and return `{"url":"https://…"}` or `{"url":"ipfs://…"}`. Keep pinning-provider credentials on that proxy, never in `VITE_` variables. Upload failure blocks readiness until a valid source is present. Public artwork URLs can be supplied directly without any service configuration.

Import a NEP-177 JSON file using **Import JSON**, or fill the name and description. Optional `reference` links to public JSON. Contract metadata is capped at 8 KiB, including the image URI. The frontend attaches the funded reward total plus **0.12 NEAR per NFT** as a conservative storage allowance; the contract measures actual storage, retains a 512-byte future-state reserve per token, and refunds excess to the project. Storage is separate from recipient balances; network gas is additional. Very large or unusual metadata may require reducing its size.

## Testnet demo walkthrough

1. Connect the project wallet. Upload artwork (or provide its public URL). Name the reward **Early Contributor**. Set default balance **10 NEAR** and weekly limit **2 NEAR**. Add Alice and Bob's actual testnet account IDs; optionally give Bob **15 NEAR**. Review and approve the atomic airdrop. Save the transaction URL.
2. Sign out and connect Alice. Open **My rewards** and refresh from chain. The app shows her NFT, 10 NEAR remaining, and 2 NEAR available. Also open her wallet's NFT gallery if it indexes the contract; app enumeration works without an indexer.
3. Withdraw **1 NEAR**. Wait for final confirmation and refresh: balance **9**, current available allowance **1**. Save the transaction URL and wallet balance change.
4. Request **1.5 NEAR** again. The app deliberately permits submitting an excess request for this demo; the contract rejects it with `Weekly spending limit exceeded`. Balance and allowance stay unchanged (gas is still paid). Save the failed transaction URL.
5. **My rewards** shows **Access verified**, sourced from `has_access(account_id)`. Verify the same view via CLI if desired (below).
6. Transfer Alice's NFT to Carol using **Transfer reward NFT**. Confirm the destination. Connect Carol: balance **9**, allowance **1**, and access verified. Connect Alice: that NFT is gone and access is false if she has no other NFTs from this contract. Bob's NFT is unaffected. Save the transfer transaction and before/after screenshots.

The weekly reset is seven days after mint, without a transfer reset. Unit tests advance block time to test this boundary; do not shorten the production rule for a video.

Example views (substitute actual account and token IDs):

```sh
near contract call-function as-read-only YOUR_CONTRACT.testnet get_reward json-args '{"token_id":"0"}' network-config testnet now
near contract call-function as-read-only YOUR_CONTRACT.testnet has_access json-args '{"account_id":"alice.testnet"}' network-config testnet now
near contract call-function as-read-only YOUR_CONTRACT.testnet nft_tokens_for_owner json-args '{"account_id":"alice.testnet","limit":100}' network-config testnet now
```

## Contract interface

All amounts are **decimal strings in yoctoNEAR**, where 1 NEAR = 10²⁴ yoctoNEAR. No floating point arithmetic is used for transaction amounts.

| Method | Arguments | Deposit |
| --- | --- | --- |
| `new` | `{}` | 0; initialization once |
| `create_airdrop` | `{metadata, weekly_limit, recipients:[{account_id,amount}]}` | All reward funds + storage |
| `get_reward` | `{token_id}` | View |
| `has_access` | `{account_id}` | View |
| `spend` | `{token_id,amount,receiver_id}` | Exactly 1 yoctoNEAR; ≥30 Tgas |
| `nft_transfer` | Standard NEP-171 arguments | Exactly 1 yoctoNEAR |
| `nft_transfer_call` | Standard NEP-171 arguments including `msg` | Exactly 1 yoctoNEAR |
| `nft_token`, `nft_tokens`, `nft_total_supply`, `nft_tokens_for_owner`, `nft_supply_for_owner`, `nft_metadata` | Standard view arguments | View |

Approval management is intentionally disabled; only owners transfer or spend. `resolve_spend` and `nft_resolve_transfer` are private callbacks. `spend` can pay any valid NEAR account except the reward contract itself; the app's withdrawal UI pays the connected holder. The receiver must exist for native transfers to named accounts. Access checks should be called from your gated contract using `has_access` and an authenticated account ID; a screenshot or frontend boolean is not an authentication proof.

Metadata may contain externally hosted mutable images; only the recorded URI and contract reward settings are immutable. Use content-addressed IPFS or the embedded WebP path for immutable artwork. Recipient enumeration currently displays the first 100 held NFTs; larger portfolios should page with `from_index`.

## Submission checklist

The submission instructions supplied for this project are captured here; verify the final form before sending. **One submission per project; it cannot be edited after sending.**

- Publish this repository on **public GitHub**, including contract source, lockfiles, README, and the actual testnet contract ID.
- Run CI and the real testnet demo above. Record a short video or screenshots showing successful spend, rejected overspend, and balance/access transfer.
- Publish a **public X demo post** saying it was built at **NEAR HACKATHON**, tagging **@NEARProtocol** and **#NEARHackathon**, and attach the video/screenshots.
- Submit both the public GitHub URL and the X demo post URL at [nearhackathon.com](https://nearhackathon.com), track **NFTs That Do Something** (`nfts`), before **14 November 2026, 23:59 UTC** (**15 November, 00:59 WAT**).
- Review all links in a signed-out browser before the single final submission. A private Sites preview is not a substitute for either required public link.

Draft X copy (replace placeholders and attach evidence):

> Built at NEAR HACKATHON: Keydrop turns contributor recognition into funded NFTs. Airdrop to normal NEAR accounts, spend within on-chain weekly limits, and transfer the remaining balance + access with the NFT. Testnet demo below. @NEARProtocol #NEARHackathon

No X post or hackathon submission is sent automatically by this project.

## Layout

```text
contract/src/lib.rs       Contract and NEP interfaces
contract/src/tests.rs     Native mocked-VM contract tests
src/main.tsx             Project and recipient frontend
src/near.ts              Testnet wallet / RPC / transaction adapter
src/amounts.mjs           Exact amount and account validation
src/artwork.ts            Browser image compression for on-chain media
tests/amounts.test.mjs     Exact arithmetic and input validation tests
.github/workflows/ci.yml  Contract + frontend checks
```
