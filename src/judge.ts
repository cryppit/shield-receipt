// Where a withdrawal landed, from the transaction and the address someone gave. The chain shows a transparent payment
// to the address's script directly; for a shielded payment it shows only which pool value went into (and how much,
// when it came from a transparent wallet), never who received it, so that is all a shielded verdict claims.
import type { AddressFacts } from "./address.js";
import type { Pool, TxFacts } from "./tx.js";

export type Verdict =
  | { kind: "transparent"; output: { n: number; valueZat: number }; couldShield: boolean }
  | { kind: "shielded"; parts: { pool: Pool | "unknown"; amountZat: number | null }[] }
  | { kind: "not-paid"; reason: "no-match" | "pool-mismatch" | "sprout" | "coinbase" }
  | { kind: "mempool" };

const canReceive = (addr: AddressFacts, pool: Pool): boolean => (pool === "sapling" ? addr.shielded.sapling : addr.shielded.orchard);

/** `addr` null is the share-link view: pool facts only. */
export function judge(tx: TxFacts, addr: AddressFacts | null): Verdict {
  const script = addr?.transparentScript;
  const match = script ? tx.outputs.find((o) => o.scriptHex === script) : undefined;
  if (match && addr) {
    return { kind: "transparent", output: { n: match.n, valueZat: match.valueZat }, couldShield: addr.shielded.sapling || addr.shielded.orchard };
  }
  if (tx.sprout) return { kind: "not-paid", reason: "sprout" };
  if (tx.coinbase) return { kind: "not-paid", reason: "coinbase" };

  const paying = tx.pools.filter((p) => p.actions > 0 && p.outputsEnabled);
  const parts: { pool: Pool | "unknown"; amountZat: number | null }[] = paying
    .filter((p) => addr === null || canReceive(addr, p.pool))
    .map((p) => ({ pool: p.pool, amountZat: p.valueBalanceZat < 0 ? -p.valueBalanceZat : null }));
  // An unknown bundle may pay any shielded receiver, so it counts for any address that has one.
  if (tx.unknownBundles.length > 0 && (addr === null || addr.shielded.sapling || addr.shielded.orchard)) {
    parts.push({ pool: "unknown", amountZat: null });
  }
  if (parts.length > 0) return { kind: "shielded", parts };

  if (tx.height === null) return { kind: "mempool" };
  // "pool-mismatch": the transaction did move shielded value, just not into a pool this address can receive.
  const hasShielded = addr !== null && (addr.shielded.sapling || addr.shielded.orchard);
  const movedShielded = tx.pools.some((p) => p.actions > 0);
  return { kind: "not-paid", reason: hasShielded && movedShielded ? "pool-mismatch" : "no-match" };
}
