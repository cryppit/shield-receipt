// The page's form must never send the address anywhere, even if its script never runs; and the page carries the same
// brand pieces as the other Cryppit sites (logos with their licence, share image, motion that respects the viewer).
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const web = (path: string): URL => new URL(`../web/${path}`, import.meta.url);
const html = readFileSync(web("index.html"), "utf8");
const css = readFileSync(web("style.css"), "utf8");
const build = readFileSync(web("build.mjs"), "utf8");
const form = html.slice(html.indexOf('<form id="check-form"'), html.indexOf("</form>"));

describe("the check form", () => {
  it("has no named fields, so a submit without JavaScript puts nothing in the URL", () => {
    expect(form).toMatch(/<input|<textarea/);
    expect(form).not.toMatch(/\sname=/);
  });

  it("says plainly that nothing is checked or sent without JavaScript", () => {
    expect(html).toContain("<noscript>");
  });

  it("lets the page talk only to Blockchair and submit nowhere", () => {
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1] ?? "";
    expect(csp).toContain("connect-src https://api.blockchair.com");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
  });
});

describe("the brand pieces", () => {
  const localRefs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]!);

  it("ships every file the page points to, and the build copies each folder", () => {
    expect(localRefs).toContain("logos/zec.svg");
    for (const ref of localRefs) {
      // main.js is the bundle esbuild writes from main.ts.
      expect(existsSync(web(ref === "main.js" ? "main.ts" : ref)), ref).toBe(true);
      const folder = ref.split("/")[0]!;
      if (ref.includes("/")) expect(build, folder).toContain(`"web/${folder}"`);
    }
  });

  it("keeps the logo licence next to the logos and credits it on the page", () => {
    expect(readFileSync(web("logos/LICENSE"), "utf8")).toContain("MIT License");
    expect(html).toContain("web3icons (MIT)");
  });

  it("says it is independent of the Zcash organisations and the exchanges", () => {
    expect(html).toMatch(/not affiliated with[^<]*Zcash[^<]*exchange/i);
  });

  it("has a 1200×630 share image for X and Telegram", () => {
    expect(html).toContain('<meta property="og:image" content="https://cryppit.github.io/shield-receipt/icons/og.png">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    const png = readFileSync(web("icons/og.png"));
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it("stops every animation for viewers who ask for less motion", () => {
    expect(css).toMatch(/@keyframes/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \*, \*::before, \*::after \{ animation: none !important; transition: none !important; \} \}/);
  });

  it("sets no inline styles, which the page's security policy would block", () => {
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).not.toContain("<style");
  });
});
