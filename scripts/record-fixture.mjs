// Records one mainnet transaction from Blockchair as a test fixture: node scripts/record-fixture.mjs <name> <txid>
// Keeps the API's own shape but only the fields src/tx.ts reads, so fixtures stay small (no hex, proofs or ciphertexts).
import { writeFileSync } from "node:fs";

const [name, txid] = process.argv.slice(2);
if (!name || !/^[0-9a-f]{64}$/.test(txid ?? "")) throw new Error("usage: record-fixture.mjs <name> <txid>");

const get = async (path) => {
  const res = await fetch(`https://api.blockchair.com/zcash/${path}/${txid}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};
const raw = await get("raw/transaction");
const dashboard = await get("dashboards/transaction");

const count = (list) => (Array.isArray(list) ? list.map(() => ({})) : list);
const bundle = (b) => b && { actions: count(b.actions), valueBalanceZat: b.valueBalanceZat, ...(b.flags ? { flags: b.flags } : {}) };
const trimRaw = (r) => {
  const entry = Array.isArray(r.data) ? null : r.data[txid];
  if (!entry) return { data: r.data, context: { code: r.context.code } };
  const t = entry.decoded_raw_transaction;
  const known = new Set(["txid", "authdigest", "size", "overwintered", "version", "versiongroupid", "locktime", "expiryheight", "hex", "vin", "vout", "vjoinsplit", "valueBalance", "valueBalanceZat", "vShieldedSpend", "vShieldedOutput", "orchard", "ironwood"]);
  const extra = Object.fromEntries(Object.entries(t).filter(([k]) => !known.has(k)));
  return {
    data: {
      [txid]: {
        decoded_raw_transaction: {
          txid: t.txid,
          version: t.version,
          vin: t.vin.map((v) => (v.coinbase ? { coinbase: "" } : {})),
          vout: t.vout.map((o) => ({ valueZat: o.valueZat, n: o.n, scriptPubKey: { hex: o.scriptPubKey.hex, type: o.scriptPubKey.type, ...(o.scriptPubKey.addresses ? { addresses: o.scriptPubKey.addresses } : {}) } })),
          vjoinsplit: count(t.vjoinsplit),
          valueBalanceZat: t.valueBalanceZat,
          vShieldedSpend: count(t.vShieldedSpend),
          vShieldedOutput: count(t.vShieldedOutput),
          orchard: bundle(t.orchard),
          ironwood: bundle(t.ironwood),
          ...extra,
        },
      },
    },
    context: { code: r.context.code },
  };
};
const trimDashboard = (d) => {
  const entry = Array.isArray(d.data) ? null : d.data[txid];
  if (!entry) return { data: d.data, context: { code: d.context.code } };
  const { block_id, time, is_coinbase } = entry.transaction;
  return { data: { [txid]: { transaction: { block_id, time, is_coinbase } } }, context: { code: d.context.code } };
};

const out = new URL(`../test/fixtures/${name}.json`, import.meta.url);
writeFileSync(out, `${JSON.stringify({ txid, recorded: new Date().toISOString(), raw: trimRaw(raw), dashboard: trimDashboard(dashboard) }, null, 1)}\n`);
console.log(`wrote test/fixtures/${name}.json`);
