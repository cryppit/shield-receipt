// Loads a recorded Blockchair fixture (scripts/record-fixture.mjs): the raw and dashboard responses for one txid.
import { readFileSync } from "node:fs";

export interface Fixture { txid: string; raw: unknown; dashboard: unknown }

export function fixture(name: string): Fixture {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8")) as Fixture;
}

/** A deep copy of a fixture with `edit` applied to its decoded raw transaction and dashboard entry: for synthetic cases. */
export function edited(name: string, edit: (tx: Record<string, unknown>, dash: Record<string, unknown>) => void): Fixture {
  const f = fixture(name);
  const raw = f.raw as { data: Record<string, { decoded_raw_transaction: Record<string, unknown> }> };
  const dash = f.dashboard as { data: Record<string, { transaction: Record<string, unknown> }> };
  edit(raw.data[f.txid]!.decoded_raw_transaction, dash.data[f.txid]!.transaction);
  return f;
}
