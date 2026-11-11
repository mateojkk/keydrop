# Verification status

This file records observed checks, separately from implementation scope.

## Passed locally

- `npm test`: three test groups, covering exact yoctoNEAR conversion, input precision/rejection, per-recipient funding overrides, duplicates, and account-ID syntax.
- `npm run build`: TypeScript and optimized Vite production build.
- `scripts/browser-qa.mjs`: headless Brave at 1440px desktop and 390px mobile; real image upload and compact WebP encoding, live preview, exact funding total, review dialog, duplicate rejection, recipient empty state, guide navigation, no horizontal mobile overflow, and no uncaught runtime errors.
- Browser initialization of actual Wallet Selector modules: returned `network: testnet` and modules `meteor-wallet`, `my-near-wallet`. This checks module compatibility, not a wallet signature.
- Screenshots and browser result are in `artifacts/`. They demonstrate UI behavior and contain test form data, **not on-chain execution evidence**.

## Not verified yet

- Rust contract compilation and native tests: the starting Windows environment had no Rust or C/C++ toolchain. Rustup installation was attempted, but toolchain downloads stalled. The test suite and GitHub Actions workflow are provided; a successful Cargo/CI run is required before using the contract with funds.
- Real testnet deployment, wallet signatures, payouts, transfer-and-call receipts, wallet-gallery indexing, and empty deployment access-key list: require an actual deployed contract account and funded testnet wallets. No contract ID was supplied during implementation.
- Public GitHub repository, public X demo post, and hackathon form submission have not been created. A private hosted frontend does not meet those submission requirements.

## Dependency notes

The installed Meteor SDK depends on an older `query-string` / `decode-uri-component` chain with reported denial-of-service advisories. `npm audit` also reports low-severity upstream elliptic/secp256k1 issues. Nanoid is overridden to its patched 5.1.16 release. Do not force an incompatible major wallet-SDK downgrade to make the audit count disappear. Review updated wallet dependencies before a production/mainnet release. This project targets testnet.

## Repeat browser QA

The QA script accepts an installed Playwright module and Chromium browser. For example, after installing Playwright locally for development:

```sh
KEYDROP_BROWSER=/path/to/chromium node scripts/browser-qa.mjs
```

On PowerShell set `$env:KEYDROP_BROWSER` first. `KEYDROP_PLAYWRIGHT_MODULE` can point to an existing Playwright module using a `file:///` URL. The dev server must be running at `http://127.0.0.1:5173`, or set `KEYDROP_QA_URL` to the intended local preview URL.
