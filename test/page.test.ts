// The page's form must never send the address anywhere, even if its script never runs.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
const form = html.slice(html.indexOf('<form id="check"'), html.indexOf("</form>"));

describe("the check form", () => {
  it("has no named fields, so a submit without JavaScript puts nothing in the URL", () => {
    expect(form).toMatch(/<input|<textarea/);
    expect(form).not.toMatch(/\sname=/);
  });

  it("says plainly that nothing is checked or sent without JavaScript", () => {
    expect(html).toContain("<noscript>");
  });
});
