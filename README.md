# Shield Receipt

Did your ZEC withdrawal land shielded? Paste the withdrawal's transaction ID and the address you gave. The page reads
the transaction from the public chain and tells you one of three things:

- **Paid to your transparent address.** An output pays the transparent part of the address (a t1/t3 address, a TEX
  address, or a unified address's transparent receiver). If the address could take shielded ZEC, the page says so.
- **Landed shielded, in the Ironwood pool** (or Sapling, or Orchard). No transparent output paid the address and the
  transaction put value into a pool the address can receive. When the ZEC came from a transparent wallet, the amount
  is shown too.
- **Not paid to this address**, with the reason: no matching output, a pool the address can't receive, or a
  transparent address against a shielded payment.

It also says when the chain can't tell (a pool spent to other outputs and may have made shielded outputs too), when a
transaction isn't confirmed yet, and when Blockchair has no such transaction.

Every answer shows its evidence: block, matched output or pool value balance, and a link to the transaction on
Blockchair.

## What it can't tell you

The chain doesn't show who received a shielded payment. A shielded verdict says which pool value went into, not that
it was yours; your wallet shows that. No viewing key is asked for, ever.

## What others can see

- Blockchair sees the txid you check and your IP address (use Tor or a VPN if you'd rather it didn't).
- The address you type stays in your browser: it is not sent, stored or put in a link.
- A share link (`#tx=<txid>`) carries only the txid and shows the transaction's pool facts.

No keys of any kind, no account, nothing stored.

## How it works

`src/address.ts` decodes the address in the browser (bech32/bech32m, F4Jumble and the ZIP 316 items, Base58Check) and
builds the output script a transparent payment to it would carry. `src/tx.ts` reads Blockchair's raw transaction (the
transparent outputs and the Sapling, Orchard and Ironwood bundles) and its dashboard entry (block and time).
`src/judge.ts` decides; `src/copy.ts` words the answer.

The address decoder (`src/zcash-address.ts`) and its tests come from
[cryppit/zec-refund-helper](https://github.com/cryppit/zec-refund-helper) (MIT), checked against the official
[zcash-test-vectors](https://github.com/zcash/zcash-test-vectors).

## Run it

```bash
pnpm install
pnpm test        # Vitest, on recorded mainnet transactions from 30 Oct 2026
pnpm typecheck
pnpm build       # static page in dist/
```

New fixture: `node scripts/record-fixture.mjs <name> <txid>` (keeps only the fields the reader uses).

MIT licence. By [Cryppit](https://github.com/cryppit). The ZEC coin logo in `web/logos/` is from
[web3icons](https://github.com/0xa3k5/web3icons) (MIT, licence alongside it). Not affiliated with the Zcash
organisations, Blockchair or any exchange or wallet.
