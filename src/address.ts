// What a withdrawal check needs from the address someone gave: the transparent output script a payment to it would use
// (from a t1/t3 address, a TEX address or a unified address's transparent item), and which shielded receivers it has.
// Ironwood pays the same Orchard receiver, so `orchard` covers both pools.
import { base58CheckDecode, bech32Decode, classifyZcashAddress, decodeUnifiedAddress, type ZcashAddressKind } from "./zcash-address.js";

export interface AddressFacts {
  input: string;
  kind: ZcashAddressKind;
  network: "main" | "test" | null;
  valid: boolean;
  error?: string;
  /** Lowercase hex scriptPubKey a transparent payment to this address would carry, or null. */
  transparentScript: string | null;
  shielded: { sapling: boolean; orchard: boolean };
}

const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const p2pkh = (hash: Uint8Array): string => `76a914${hex(hash)}88ac`;
const p2sh = (hash: Uint8Array): string => `a914${hex(hash)}87`;

function transparentScript(input: string, kind: ZcashAddressKind): string | null {
  if (kind === "p2pkh" || kind === "p2sh") {
    const payload = base58CheckDecode(input);
    if (!payload) return null;
    const hash = payload.subarray(2);
    return kind === "p2pkh" ? p2pkh(hash) : p2sh(hash);
  }
  if (kind === "tex") {
    const d = bech32Decode(input);
    return "error" in d ? null : p2pkh(d.bytes);
  }
  if (kind === "unified") {
    const ua = decodeUnifiedAddress(input);
    if ("error" in ua) return null;
    const item = ua.items.find((i) => i.typecode === 0 || i.typecode === 1);
    if (!item) return null;
    return item.typecode === 0 ? p2pkh(item.data) : p2sh(item.data);
  }
  return null;
}

export function readAddress(raw: string): AddressFacts {
  const info = classifyZcashAddress(raw);
  const facts: AddressFacts = {
    input: info.address,
    kind: info.kind,
    network: info.network,
    valid: info.valid,
    transparentScript: info.valid ? transparentScript(info.address, info.kind) : null,
    shielded: { sapling: info.valid && info.receivers.sapling, orchard: info.valid && info.receivers.orchard },
  };
  const error = info.unsupported ?? info.error;
  if (error) facts.error = error;
  return facts;
}
