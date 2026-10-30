// The facts about one transaction that decide where a withdrawal landed, read from Blockchair's raw transaction
// (Zebra's decoded transaction: transparent outputs and the Sapling, Orchard and Ironwood bundles) and its dashboard
// entry (block height and time). A value balance below zero means value entered that shielded pool.

export type Pool = "ironwood" | "orchard" | "sapling";

export interface PoolPart {
  pool: Pool;
  /** Sapling spends + outputs, or Orchard/Ironwood actions. */
  actions: number;
  valueBalanceZat: number;
  /** False when the bundle's flags disable outputs, so nobody was paid in that pool. */
  outputsEnabled: boolean;
}

export interface TxOutput { n: number; scriptHex: string; valueZat: number; address: string | null }

export interface TxFacts {
  txid: string;
  /** Null while the transaction is in the mempool. */
  height: number | null;
  /** ISO 8601 UTC, or null in the mempool. */
  time: string | null;
  outputs: TxOutput[];
  pools: PoolPart[];
  /** Keys of shielded bundles this page does not know (for example after a network upgrade). */
  unknownBundles: string[];
  sprout: boolean;
  coinbase: boolean;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number => (typeof v === "number" ? v : 0);

const KNOWN_KEYS = new Set(["txid", "authdigest", "size", "overwintered", "version", "versiongroupid", "locktime", "expiryheight", "hex", "vin", "vout", "vjoinsplit", "valueBalance", "valueBalanceZat", "vShieldedSpend", "vShieldedOutput", "orchard", "ironwood"]);

function entry(response: unknown, txid: string): Obj | null {
  if (!isObj(response) || !isObj(response.data)) return null;
  const e = response.data[txid];
  return isObj(e) ? e : null;
}

function actionPool(pool: "orchard" | "ironwood", b: unknown): PoolPart | null {
  if (!isObj(b)) return null;
  const actions = list(b.actions).length;
  const valueBalanceZat = num(b.valueBalanceZat);
  if (actions === 0 && valueBalanceZat === 0) return null;
  const outputsEnabled = !isObj(b.flags) || b.flags.enableOutputs !== false;
  return { pool, actions, valueBalanceZat, outputsEnabled };
}

export function readBlockchairTx(raw: unknown, dashboard: unknown, txid: string): TxFacts | { notFound: true } {
  const r = entry(raw, txid);
  const t = r && isObj(r.decoded_raw_transaction) ? r.decoded_raw_transaction : null;
  if (!t) return { notFound: true };
  const d = entry(dashboard, txid);
  const info = d && isObj(d.transaction) ? d.transaction : {};

  const blockId = num(info.block_id);
  const height = blockId > 0 ? blockId : null;
  const time = height !== null && typeof info.time === "string" ? `${info.time.replace(" ", "T")}Z` : null;

  const outputs: TxOutput[] = list(t.vout).filter(isObj).map((o) => {
    const spk = isObj(o.scriptPubKey) ? o.scriptPubKey : {};
    const addresses = list(spk.addresses);
    return {
      n: num(o.n),
      scriptHex: typeof spk.hex === "string" ? spk.hex.toLowerCase() : "",
      valueZat: num(o.valueZat),
      address: typeof addresses[0] === "string" ? addresses[0] : null,
    };
  });

  const pools: PoolPart[] = [];
  const saplingActions = list(t.vShieldedSpend).length + list(t.vShieldedOutput).length;
  const saplingBalance = num(t.valueBalanceZat);
  if (saplingActions > 0 || saplingBalance !== 0) {
    pools.push({ pool: "sapling", actions: saplingActions, valueBalanceZat: saplingBalance, outputsEnabled: list(t.vShieldedOutput).length > 0 });
  }
  for (const p of [actionPool("orchard", t.orchard), actionPool("ironwood", t.ironwood)]) if (p) pools.push(p);

  const unknownBundles = Object.keys(t).filter((k) => {
    const v = t[k];
    return !KNOWN_KEYS.has(k) && isObj(v) && ("actions" in v || "valueBalanceZat" in v);
  });

  return {
    txid,
    height,
    time,
    outputs,
    pools,
    unknownBundles,
    sprout: list(t.vjoinsplit).length > 0,
    coinbase: info.is_coinbase === true || list(t.vin).some((v) => isObj(v) && "coinbase" in v),
  };
}
