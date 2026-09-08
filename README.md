# Crumbproof

Create a public file-fingerprint receipt on Cookie Chain, then share a link that lets someone compare the receipt with their own copy of the file. File bytes and filenames stay in the browser. The public label, SHA-256 fingerprint and wallet address go on-chain.

Built for the Cookie Chain app bounty. **Status: app implemented; automated checks and browser file hashing verified. A real Nightly approval and confirmed Cookie Chain receipt are still pending. This is not a completed bounty submission.**

## Run locally

Requires Node.js 22.12+ (tested with 24.19).

```sh
npm ci
npm test
npm run dev
```

Build with `npm run build`. The output is `dist/`. The included `wrangler.jsonc` deploys static assets to a separate Cloudflare Worker using an already authenticated account.

## Use

1. Install [Nightly](https://nightly.app) and connect its Solana account.
2. Choose a local file (up to 50 MiB) and enter a non-confidential public label.
3. Review the exact wallet, label, fingerprint and estimated network fee. The app checks Cookie Chain's genesis and requests a network switch when needed.
4. Approve the Memo transaction in Nightly. A small amount of COOK is required for the network fee. Crumbproof charges no application fee. Follow the [official bridge guide](https://docs.cookiechain.wtf/bridge) in your own wallet if you choose to fund it.
5. Check confirmation and share the receipt link. In Verify proof, look up its transaction signature and choose the original file to compare fingerprints.

## Network and program

- RPC: `https://rpc.cookiescan.io`
- WebSocket: `wss://wss.cookiescan.io`
- Pinned genesis: `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2`
- Existing Memo program: `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`
- Explorer: [cookiescan.io](https://cookiescan.io)

No new program is deployed. Each proof contains exactly one Memo instruction, with the fee payer as a signer. Format:

```json
{"app":"crumbproof","v":1,"sha256":"<64 lowercase hex characters>","label":"<1–120 UTF-8 bytes>"}
```

The verifier checks a confirmed, successful transaction, the Memo program, one instruction, the signer and the exact versioned payload shape. It rejects arbitrary transfers that happen to contain a Memo. The signature is computed from the signed transaction; the wallet cannot silently substitute a different message.

## Reliability and privacy

- No server receives file bytes or filenames. No analytics, backend database, app signing key or secret is required.
- Public labels and fingerprints are permanent. Guessable or public files can be recognizable from a fingerprint.
- A receipt records what a wallet submitted at a block; it does not establish authorship, copyright, acceptance or payment.
- SHA-256 hashing uses Web Crypto. The browser reads the selected file into memory, bounded at 50 MiB.
- Before broadcasting, the app stores the public signature and signing expiry locally. It does not automatically rebroadcast after an uncertain response.
- Confirmation is checked immediately, then with up to five additional read-only checks spaced five seconds apart. A manual Check status control remains available afterward.
- An absent transaction remains unresolved until its blockhash expires at finalized block height. The user must explicitly clear an expired marker; check the explorer before creating another proof.
- History scans only the latest 20 wallet transactions and reports incomplete RPC reads. Older receipts can be looked up by signature.
- RPC responses are trusted for chain state; this is not a light client or independently verified consensus proof.

## Validation

`npm test` runs 41 checks covering SHA-256 known answers, label byte limits, invalid payloads, failed/non-Memo/multi-instruction receipts, signing integrity, wrong network, insufficient fees, rejected/expired signing, storage failure, uncertain broadcast, status handling and incomplete history.

Transaction tests use local test keypairs and mocked RPC calls. They do not spend funds or establish that Nightly works on a real funded account. Browser testing covers the actual file picker/hash and input/error/navigation screens. A real signed transaction and public demo remain required before claiming end-to-end completion.

## Source references

- [Cookie Chain developer guide](https://docs.cookiechain.wtf/developer-guide)
- [Cookie Chain programs](https://docs.cookiechain.wtf/ecosystem)
- [Cookie Chain wallets](https://docs.cookiechain.wtf/wallets)
- [Nightly connect](https://docs.nightly.app/docs/solana/solana/connect/)
- [Nightly change network](https://docs.nightly.app/docs/solana/solana/change_network/)
- [Nightly sign transaction](https://docs.nightly.app/docs/solana/solana/sign_transaction/)

Created with AI assistance in Codex. MIT licensed. Dependency versions are locked in `package-lock.json`.
