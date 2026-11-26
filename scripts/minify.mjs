/**
 * Minification script: creates .min.js versions using esbuild
 * Run: node scripts/minify.mjs
 */
import { build } from "esbuild";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const banner = `/*! MyLang v${pkg.version} | MIT | https://github.com/abhinandanacharya/nova-deooratives */`;

const files = [
  { in: "dist/mylang.esm.js",  out: "dist/mylang.esm.min.js",  format: "esm" },
  { in: "dist/mylang.cjs.js",  out: "dist/mylang.cjs.min.js",  format: "cjs" },
  { in: "dist/mylang.umd.js",  out: "dist/mylang.umd.min.js",  format: "iife" },
];

for (const f of files) {
  await build({
    entryPoints: [f.in],
    outfile: f.out,
    minify: true,
    sourcemap: true,
    banner: { js: banner },
    allowOverwrite: true,
  });
}

console.log("✅ Minified: .esm.min.js, .cjs.min.js, .umd.min.js");
