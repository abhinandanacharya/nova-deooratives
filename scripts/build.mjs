/**
 * Build script: compiles TypeScript → ESM / CJS / UMD using esbuild
 * Run: node scripts/build.mjs
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const banner = `/*!
 * MyLang v${pkg.version}
 * (c) ${new Date().getFullYear()} ${pkg.author}
 * Released under the MIT License
 * https://github.com/abhinandanacharya/nova-deooratives
 */`;

mkdirSync("dist", { recursive: true });

const shared = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  sourcemap: true,
  target: ["es2020", "chrome80", "firefox78", "safari14"],
  banner: { js: banner },
};

// ESM
await build({
  ...shared,
  format: "esm",
  outfile: "dist/mylang.esm.js",
});

// CJS
await build({
  ...shared,
  format: "cjs",
  outfile: "dist/mylang.cjs.js",
});

// UMD (via IIFE with internal globalName so we unwrap .default cleanly)
await build({
  ...shared,
  format: "iife",
  globalName: "__MyLangModule",
  outfile: "dist/mylang.umd.js",
  footer: {
    js: `
var MyLang = (__MyLangModule && (__MyLangModule.default || __MyLangModule.MyLang)) || __MyLangModule;
if (typeof window !== 'undefined') { window.MyLang = MyLang; }
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MyLang;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return MyLang; });
}`,
  },
});

console.log("✅ Bundles built: ESM, CJS, UMD");
