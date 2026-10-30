// The words each verdict gets. They say what the chain shows and no more.
import { describe, expect, it } from "vitest";

import { describe as words, formatZec } from "../src/copy.js";
import type { Verdict } from "../src/judge.js";

const transparent = (couldShield: boolean): Verdict => ({ kind: "transparent", output: { n: 3, valueZat: 125045000 }, couldShield });
const ironwood = (amountZat: number | null): Verdict => ({ kind: "shielded", parts: [{ pool: "ironwood", amountZat }] });
const all: Verdict[] = [
  transparent(true), transparent(false), ironwood(16826521), ironwood(null),
  { kind: "shielded", parts: [{ pool: "sapling", amountZat: 1 }, { pool: "ironwood", amountZat: null }] },
  { kind: "shielded", parts: [{ pool: "unknown", amountZat: null }] },
  { kind: "not-paid", reason: "no-match" }, { kind: "not-paid", reason: "pool-mismatch" },
  { kind: "not-paid", reason: "sprout" }, { kind: "not-paid", reason: "coinbase" }, { kind: "mempool" },
];

describe("formatZec", () => {
  it("writes zatoshis as ZEC with trailing zeros dropped", () => {
    expect(formatZec(16826521)).toBe("0.16826521");
    expect(formatZec(125045000)).toBe("1.25045");
    expect(formatZec(100000000)).toBe("1");
  });
});

describe("describe", () => {
  it("titles a transparent payment, naming the exchange when given", () => {
    expect(words(transparent(false), { addressGiven: true }).title).toBe("Paid to your transparent address");
    expect(words(transparent(false), { addressGiven: true, exchange: "Binance" }).title).toBe("Binance paid your transparent address");
  });

  it("says a unified address could have taken shielded ZEC", () => {
    expect(words(transparent(true), { addressGiven: true }).lines).toContain("Your address could take shielded ZEC, but this payment used its transparent part.");
    expect(words(transparent(false), { addressGiven: true }).lines.join(" ")).not.toContain("could take shielded");
  });

  it("titles an Ironwood landing and says why the amount is visible", () => {
    const w = words(ironwood(16826521), { addressGiven: true });
    expect(w.title).toBe("Landed shielded, in the Ironwood pool");
    expect(w.lines).toContain("0.16826521 ZEC went into the Ironwood pool in this transaction. The amount is visible because it came from a transparent address.");
  });

  it("says when the amount isn't visible", () => {
    expect(words(ironwood(null), { addressGiven: true }).lines.join(" ")).toContain("The amount isn't visible because it was sent from a shielded wallet.");
  });

  it("names every pool of a payment into two pools, and an unknown one plainly", () => {
    expect(words(all[4]!, { addressGiven: true }).title).toBe("Landed shielded, in the Sapling and Ironwood pools");
    expect(words(all[5]!, { addressGiven: true }).title).toBe("Landed shielded, in a pool this page doesn't know yet");
  });

  it("never says more than the chain shows", () => {
    for (const v of all) {
      for (const ctx of [{ addressGiven: true }, { addressGiven: false }, { addressGiven: true, exchange: "Kraken" }]) {
        const text = (({ title, lines }) => [title, ...lines].join(" ").toLowerCase())(words(v, ctx));
        expect(text, JSON.stringify(v)).not.toMatch(/hidden|private|to you\b/);
      }
    }
  });
});
