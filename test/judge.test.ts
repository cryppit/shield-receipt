// judge: where a withdrawal landed, for real addresses and recorded mainnet transactions.
import { describe, expect, it } from "vitest";

import { readAddress, type AddressFacts } from "../src/address.js";
import { judge } from "../src/judge.js";
import { readBlockchairTx, type TxFacts } from "../src/tx.js";
import { edited, fixture, type Fixture } from "./fixtures.js";

const read = (f: Fixture): TxFacts => {
  const r = readBlockchairTx(f.raw, f.dashboard, f.txid);
  if ("notFound" in r) throw new Error("fixture not found");
  return r;
};
const tx = (name: string): TxFacts => read(fixture(name));

// A unified address as readAddress reports one (the test vectors' receivers never appear in these transactions).
const ua = (transparentScript: string | null, shielded: { sapling: boolean; orchard: boolean }): AddressFacts => ({
  input: "u1…", kind: "unified", network: "main", valid: true, transparentScript, shielded,
});
const ORCHARD_ONLY = { sapling: false, orchard: true };
const SAPLING_ZS1 = readAddress("zs1mrhc9y7jdh5r9ece8u5khgvj9kg0zgkxzdduyv0whkg7lkcrkx5xqem3e48avjq9wn2rukydkwn");

describe("judge: transparent", () => {
  it("finds the output paying a t3 address in a 41-output batch", () => {
    const t = tx("p2sh-batch");
    const out = t.outputs.find((o) => o.address?.startsWith("t3"))!;
    expect(judge(t, readAddress(out.address!))).toEqual({ kind: "transparent", output: { n: out.n, valueZat: out.valueZat }, couldShield: false });
  });

  it("reports only the matching output of a batch", () => {
    const t = tx("transparent-batch");
    const out = t.outputs[2]!;
    expect(judge(t, readAddress(out.address!))).toMatchObject({ kind: "transparent", output: { n: 2, valueZat: out.valueZat } });
  });

  it("says a unified address could have taken shielded ZEC when its transparent part was paid", () => {
    const t = tx("transparent-batch");
    expect(judge(t, ua(t.outputs[0]!.scriptHex, ORCHARD_ONLY))).toMatchObject({ kind: "transparent", couldShield: true });
  });
});

describe("judge: shielded", () => {
  it("names the Ironwood pool and the amount that came from a transparent wallet", () => {
    expect(judge(tx("ironwood-from-transparent"), ua("76a914000000000000000000000000000000000000000088ac", ORCHARD_ONLY))).toEqual({
      kind: "shielded", parts: [{ pool: "ironwood", amountZat: 16826521 }],
    });
  });

  it("gives no amount for a shielded-to-shielded payment", () => {
    expect(judge(tx("ironwood-shielded-only"), ua(null, ORCHARD_ONLY))).toEqual({ kind: "shielded", parts: [{ pool: "ironwood", amountZat: null }] });
    expect(judge(tx("orchard-shielded-only"), ua(null, ORCHARD_ONLY))).toEqual({ kind: "shielded", parts: [{ pool: "orchard", amountZat: null }] });
  });

  it("names the Sapling pool for a Sapling address", () => {
    expect(judge(tx("sapling-payout"), SAPLING_ZS1)).toEqual({ kind: "shielded", parts: [{ pool: "sapling", amountZat: 125045000 }] });
  });

  it("lists a shielded bundle it does not know as an unknown pool", () => {
    const t = read(edited("ironwood-from-transparent", (raw) => { raw.zfuture = { actions: [{}], valueBalanceZat: -5 }; }));
    expect(judge(t, ua(null, ORCHARD_ONLY))).toEqual({
      kind: "shielded", parts: [{ pool: "ironwood", amountZat: 16826521 }, { pool: "unknown", amountZat: null }],
    });
  });

  it("ignores a pool whose outputs are disabled", () => {
    const t = read(edited("orchard-shielded-only", (raw) => { (raw.orchard as { flags: unknown }).flags = { enableSpends: true, enableOutputs: false }; }));
    expect(judge(t, ua(null, ORCHARD_ONLY))).toEqual({ kind: "not-paid", reason: "pool-mismatch" });
  });

  it("shows pool facts alone when no address is given (a share link)", () => {
    expect(judge(tx("ironwood-from-transparent"), null)).toEqual({ kind: "shielded", parts: [{ pool: "ironwood", amountZat: 16826521 }] });
  });
});

describe("judge: not paid", () => {
  it("says an Ironwood payment can't be to a Sapling-only address", () => {
    expect(judge(tx("ironwood-from-transparent"), SAPLING_ZS1)).toEqual({ kind: "not-paid", reason: "pool-mismatch" });
  });

  it("says a t1 address with no matching output was not paid", () => {
    expect(judge(tx("ironwood-shielded-only"), readAddress("t1VmmGiyjVNeCjxDZzg7vZmd99WyzVby9yC"))).toEqual({ kind: "not-paid", reason: "no-match" });
  });

  it("says a unified address was not paid by a transparent-only transaction with no output to it", () => {
    expect(judge(tx("transparent-batch"), ua("76a914000000000000000000000000000000000000000088ac", ORCHARD_ONLY))).toEqual({ kind: "not-paid", reason: "no-match" });
  });

  it("says a transaction still in the mempool should be checked again when nothing matched yet", () => {
    const t = read(edited("transparent-batch", (_raw, dash) => { dash.block_id = -1; }));
    expect(judge(t, readAddress("t1VmmGiyjVNeCjxDZzg7vZmd99WyzVby9yC"))).toEqual({ kind: "mempool" });
  });

  it("still finds a matching output in a mempool transaction", () => {
    const t = read(edited("transparent-batch", (_raw, dash) => { dash.block_id = -1; }));
    expect(judge(t, readAddress(t.outputs[1]!.address!))).toMatchObject({ kind: "transparent", output: { n: 1 } });
  });

  it("reports Sprout and coinbase transactions", () => {
    const addr = readAddress("t1VmmGiyjVNeCjxDZzg7vZmd99WyzVby9yC");
    expect(judge(read(edited("transparent-batch", (raw) => { raw.vjoinsplit = [{}]; })), addr)).toEqual({ kind: "not-paid", reason: "sprout" });
    expect(judge(read(edited("transparent-batch", (_raw, dash) => { dash.is_coinbase = true; })), addr)).toEqual({ kind: "not-paid", reason: "coinbase" });
  });
});
