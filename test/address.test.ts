// What readAddress takes from an address: the transparent output script a payment to it would use, and which shielded
// receivers it has. Unified addresses come from the zcash-test-vectors subset in fixtures/zip316/vectors.json.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { readAddress } from "../src/address.js";

interface Vector { p2pkh: string | null; p2sh: string | null; sapling: string | null; orchard: string | null; address: string }
const vectors = (JSON.parse(readFileSync(new URL("./fixtures/zip316/vectors.json", import.meta.url), "utf8")) as { unified: Vector[] }).unified;
const mainnet = vectors.filter((v) => v.address.startsWith("u1"));
const transparentAndOrchard = mainnet.find((v) => v.p2pkh && v.orchard && !v.sapling)!;
const shieldedOnly = mainnet.find((v) => !v.p2pkh && !v.p2sh && v.sapling && v.orchard)!;

// ZIP 320's example pair: the TEX address and the P2PKH address it encodes.
const T1 = "t1VmmGiyjVNeCjxDZzg7vZmd99WyzVby9yC";
const TEX = "tex1s2rt77ggv6q989lr49rkgzmh5slsksa9khdgte";
const T1_SCRIPT = "76a9148286bf790866805397e3a947640b77a43f0b43a588ac";

describe("readAddress", () => {
  it("gives a t1 address's P2PKH script", () => {
    const a = readAddress(T1);
    expect(a).toMatchObject({ kind: "p2pkh", network: "main", valid: true, transparentScript: T1_SCRIPT });
    expect(a.shielded).toEqual({ sapling: false, orchard: false });
  });

  it("gives a TEX address the same script as the t1 address it encodes", () => {
    expect(readAddress(TEX)).toMatchObject({ kind: "tex", valid: true, transparentScript: T1_SCRIPT });
  });

  it("gives a t3 address its P2SH script", () => {
    expect(readAddress("t3XAVsEWuV7Pt15MYwNY5qAFTH7sQkk3T5j")).toMatchObject({
      kind: "p2sh", valid: true, transparentScript: "a9148a3a2c1c4b5e6d7f8091a2b3c4d5e6f708192a3b87",
    });
  });

  it("takes a unified address's script from its P2PKH item and sees its Orchard receiver", () => {
    const a = readAddress(transparentAndOrchard.address);
    expect(a).toMatchObject({ kind: "unified", network: "main", valid: true, transparentScript: `76a914${transparentAndOrchard.p2pkh}88ac` });
    expect(a.shielded).toEqual({ sapling: false, orchard: true });
  });

  it("gives a unified address with no transparent item no script", () => {
    const a = readAddress(shieldedOnly.address);
    expect(a.transparentScript).toBeNull();
    expect(a.shielded).toEqual({ sapling: true, orchard: true });
  });

  it("sees a Sapling address's receiver and gives it no script", () => {
    const a = readAddress("zs1mrhc9y7jdh5r9ece8u5khgvj9kg0zgkxzdduyv0whkg7lkcrkx5xqem3e48avjq9wn2rukydkwn");
    expect(a).toMatchObject({ kind: "sapling", valid: true, transparentScript: null });
    expect(a.shielded).toEqual({ sapling: true, orchard: false });
  });

  it("says when an address is on testnet", () => {
    expect(readAddress("textest1qyqszqgpqyqszqgpqyqszqgpqyqszqgpfcjgfy")).toMatchObject({ kind: "tex", network: "test", valid: true });
  });

  it("trims what was pasted around the address", () => {
    expect(readAddress(`  ${T1}\n`)).toMatchObject({ input: T1, valid: true, transparentScript: T1_SCRIPT });
  });

  it("ignores spaces and line breaks inside a pasted address", () => {
    const a = transparentAndOrchard.address;
    expect(readAddress(`${a.slice(0, 60)}
${a.slice(60, 120)} ${a.slice(120)}`)).toMatchObject({ input: a, valid: true, transparentScript: `76a914${transparentAndOrchard.p2pkh}88ac` });
  });

  it("marks something that is not an address as invalid, with no script and no receivers", () => {
    const a = readAddress("hello");
    expect(a.valid).toBe(false);
    expect(a.transparentScript).toBeNull();
    expect(a.shielded).toEqual({ sapling: false, orchard: false });
  });
});
