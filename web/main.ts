// The page: reads the form, fetches the transaction (only the txid leaves the page), and renders the verdict with the
// evidence behind it. Every string from the form or the API is set with textContent.
import { readAddress, type AddressFacts } from "../src/address.js";
import { describe, formatZec } from "../src/copy.js";
import { extractTxid, fetchTx } from "../src/fetch.js";
import { judge } from "../src/judge.js";
import type { TxFacts } from "../src/tx.js";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const form = $<HTMLFormElement>("check");
const txidInput = $<HTMLInputElement>("txid");
const addressInput = $<HTMLTextAreaElement>("address");
const exchangeInput = $<HTMLInputElement>("exchange");
const button = $<HTMLButtonElement>("go");
const result = $<HTMLElement>("result");

const POOL = { ironwood: "Ironwood", orchard: "Orchard", sapling: "Sapling" } as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function showMessage(text: string, cls = "error"): void {
  result.replaceChildren(el("p", text, cls));
  result.hidden = false;
}

function evidenceRow(label: string, value: string | Node): HTMLLIElement {
  const li = el("li");
  li.append(el("b", label), typeof value === "string" ? document.createTextNode(value) : value);
  return li;
}

const utc = (iso: string): string =>
  `${new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} UTC`;

function link(href: string, text: string): HTMLAnchorElement {
  const a = el("a", text);
  a.href = href;
  a.rel = "noopener";
  return a;
}

function render(tx: TxFacts, addr: AddressFacts | null, exchange: string): void {
  const verdict = judge(tx, addr);
  const words = describe(verdict, { addressGiven: addr !== null, exchange });
  const card = el("article", undefined, `card v-${verdict.kind}`);
  card.append(el("h2", words.title));
  for (const line of words.lines) card.append(el("p", line));

  const ev = el("ul", undefined, "evidence");
  ev.append(evidenceRow("Transaction", link(`https://blockchair.com/zcash/transaction/${tx.txid}`, `${tx.txid.slice(0, 10)}…${tx.txid.slice(-6)} on Blockchair`)));
  ev.append(evidenceRow("Block", tx.height === null ? "not confirmed yet" : `${tx.height.toLocaleString("en-US")}, ${tx.time ? utc(tx.time) : "time unknown"}`));
  if (verdict.kind === "transparent") {
    const out = tx.outputs.find((o) => o.n === verdict.output.n);
    ev.append(evidenceRow("Matched output", `#${verdict.output.n}, ${formatZec(verdict.output.valueZat)} ZEC${out?.address ? ` to ${out.address}` : ""}`));
  }
  for (const p of tx.pools) {
    const flow = p.valueBalanceZat < 0 ? `${formatZec(-p.valueBalanceZat)} ZEC in` : p.valueBalanceZat > 0 ? `${formatZec(p.valueBalanceZat)} ZEC out` : "no net value in or out";
    ev.append(evidenceRow(`${POOL[p.pool]} pool`, `${flow}, ${p.actions} ${p.pool === "sapling" ? (p.actions === 1 ? "spend or output" : "spends and outputs") : p.actions === 1 ? "action" : "actions"}${p.outputsEnabled ? "" : ", outputs disabled"}`));
  }
  for (const k of tx.unknownBundles) ev.append(evidenceRow("Unknown bundle", k));
  ev.append(evidenceRow("Transparent outputs", String(tx.outputs.length)));
  card.append(ev);

  const share = el("button", "Copy a share link (txid only)", "secondary");
  share.type = "button";
  share.addEventListener("click", () => {
    const url = `${location.origin}${location.pathname}#tx=${tx.txid}`;
    navigator.clipboard.writeText(url).then(() => { share.textContent = "Link copied"; }, () => { share.textContent = url; });
  });
  card.append(share);
  result.replaceChildren(card);
  result.hidden = false;
}

async function check(txid: string, addr: AddressFacts | null, exchange: string): Promise<void> {
  button.disabled = true;
  showMessage("Reading the transaction…", "muted");
  try {
    const r = await fetchTx(txid);
    if ("busy" in r) return showMessage("The explorer is busy. Try again in a minute.");
    if ("notFound" in r) return showMessage("Blockchair has no transaction with this ID. Check it, or wait a minute if the withdrawal was just sent.");
    if ("undecoded" in r) return showMessage("Blockchair has this transaction but can't decode it yet, so this page can't read it. Try again later.");
    if ("error" in r) return showMessage(r.error);
    render(r, addr, exchange);
  } finally {
    button.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const txid = extractTxid(txidInput.value);
  if (!txid) return showMessage("That isn't a transaction ID. Paste the 64-character txid from your withdrawal, or a block explorer link to it.");
  let addr: AddressFacts | null = null;
  if (addressInput.value.trim()) {
    addr = readAddress(addressInput.value);
    if (!addr.valid) return showMessage(`That isn't a Zcash address this page can read${addr.error ? ` (${addr.error})` : ""}.`);
    if (addr.network !== "main") return showMessage("That is a testnet address. This page checks mainnet withdrawals only.");
  }
  void check(txid, addr, exchangeInput.value);
});

// A share link (#tx=…) shows the transaction's pool facts, with no address: on load, and when pasted into this tab.
function openShared(): void {
  const shared = /^#tx=([0-9a-f]{64})$/i.exec(location.hash);
  if (!shared) return;
  txidInput.value = shared[1]!.toLowerCase();
  addressInput.value = "";
  exchangeInput.value = "";
  void check(txidInput.value, null, "");
}
window.addEventListener("hashchange", openShared);
openShared();
