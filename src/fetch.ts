// The txid from whatever was pasted, and the transaction from Blockchair's free API (no key). Only the txid is sent;
// the address never leaves the page. A rate limit or a network failure is "busy", never "not found".
import { readBlockchairTx, type TxFacts } from "./tx.js";

const API = "https://api.blockchair.com/zcash";

/** The one 64-character hex run in `raw` (a bare txid or an explorer link), lowercased; null if there isn't exactly one. */
export function extractTxid(raw: string): string | null {
  const runs = raw.match(/[0-9a-fA-F]+/g) ?? [];
  const ids = runs.filter((r) => r.length === 64);
  return ids.length === 1 && runs.every((r) => r.length <= 64) ? ids[0]!.toLowerCase() : null;
}

export type FetchResult = TxFacts | { notFound: true } | { busy: true } | { error: string };

class Busy extends Error {}

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch {
    throw new Busy();
  }
  if (!res.ok) throw new Busy();
  try {
    return await res.json();
  } catch {
    throw new Error("Blockchair sent a response this page can't read");
  }
}

export async function fetchTx(txid: string, fetchImpl: typeof fetch = fetch): Promise<FetchResult> {
  try {
    const [raw, dashboard] = await Promise.all([
      getJson(`${API}/raw/transaction/${txid}`, fetchImpl),
      getJson(`${API}/dashboards/transaction/${txid}`, fetchImpl),
    ]);
    return readBlockchairTx(raw, dashboard, txid);
  } catch (e) {
    if (e instanceof Busy) return { busy: true };
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
