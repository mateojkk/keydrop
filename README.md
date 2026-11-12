# Keydrop

Contributor Reward NFTs for **NEAR HACKATHON 2026**, track **NFTs That Do Something**. Projects choose a collection name, fund rewards, set an immutable weekly limit, and airdrop NFTs to ordinary NEAR testnet accounts.

## Architecture

The factory at [keydrop.testnet](https://testnet.nearblocks.io/address/keydrop.testnet) creates one NFT contract per airdrop: c0.keydrop.testnet, c1.keydrop.testnet, and so on. Each child returns the airdropper's chosen collection name from NEP-177 nft_metadata. The reward NFT's title is separate. Wallets can group each child as its own collection.

Each child implements NEP-171 transfers, NEP-177 metadata, NEP-181 enumeration, and NEP-297 mint/transfer events. It mints once during initialization and has **no access keys**, upgrade method, balance setter, limit setter, or clawback. The holder can spend native NEAR within a seven-day limit anchored at mint. Failed payments restore the balance and allowance. Transfers move remaining balance, used allowance, and access to the new holder. A fully spent NFT still grants access to its current holder.

The factory quotes the full deposit before wallet approval. It includes rewards, per-token storage, registry storage, and a reserve for the new contract's code and future state. The child reserve stays in that account; unused per-token and registry allowances are refunded. Testnet NEAR has no real monetary value.

Existing NFTs on [keydrop-mateo.testnet](https://testnet.nearblocks.io/address/keydrop-mateo.testnet) remain there. The app still shows them. Account IDs and minted metadata cannot be renamed.

## Live testnet

- Factory: [keydrop.testnet](https://testnet.nearblocks.io/address/keydrop.testnet)
- Example collections: [Builder Collective](https://testnet.nearblocks.io/address/c0.keydrop.testnet) and [Open Source Thank You](https://testnet.nearblocks.io/address/c1.keydrop.testnet)
- Frontend: [Keydrop preview](https://keydrop-contributor-rewards.ripedulse1.chatgpt.site) (may require owner access)
- Public source: [mateojkk/keydrop](https://github.com/mateojkk/keydrop)

The factory's collection_count and list_collections views enumerate child contracts. The first demo collection minted to Alice; the second minted to Alice and Bob. [VERIFICATION.md](VERIFICATION.md) records transactions and final states.

## Run locally

Install Node.js 22+ and npm:

~~~sh
npm ci
npm test
npm run build
npm run dev
~~~

Copy .env.example to .env.local for development. It points to the factory, the legacy contract, and a testnet RPC. PowerShell users can run npm.cmd if execution policy blocks npm.ps1. Open the Vite URL, normally http://127.0.0.1:5173.

The landing page is /; the project workspace is /create; recipients use /rewards. Connect a testnet Meteor or MyNearWallet account. Never put wallet keys in environment variables or the repository.

## Create an airdrop

1. Connect the funding project wallet at /create.
2. Enter **Collection name**, reward NFT title, description, and artwork. Uploads embed a compact WebP in the NFT metadata; a public HTTPS/IPFS image URL also works.
3. Set the funded balance per recipient, weekly limit, and 1-20 recipient account IDs. Individual balances can differ.
4. Review the factory's exact deposit quote and approve **Confirm & airdrop**. The factory creates a child contract and mints NFTs directly to recipients in one wallet transaction.
5. Connect a recipient at /rewards. The app discovers registered collections, reads balances and allowances, and calls each child's has_access.
6. Send NEAR from the NFT to the holder or another existing account. Keydrop verifies the transfer receipt before displaying a +NEAR confirmation for a payment to the connected holder. Meteor may label the signed action as a spend call in its own activity feed.
7. Transfer the NFT. Its remaining balance, current weekly usage, and access follow the new holder.

For this build, one 0.1 NEAR reward was quoted at **5.64381 testnet NEAR**. Most of that funds the new child's code/storage reserve. The exact quote is calculated on-chain and shown before approval.

## Build the contracts

Install stable Rust, the wasm32-unknown-unknown target, a native C/C++ toolchain for unit tests, and [near-cli-rs](https://github.com/near/near-cli-rs). Build the child **before** the factory because the factory embeds the exact child WASM:

~~~sh
rustup target add wasm32-unknown-unknown
cd contract
cargo test
cargo build --target wasm32-unknown-unknown --release
cd ../factory
cargo test
cargo build --target wasm32-unknown-unknown --release
cd ..
~~~

The outputs are contract/target/wasm32-unknown-unknown/release/keydrop.wasm and factory/target/wasm32-unknown-unknown/release/keydrop_factory.wasm. GitHub Actions builds and uploads both. Exact near-sdk versions and both Cargo lockfiles are committed.

## Deploy a fresh testnet factory

Replace YOUR_FACTORY.testnet with a new funded account. The factory account needs initial NEAR for its WASM storage; the live keydrop.testnet started with 10 testnet NEAR.

~~~sh
near account create-account sponsor-by-faucet-service YOUR_FACTORY.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
near contract deploy YOUR_FACTORY.testnet use-file factory/target/wasm32-unknown-unknown/release/keydrop_factory.wasm with-init-call new json-args '{}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
~~~

Use [artifacts/v2-demo-args.json](artifacts/v2-demo-args.json) or [artifacts/v2-two-recipient-args.json](artifacts/v2-two-recipient-args.json) as a starting point. Sum the recipient amounts in yoctoNEAR, then request the exact deposit from get_required:

~~~sh
near contract call-function as-read-only YOUR_FACTORY.testnet get_required json-args '{"total_funding":"200000000000000000000000","recipient_count":2}' network-config testnet now
~~~

Attach the quoted amount when calling create_collection. The live two-recipient example used 5.86381 NEAR for this exact build:

~~~sh
near contract call-function as-transaction keydrop.testnet create_collection file-args artifacts/v2-two-recipient-args.json prepaid-gas '300 Tgas' attached-deposit '5.86381 NEAR' sign-as keydrop-carol-mateo.testnet network-config testnet sign-with-keychain send
~~~

Inspect list_collections, each child's nft_metadata, nft_tokens_for_owner, get_reward, has_access, and access-key list. A child must have **zero access keys**. Its public create_airdrop method rejects a second mint. After verifying a new factory thoroughly, its deployment key may be removed to make future factory code immutable. Do **not** remove keys from project or recipient wallets.

## Contract methods

All amounts are decimal yoctoNEAR strings (1 NEAR = 10^24 yoctoNEAR). The frontend uses integer arithmetic for transactions.

| Contract | Method | Purpose |
| --- | --- | --- |
| Factory | get_required(total_funding, recipient_count) | Exact deposit quote |
| Factory | create_collection(collection_name, metadata, weekly_limit, recipients) | Deploy child and mint |
| Factory | collection_count, list_collections | Discover collections |
| Child | nft_metadata, nft_tokens_for_owner, nft_token | NEP-177/181 metadata and enumeration |
| Child | get_reward, has_access | Reward state and ownership access |
| Child | spend(token_id, amount, receiver_id) | Holder-only NEAR payment; exactly 1 yoctoNEAR |
| Child | nft_transfer, nft_transfer_call | NEP-171 ownership transfer |

The child locks spending and transfers while a payment or transfer-call is in flight. A failed payment restores both reward balance and allowance. Collection names, token metadata, funded balances, and weekly limits cannot be edited after mint.

## Vercel monorepo

Import the public repository as one Vercel project with root directory . and Vite preset. vercel.json runs npm ci and npm run build, serves dist, and routes /api/status to a serverless function. Rust packages are built separately; Vercel deploys the frontend, not WASM. .env.production sets public factory and legacy contract IDs. Override VITE_CONTRACT_ID, VITE_LEGACY_CONTRACT_ID, or VITE_RPC_URL only when targeting another deployment. Never put secrets in VITE_ values. GET /api/status reports the factory's live collection count.

## NEAR HACKATHON submission

One submission per project; it **cannot be edited after sending**. Submissions close **14 Nov 2026, 23:59 UTC** (**15 Nov, 00:59 WAT**). Track: **NFTs That Do Something** (nfts).

- Keep this GitHub repository public.
- Record video or screenshots of a chosen collection name, two-recipient airdrop, successful spend, rejected overspend, access, and transfer.
- Publish a public X post saying it was built at **NEAR HACKATHON**, tag **@NEARProtocol** and **#NEARHackathon**, and attach the media.
- Submit the public GitHub and X links at [nearhackathon.com](https://nearhackathon.com). Check both links in a signed-out browser before the single submission.

Draft X copy (attach evidence before posting):

> Built at NEAR HACKATHON: Keydrop lets projects create their own funded NFT collection and airdrop Contributor Rewards. Holders spend within on-chain weekly limits; remaining value and access transfer with the NFT. Testnet demo below. @NEARProtocol #NEARHackathon

No X post or hackathon form submission is sent automatically by this repository.
