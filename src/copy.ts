// The words for each verdict: short sentences that say what the chain shows. A shielded landing names the pool, never
// who received it; nothing here calls a payment hidden or private.
import type { Verdict } from "./judge.js";

const POOL_NAME = { ironwood: "Ironwood", orchard: "Orchard", sapling: "Sapling" } as const;

/** Zatoshis as ZEC, up to 8 decimals, trailing zeros dropped. */
export function formatZec(zat: number): string {
  const whole = Math.floor(zat / 1e8);
  const frac = String(zat % 1e8).padStart(8, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

const joinAnd = (names: string[]): string => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

export function describe(v: Verdict, ctx: { exchange?: string; addressGiven: boolean }): { title: string; lines: string[] } {
  const who = ctx.exchange?.trim() || undefined;
  switch (v.kind) {
    case "transparent":
      return {
        title: who ? `${who} paid your transparent address` : "Paid to your transparent address",
        lines: [
          `Output ${v.output.n} sent ${formatZec(v.output.valueZat)} ZEC to ${v.couldShield ? "the transparent part of the address you gave" : "the address you gave"}. The amount and address of a transparent payment are public.`,
          v.couldShield
            ? "Your address could take shielded ZEC, but this payment used its transparent part."
            : "The address you gave is transparent, so this is the only way it could be paid.",
        ],
      };
    case "shielded": {
      const known = v.parts.filter((p) => p.pool !== "unknown").map((p) => POOL_NAME[p.pool as keyof typeof POOL_NAME]);
      const where = known.length === 0
        ? "in a pool this page doesn't know yet"
        : `in the ${joinAnd(known)} pool${known.length > 1 ? "s" : ""}${v.parts.length > known.length ? " and a pool this page doesn't know yet" : ""}`;
      const lines = v.parts.map((p) => {
        const pool = p.pool === "unknown" ? "A pool this page doesn't know yet" : `The ${POOL_NAME[p.pool]} pool`;
        return p.amountZat !== null
          ? `${formatZec(p.amountZat)} ZEC went into the ${p.pool === "unknown" ? "unknown" : POOL_NAME[p.pool]} pool in this transaction. The amount is visible because it came from a transparent address.`
          : `${pool} received a payment in this transaction. The amount isn't visible because it was sent from a shielded wallet.`;
      });
      lines.push(ctx.addressGiven
        ? "No transparent output paid your address. The chain doesn't show who received a shielded payment: your wallet will show whether it was yours."
        : "This shows where the transaction's value went, not who received it.");
      return { title: `${who ? `${who}'s payment landed shielded` : "Landed shielded"}, ${where}`, lines };
    }
    case "not-paid": {
      const lines = {
        "no-match": ["No output of this transaction pays the address you gave, and it moved no shielded value.", "Check that the txid and the address come from the same withdrawal."],
        "pool-mismatch": ["This transaction moved shielded value, but only into pools the address you gave has no receiver for.", "Check that the txid and the address come from the same withdrawal."],
        sprout: ["This transaction uses the old Sprout pool, which this page doesn't read."],
        coinbase: ["This is a mining reward, not a withdrawal."],
      }[v.reason];
      return { title: "Not paid to this address", lines };
    }
    case "mempool":
      return { title: "Not confirmed yet", lines: ["This transaction is still waiting for a block. Check again after it confirms; a Zcash block takes about 75 seconds."] };
  }
}
