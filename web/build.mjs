// Builds the page into dist/: the bundled, minified script plus the page, its CSS, the Cryppit icons and the coin logo.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
await build({ entryPoints: ["web/main.ts"], bundle: true, format: "esm", target: "es2022", minify: true, outdir: "dist", legalComments: "none" });
cpSync("web/index.html", "dist/index.html");
cpSync("web/style.css", "dist/style.css");
cpSync("web/icons", "dist/icons", { recursive: true });
cpSync("web/logos", "dist/logos", { recursive: true });
console.log("built dist/");
