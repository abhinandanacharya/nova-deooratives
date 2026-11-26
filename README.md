# MyLang.js

<div align="center">

<img src="https://raw.githubusercontent.com/abhinandanacharya/nova-deooratives/main/docs/public/assets/logo.svg" alt="MyLang Logo" width="120" />

**HTML-tag-based scripting language**

Write `for`, `while`, `if`, `map`, `filter`, `reduce` as custom HTML tags — no build step required.

[![npm version](https://img.shields.io/npm/v/mylang-js?color=7c3aed&style=flat-square)](https://www.npmjs.com/package/nova-deooratives)
[![bundle size](https://img.shields.io/bundlephobia/minzip/mylang-js?color=06b6d4&style=flat-square)](https://bundlephobia.com/package/mylang-js)
[![license](https://img.shields.io/npm/l/mylang-js?color=34d399&style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6?style=flat-square)](https://www.typescriptlang.org/)

[📖 Docs](https://abhinandanacharya.github.io/nova-deooratives) · [🚀 Playground](https://abhinandanacharya.github.io/nova-deooratives/playground) · [📦 NPM](https://npmjs.com/package/nova-deooratives) · [🌐 CDN](https://cdn.jsdelivr.net/npm/nova-deooratives/dist/mylang.umd.min.js)

</div>

---

## ✨ What is MyLang?

MyLang lets you write complex logic inside HTML files using familiar tag-like syntax — without a framework, build tool, or server. It's ideal for:

- 🛠 **Rapid prototyping** — no webpack, no JSX, just a `<script>` tag
- 📄 **Static HTML templates** — with real loops and conditionals
- 📚 **Teaching programming** — visual, readable, beginner-friendly syntax
- 🎨 **Email/document generation** — logic-driven HTML output

---

## 🚀 Quick Start

### Via CDN (zero setup)

```html
<!-- jsDelivr (GitHub — instant after git push) -->
<script src="https://cdn.jsdelivr.net/gh/abhinandanacharya/nova-deooratives@main/dist/mylang.umd.min.js"></script>

<!-- jsDelivr (NPM) -->
<script src="https://cdn.jsdelivr.net/npm/nova-deooratives@1.0.0/dist/mylang.umd.min.js"></script>
```

<script type="text/mylang">
  <for data="array(1,2,3,4,5)" as="n">
    <h2>Item {{ n }}</h2>
  </for>
</script>
```

That's it. MyLang auto-runs when the page loads.

### Via NPM

```bash
npm install nova-deooratives
```

```ts
// ESM / TypeScript
import MyLang from "nova-deooratives";

MyLang.render(
  `<for of="users" as="u"><p>{{ u.name }}</p></for>`,
  document.getElementById("output")!,
  { scope: { users: [{ name: "Alice" }, { name: "Bob" }] } }
);
```

```js
// CommonJS
const { MyLang } = require("nova-deooratives");
```

---

## 🌐 Multi-Language Backend Integrations (PHP, Python, Node.js, Go, Ruby)

Pass arrays or objects from any backend controller into your view using `data-scope='...'` (JSON) or `data-var="GLOBAL_NAME"`.

### PHP / Laravel (Controller → View Table)

```php
<?php
// Controller passes $users to the view
$json = json_encode(["users" => $users], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT);
?>

<script src="https://cdn.jsdelivr.net/npm/nova-deooratives/dist/mylang.umd.min.js"></script>

<script type="text/mylang" data-scope='<?= $json ?>'>
  <table>
    <tr><th>#</th><th>Name</th><th>Role</th><th>Status</th></tr>
    <for of="users" as="u" index="i">
      <tr>
        <td>{{ i + 1 }}</td>
        <td>{{ u.name }}</td>
        <td>{{ u.role }}</td>
        <td><if cond="u.active">Active<else>Inactive</else></if></td>
      </tr>
    </for>
  </table>
</script>
```

### Python (Flask / Django)

```html
<script type="text/mylang" data-scope='{{ payload | safe }}'>
  <for of="products" as="p">
    <tr><td>{{ p.name }}</td><td>${{ p.price }}</td></tr>
  </for>
</script>
```

### Global Variable (`data-var`) for Go / Ruby / SSR

```html
<script>window.PAGE_DATA = { items: [{ name: "Item A" }, { name: "Item B" }] };</script>
<script type="text/mylang" data-var="PAGE_DATA">
  <for of="items" as="item"><li>{{ item.name }}</li></for>
</script>
```

---

## 🏷️ Tag Reference

### Variables

| Tag | Description | Example |
|-----|-------------|---------|
| `<let>` | Declare / assign a variable | `<let name="x" value="42" />` |
| `<let upper>` | Assign in parent scope (for loops) | `<let name="x" value="x+1" upper />` |
| `<print>` | Output an expression | `<print value="x * 2" />` |
| `{{ expr }}` | Inline interpolation | `<p>Hello {{ name }}!</p>` |
| `<log>` | Console.log | `<log value="arr" />` |

### Loops

| Tag | Mode | Example |
|-----|------|---------|
| `<for data="...">` | Array / object iteration | `<for data="array(1,2,3)" as="n">` |
| `<for of="...">` | for-of (iterable) | `<for of="items" as="x" index="i">` |
| `<for in="...">` | for-in (object keys) | `<for in="obj" as="key">` |
| `<for range="s,e,step">` | Range shorthand | `<for range="0,10,2" as="i">` |
| `<for init cond step>` | Classic C-style | `<for init="i=0" cond="i<5" step="i++">` |
| `<each of="...">` | Shorthand for-of | `<each of="users" as="u" index="i">` |
| `<while cond="...">` | While loop | `<while cond="x < 10">` |
| `<dowhile cond="...">` | Do-while | `<dowhile cond="x < 5">` |
| `<repeat times="N">` | Repeat N times | `<repeat times="5" index="i">` |

> All loops support: `separator=", "` · `<break />` · `<continue />`

### Conditionals

| Tag | Description | Example |
|-----|-------------|---------|
| `<if cond="...">` | If | `<if cond="x > 5">` |
| `<elif cond="...">` | Else-if (inside `<if>`) | `<elif cond="x > 2">` |
| `<else>` | Else (inside `<if>`) | `<else>` |
| `<switch value="...">` | Switch | `<switch value="day">` |
| `<case match="...">` | Case (inside `<switch>`) | `<case match="'fri'">` |
| `<default>` | Default (inside `<switch>`) | `<default>` |

### Functional

| Tag | Equivalent | Key Attributes |
|-----|------------|---------------|
| `<map>` | `Array.map()` | `data`, `as`, `index`, `separator`, `save` |
| `<filter>` | `Array.filter()` | `data`, `where`, `as`, `save` |
| `<reduce>` | `Array.reduce()` | `data`, `acc`, `init`, `item`, `expr`, `save` |

### Error handling

```html
<try>
  <print value="riskyCall()" />
  <catch as="err">
    <p>Error: {{ err }}</p>
  </catch>
  <finally>
    <p>Always runs</p>
  </finally>
</try>
```

---

## 🔐 Security

MyLang's expression evaluator uses a **strict allowlist** to prevent XSS and code injection:

- ❌ Blocked: `window`, `document`, `eval`, `Function`, `fetch`, `localStorage`, `crypto`, `setTimeout`, `XMLHttpRequest`, and 20+ other dangerous globals
- ✅ Allowed: `Math`, `Array`, `Object`, `String`, `Number`, `Boolean`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, and MyLang builtins (`array`, `range`, `len`, `str`, `num`, `json`, `parse`, etc.)
- 🔒 All expressions are compiled with `"use strict"` and isolated scope
- 🛡️ Prototype poisoning prevented via `Object.create(null)` scopes
- 📦 No `innerHTML` written from user expressions — only DOM text nodes

---

## ⚙️ Configuration

```js
import MyLang from "nova-deooratives";

// Global config
MyLang.config = {
  maxIterations: 50_000,       // safety cap for loops
  warnOnError: true,           // log expression errors to console
  delimiters: ["{{", "}}"],    // interpolation delimiters
  onError(err) {               // custom error handler
    console.error("[MyLang Error]", err.message, err.expression);
  },
};
```

---

## 🔧 JavaScript API

```ts
// Render template into element
MyLang.render(templateHTML: string, container: Element, options?: RenderOptions): void

// Evaluate an expression
MyLang.evaluate(expr: string, scope?: Record<string, unknown>): unknown

// Create a scope manually
MyLang.createScope(parent?: IScope | null, initial?: Record<string, unknown>): IScope

// Manually trigger auto-mount (for dynamically added scripts)
MyLang.mount(): void

// Version
MyLang.version // "1.0.0"
```

---

## 🌐 Built-in Helpers (available in all expressions)

| Helper | Description | Example |
|--------|-------------|---------|
| `array(...)` | Create array | `array(1, 2, 3)` |
| `range(s, e, step?)` | Numeric range | `range(0, 10, 2)` |
| `len(v)` | Length of array/string/object | `len(arr)` |
| `keys(obj)` | Object.keys | `keys(user)` |
| `values(obj)` | Object.values | `values(config)` |
| `entries(obj)` | Object.entries | `entries(map)` |
| `str(v)` | String() | `str(42)` |
| `num(v)` | Number() | `num("3.14")` |
| `bool(v)` | Boolean() | `bool(0)` |
| `json(v)` | JSON.stringify | `json(obj)` |
| `parse(s)` | JSON.parse | `parse(text)` |
| `Math` | Full Math object | `Math.sqrt(16)` |

---

## 📦 Bundle Sizes

| Format | Size (min+gzip) |
|--------|----------------|
| UMD (CDN) | ~8 KB |
| ESM | ~7 KB |
| CJS | ~7 KB |

---

## 🗺️ Roadmap

- [ ] `<function>` tag (define reusable templates)
- [ ] `<import>` tag (include external templates)
- [ ] DevTools browser extension
- [ ] React/Vue/Svelte adapters
- [ ] Server-side rendering (Node.js JSDOM)
- [ ] VSCode language extension with syntax highlighting

---

## 🤝 Contributing

Pull requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
git clone https://github.com/abhinandanacharya/nova-deooratives
cd mylang-js
npm install
npm run dev      # watch mode
npm test         # run tests
npm run build    # production build
```

---

## 📄 License

MIT © [abhinandanacharya](https://github.com/abhinandanacharya)
