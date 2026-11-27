# Changelog

All notable changes to MyLang.js will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] — 2026-11-27

### Added & Fixed
- Renamed NPM & GitHub package to `nova-deooratives`
- Added `data-scope` and `data-var` support on `<script type="text/mylang">` for PHP, Python, Node.js, Go, and Ruby controller → view data passing
- Fixed HTML5 table foster-parenting and self-closing custom tags by normalizing to `<template data-ml-tag="...">`
- Fixed UMD bundle export so `window.MyLang.render` is directly callable
- Added React & Next.js App Router integration guide, Security threat table, and 6 Developer Guides in `docs/index.html`

---

## [1.0.0] — 2024-11-26

### Added
- 🎉 Initial public release
- Full TypeScript source with `.d.ts` declarations
- ESM, CJS, and UMD (CDN) build targets
- **Control flow tags**: `<for>`, `<while>`, `<dowhile>`, `<if>`, `<elif>`, `<else>`, `<switch>`, `<case>`, `<default>`
- **Loop modes**: `data=`, `of=`, `in=`, `range=`, classic C-style (`init`/`cond`/`step`)
- **Functional tags**: `<map>`, `<filter>`, `<reduce>`
- **Utility tags**: `<let>`, `<print>`, `<log>`, `<break>`, `<continue>`, `<repeat>`, `<each>`
- **Error handling**: `<try>`, `<catch>`, `<finally>`
- `{{ expr }}` interpolation in text nodes and HTML attributes
- Lexical scope with `<let upper>` mutation
- Secure expression evaluator with global blocklist
- LRU expression compilation cache (512 entries)
- `separator` attribute on all loops
- `save` attribute on `<map>` and `<filter>` to persist results
- Full `MyLang.config` configuration object
- `MyLang.render()`, `MyLang.evaluate()`, `MyLang.createScope()`, `MyLang.mount()` APIs
- Comprehensive test suite (Jest)
- Multi-language documentation site (EN, HI, ZH, ES)
