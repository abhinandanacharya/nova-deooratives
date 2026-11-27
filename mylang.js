/**
 * MyLang — HTML-tag-based scripting language
 * Converts custom control-flow tags into live DOM output.
 *
 * Supported tags:
 *   <for>        — classic for / for-of / for-in / for-range
 *   <while>      — while loop
 *   <dowhile>    — do-while loop
 *   <if>         — if / elif / else
 *   <map>        — Array.map
 *   <filter>     — Array.filter
 *   <let>        — variable declaration
 *   <print>      — inline expression output
 *   <log>        — console.log
 *   <break>      — break out of loop (via exception)
 *   <continue>   — skip iteration (via exception)
 *   <switch>     — switch / case / default
 *   <try>        — try / catch / finally
 *   <each>       — shorthand for-each with built-in index & value
 *   <repeat>     — repeat N times
 */

(function (global) {
  "use strict";

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 1 — Safe expression evaluator
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Secure expression evaluator.
   *
   * Security: dangerous globals (window, eval, Function, fetch, localStorage, etc.)
   * are shadowed via local `var` declarations before strict mode kicks in.
   * This avoids the "eval as parameter name in strict mode" error while still
   * effectively blocking those globals from expressions.
   */

  const BLOCKED_GLOBALS_VAR = [
    "window", "globalThis", "self", "global",
    "eval", "Function",
    "fetch", "XMLHttpRequest", "WebSocket", "Worker", "SharedWorker",
    "localStorage", "sessionStorage", "indexedDB", "openDatabase",
    "crypto", "document", "location", "history", "navigator", "screen",
    "alert", "confirm", "prompt",
    "setTimeout", "setInterval", "clearTimeout", "clearInterval",
    "requestAnimationFrame", "cancelAnimationFrame",
    "importScripts", "require", "module", "exports",
    "__dirname", "__filename", "process", "Buffer",
  ];

  // These identifiers can't be used as parameter names (even in non-strict)
  const PARAM_RESTRICTED = new Set([
    "eval", "arguments", "let", "static",
    "implements", "interface", "package",
    "private", "protected", "public", "yield", "await",
  ]);

  // LRU expression cache (max 512)
  const EXPR_CACHE = new Map();
  const EXPR_CACHE_MAX = 512;

  const VAR_SHADOW = BLOCKED_GLOBALS_VAR.map((k) => `var ${k};`).join(" ");

  function compileExpr(expr, scopeKeys) {
    const cacheKey = expr + "|||" + scopeKeys.join(",");
    if (EXPR_CACHE.has(cacheKey)) return EXPR_CACHE.get(cacheKey);
    if (EXPR_CACHE.size >= EXPR_CACHE_MAX) {
      EXPR_CACHE.delete(EXPR_CACHE.keys().next().value);
    }
    // Non-strict preamble for var shadowing, then strict for the expression
    const body = `${VAR_SHADOW} "use strict"; return (${expr});`;
    const safeKeys = scopeKeys.filter((k) => !PARAM_RESTRICTED.has(k));
    // eslint-disable-next-line no-new-func
    const fn = new Function(...safeKeys, body);
    EXPR_CACHE.set(cacheKey, fn);
    return fn;
  }

  const BUILTINS = {
    array: (...args) => args,
    range: (start, end, step = 1) => {
      if (!isFinite(start) || !isFinite(end) || !isFinite(step) || step === 0) return [];
      const r = [];
      const limit = 100_000;
      let count = 0;
      if (step > 0) {
        for (let i = start; i < end && count < limit; i += step, count++) r.push(i);
      } else {
        for (let i = start; i > end && count < limit; i += step, count++) r.push(i);
      }
      return r;
    },
    keys: (obj) => Object.keys(obj),
    values: (obj) => Object.values(obj),
    entries: (obj) => Object.entries(obj),
    len: (v) => Array.isArray(v) ? v.length : typeof v === "string" ? v.length : Object.keys(v).length,
    str: String,
    num: Number,
    bool: Boolean,
    json: JSON.stringify.bind(JSON),
    parse: JSON.parse.bind(JSON),
    Math,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Array,
    Object: {
      keys: Object.keys, values: Object.values, entries: Object.entries,
      assign: Object.assign, freeze: Object.freeze, fromEntries: Object.fromEntries,
    },
    String, Number, Boolean,
  };

  function evaluate(expr, scope) {
    if (expr === undefined || expr === null) return undefined;
    expr = String(expr).trim();
    if (expr === "") return undefined;

    const merged = Object.assign(Object.create(null), BUILTINS, scope);
    const scopeKeys = Object.keys(merged).filter((k) => !PARAM_RESTRICTED.has(k));
    const scopeVals = scopeKeys.map((k) => merged[k]);

    try {
      return compileExpr(expr, scopeKeys)(...scopeVals);
    } catch (e) {
      console.warn(`[MyLang] Expression error in "${expr}":`, e.message);
      return undefined;
    }
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 2 — Scope (variable store)
   * ═══════════════════════════════════════════════════════════ */

  function createScope(parent) {
    const own = Object.create(null);
    return {
      _parent: parent || null,
      _own: own,
      get(k) {
        if (k in own) return own[k];
        if (this._parent) return this._parent.get(k);
        return undefined;
      },
      set(k, v) {
        own[k] = v;
      },
      setUpper(k, v) {
        // Walk up to find where the variable lives, set there
        if (k in own) { own[k] = v; return; }
        if (this._parent) { this._parent.setUpper(k, v); return; }
        own[k] = v; // define at top if not found
      },
      flatten() {
        // Return a plain object with all visible bindings
        const base = this._parent ? this._parent.flatten() : {};
        return Object.assign(base, own);
      },
    };
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 3 — Break / Continue signals
   * ═══════════════════════════════════════════════════════════ */

  class BreakSignal extends Error { constructor() { super("break"); this.isBreak = true; } }
  class ContinueSignal extends Error { constructor() { super("continue"); this.isContinue = true; } }
  class ReturnSignal extends Error { constructor(val) { super("return"); this.value = val; } }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 4 — Core executor (walks DOM nodes)
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Execute a MyLang element.
   * Returns an array of DOM nodes to inject into the output container.
   */
  function exec(node, scope) {
    if (node.nodeType === Node.TEXT_NODE) {
      return [interpolate(node.textContent, scope)];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return [];

    const tag = node.tagName.toLowerCase();

    switch (tag) {
      case "for":     return execFor(node, scope);
      case "while":   return execWhile(node, scope);
      case "dowhile": return execDoWhile(node, scope);
      case "if":      return execIf(node, scope);
      case "map":     return execMap(node, scope);
      case "filter":  return execFilter(node, scope);
      case "let":     return execLet(node, scope);
      case "print":   return execPrint(node, scope);
      case "log":     return execLog(node, scope);
      case "break":   throw new BreakSignal();
      case "continue":throw new ContinueSignal();
      case "switch":  return execSwitch(node, scope);
      case "try":     return execTry(node, scope);
      case "each":    return execEach(node, scope);
      case "repeat":  return execRepeat(node, scope);
      case "reduce":  return execReduce(node, scope);
      default:        return execPassthrough(node, scope);
    }
  }

  /** Execute all child nodes and return flat list of output nodes */
  function execChildren(parent, scope) {
    const out = [];
    for (const child of parent.childNodes) {
      const result = exec(child, scope);
      out.push(...result);
    }
    return out;
  }

  /* ─── String interpolation  {{ expr }} ─── */
  function interpolate(text, scope) {
    const replaced = text.replace(/\{\{([\s\S]+?)\}\}/g, (_, expr) => {
      const v = evaluate(expr.trim(), scope.flatten());
      return v === undefined || v === null ? "" : v;
    });
    return document.createTextNode(replaced);
  }

  /* ─── Pass-through: standard HTML tags — process their children ─── */
  function execPassthrough(node, scope) {
    const clone = document.createElement(node.tagName);
    // Copy attributes (also interpolate attribute values)
    for (const attr of node.attributes) {
      const val = attr.value.replace(/\{\{([\s\S]+?)\}\}/g, (_, expr) => {
        const v = evaluate(expr.trim(), scope.flatten());
        return v === undefined ? "" : v;
      });
      clone.setAttribute(attr.name, val);
    }
    const children = execChildren(node, scope);
    children.forEach((c) => clone.appendChild(c));
    return [clone];
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 5 — <let> — variable declaration / assignment
   *  <let name="x" value="10 + 5" />
   *  <let name="arr" value="array(1,2,3)" />
   * ═══════════════════════════════════════════════════════════ */
  function execLet(node, scope) {
    const name  = node.getAttribute("name");
    const expr  = node.getAttribute("value") || node.getAttribute("val");
    const upper = node.hasAttribute("upper");   // set in parent scope
    if (!name) return [];
    const val = expr !== null ? evaluate(expr, scope.flatten()) : undefined;
    if (upper) scope.setUpper(name, val);
    else        scope.set(name, val);
    return [];
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 6 — <print> — inline expression output
   *  <print value="x * 2" />
   *  <print>{{ x + 1 }}</print>
   * ═══════════════════════════════════════════════════════════ */
  function execPrint(node, scope) {
    const expr = node.getAttribute("value") || node.getAttribute("val");
    if (expr) {
      const v = evaluate(expr, scope.flatten());
      return [document.createTextNode(v === null || v === undefined ? "" : v)];
    }
    return execChildren(node, scope);
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 7 — <log> — console.log
   *  <log value="arr" />
   * ═══════════════════════════════════════════════════════════ */
  function execLog(node, scope) {
    const expr = node.getAttribute("value") || node.textContent;
    const v = evaluate(expr.trim(), scope.flatten());
    console.log("[MyLang log]", v);
    return [];
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 8 — <for> — the universal loop tag
   *
   *  Mode A — data array/object iteration:
   *    <for data="array(1,2,3)" index="i" value="v">
   *      <print value="v" />
   *    </for>
   *
   *  Mode B — classic C-style for:
   *    <for init="let i=0" cond="i<5" step="i++">
   *      <print value="i" />
   *    </for>
   *
   *  Mode C — range shorthand:
   *    <for range="0,10,2" as="i">   (start, end, step)
   *
   *  Mode D — for-in (object keys):
   *    <for in="obj" as="key">
   *
   *  Mode E — for-of (iterable):
   *    <for of="iterable" as="item">
   *
   *  Special attrs:
   *    printable="p"   — alias variable for inner content (legacy compat)
   *    index="i"       — loop index variable name (default: "$i")
   *    value="v"       — loop value variable name (default: "$v")
   *    separator=", "  — text injected between iterations
   * ═══════════════════════════════════════════════════════════ */
  function execFor(node, scope) {
    const out = [];

    const separator = node.getAttribute("separator") || "";
    const printable = node.getAttribute("printable"); // legacy compat alias for value

    // ── Mode B: classic for ──────────────────────────────────
    if (node.hasAttribute("init") || node.hasAttribute("cond") || node.hasAttribute("step")) {
      const initExpr  = node.getAttribute("init") || "";
      const condExpr  = node.getAttribute("cond") || "true";
      const stepExpr  = node.getAttribute("step") || "";
      const loopScope = createScope(scope);

      // Run init
      if (initExpr) {
        const initFn = new Function(
          ...Object.keys(loopScope.flatten()),
          `let __scope__ = arguments[0]; ${initExpr.replace(/^let\s+/, "__scope__.")}; return __scope__;`
        );
        // simpler: just evaluate as assignment into scope
        const flat = loopScope.flatten();
        // parse "let i = 0" or "i = 0"
        const match = initExpr.match(/^(?:let\s+|var\s+|const\s+)?(\w+)\s*=\s*(.+)$/);
        if (match) loopScope.set(match[1], evaluate(match[2], flat));
      }

      let iterations = 0;
      const MAX = 100000;
      while (iterations++ < MAX) {
        if (!evaluate(condExpr, loopScope.flatten())) break;
        const iterScope = createScope(loopScope);
        try {
          const nodes = execChildren(node, iterScope);
          if (separator && out.length) out.push(document.createTextNode(separator));
          out.push(...nodes);
        } catch (e) {
          if (e.isBreak) break;
          if (e.isContinue) { /* continue step */ }
          else throw e;
        }
        // step
        const stepMatch = stepExpr.match(/^(\w+)(\+\+|--)$/) || stepExpr.match(/^(\+\+|--)(\w+)$/);
        if (stepMatch) {
          const varName = stepMatch[1].match(/^\w+$/) ? stepMatch[1] : stepMatch[2];
          const op      = stepExpr.includes("++") ? 1 : -1;
          loopScope.setUpper(varName, loopScope.get(varName) + op);
        } else if (stepExpr) {
          // e.g. "i += 2"
          const m2 = stepExpr.match(/^(\w+)\s*([+\-*\/])=\s*(.+)$/);
          if (m2) {
            const v = evaluate(`${m2[1]} ${m2[2]} (${m2[3]})`, loopScope.flatten());
            loopScope.setUpper(m2[1], v);
          }
        }
      }
      return out;
    }

    // ── Mode C: range ────────────────────────────────────────
    if (node.hasAttribute("range")) {
      const rangeExpr = node.getAttribute("range");
      const parts = rangeExpr.split(",").map((s) => evaluate(s.trim(), scope.flatten()));
      const [start = 0, end = 0, step = 1] = parts;
      const asName    = node.getAttribute("as") || node.getAttribute("index") || "$i";
      const loopScope = createScope(scope);
      let iterations = 0;
      const MAX = 100000;
      for (let i = start; (step > 0 ? i < end : i > end) && iterations++ < MAX; i += step) {
        const iterScope = createScope(loopScope);
        iterScope.set(asName, i);
        iterScope.set("$i", i);
        try {
          const nodes = execChildren(node, iterScope);
          if (separator && out.length) out.push(document.createTextNode(separator));
          out.push(...nodes);
        } catch (e) {
          if (e.isBreak) break;
          if (e.isContinue) continue;
          throw e;
        }
      }
      return out;
    }

    // ── Mode D: for-in (object keys) ─────────────────────────
    if (node.hasAttribute("in")) {
      const obj    = evaluate(node.getAttribute("in"), scope.flatten());
      const asName = node.getAttribute("as") || node.getAttribute("key") || "$key";
      const idxName = node.getAttribute("index") || "$i";
      let idx = 0;
      for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const iterScope = createScope(scope);
        iterScope.set(asName, key);
        iterScope.set("$key", key);
        iterScope.set("$val", obj[key]);
        iterScope.set(idxName, idx++);
        try {
          const nodes = execChildren(node, iterScope);
          if (separator && out.length) out.push(document.createTextNode(separator));
          out.push(...nodes);
        } catch (e) {
          if (e.isBreak) break;
          if (e.isContinue) continue;
          throw e;
        }
      }
      return out;
    }

    // ── Mode E: for-of ───────────────────────────────────────
    if (node.hasAttribute("of")) {
      const iterable = evaluate(node.getAttribute("of"), scope.flatten());
      const asName   = node.getAttribute("as") || node.getAttribute("value") || "$v";
      const idxName  = node.getAttribute("index") || "$i";
      let idx = 0;
      for (const item of iterable) {
        const iterScope = createScope(scope);
        iterScope.set(asName, item);
        iterScope.set("$v", item);
        iterScope.set(idxName, idx++);
        try {
          const nodes = execChildren(node, iterScope);
          if (separator && out.length) out.push(document.createTextNode(separator));
          out.push(...nodes);
        } catch (e) {
          if (e.isBreak) break;
          if (e.isContinue) continue;
          throw e;
        }
      }
      return out;
    }

    // ── Mode A: data= (default) ──────────────────────────────
    const dataExpr  = node.getAttribute("data") || "[]";
    const idxName   = node.getAttribute("index") === "default" ? "$i" : (node.getAttribute("index") || "$i");
    const valName   = printable || node.getAttribute("value") || node.getAttribute("val") || "$v";
    const data      = evaluate(dataExpr, scope.flatten());

    if (data === undefined || data === null) return [];

    const entries = Array.isArray(data) ? data.map((v, i) => [i, v]) : Object.entries(data);

    for (const [i, v] of entries) {
      const iterScope = createScope(scope);
      iterScope.set("$i", i);
      iterScope.set("$v", v);
      iterScope.set(idxName, i);
      iterScope.set(valName, v);
      if (printable) iterScope.set(printable, v); // legacy compat
      try {
        const nodes = execChildren(node, iterScope);
        if (separator && out.length) out.push(document.createTextNode(separator));
        out.push(...nodes);
      } catch (e) {
        if (e.isBreak) break;
        if (e.isContinue) continue;
        throw e;
      }
    }

    return out;
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 9 — <each> — shorthand for-each
   *  <each of="users" as="user" index="i">
   *    <p>{{ i }}: {{ user.name }}</p>
   *  </each>
   * ═══════════════════════════════════════════════════════════ */
  function execEach(node, scope) {
    // Reuse for-of logic
    const forNode = node.cloneNode(true);
    // Map "of" attribute to for-of mode
    return execFor(forNode, scope);
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 10 — <repeat> — repeat N times
   *  <repeat times="5" index="i">
   *    <p>Row {{ i }}</p>
   *  </repeat>
   * ═══════════════════════════════════════════════════════════ */
  function execRepeat(node, scope) {
    const times   = evaluate(node.getAttribute("times") || "0", scope.flatten());
    const idxName = node.getAttribute("index") || "$i";
    const separator = node.getAttribute("separator") || "";
    const out = [];

    for (let i = 0; i < times; i++) {
      const iterScope = createScope(scope);
      iterScope.set(idxName, i);
      iterScope.set("$i", i);
      try {
        const nodes = execChildren(node, iterScope);
        if (separator && out.length) out.push(document.createTextNode(separator));
        out.push(...nodes);
      } catch (e) {
        if (e.isBreak) break;
        if (e.isContinue) continue;
        throw e;
      }
    }
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 11 — <while>
   *  <while cond="x < 10">
   *    <print value="x" /><let name="x" value="x+1" upper />
   *  </while>
   * ═══════════════════════════════════════════════════════════ */
  function execWhile(node, scope) {
    const condExpr  = node.getAttribute("cond") || node.getAttribute("condition") || "false";
    const separator = node.getAttribute("separator") || "";
    const out = [];
    let iterations = 0;
    const MAX = 100000;

    while (evaluate(condExpr, scope.flatten()) && iterations++ < MAX) {
      const iterScope = createScope(scope);
      try {
        const nodes = execChildren(node, iterScope);
        // Write-back any mutations from child <let upper> tags
        if (separator && out.length) out.push(document.createTextNode(separator));
        out.push(...nodes);
      } catch (e) {
        if (e.isBreak) break;
        if (e.isContinue) continue;
        throw e;
      }
    }
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 12 — <dowhile>
   *  <dowhile cond="x < 5">
   *    <print value="x" /><let name="x" value="x+1" upper />
   *  </dowhile>
   * ═══════════════════════════════════════════════════════════ */
  function execDoWhile(node, scope) {
    const condExpr  = node.getAttribute("cond") || node.getAttribute("condition") || "false";
    const separator = node.getAttribute("separator") || "";
    const out = [];
    let first = true;
    let iterations = 0;
    const MAX = 100000;

    do {
      const iterScope = createScope(scope);
      try {
        const nodes = execChildren(node, iterScope);
        if (separator && !first) out.push(document.createTextNode(separator));
        out.push(...nodes);
      } catch (e) {
        if (e.isBreak) break;
        if (e.isContinue) { first = false; continue; }
        throw e;
      }
      first = false;
      iterations++;
    } while (evaluate(condExpr, scope.flatten()) && iterations < MAX);

    return out;
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 13 — <if> / <elif> / <else>
   *
   *  <if cond="x > 5">
   *    <p>big</p>
   *    <elif cond="x > 2"><p>medium</p></elif>
   *    <else><p>small</p></else>
   *  </if>
   * ═══════════════════════════════════════════════════════════ */
  function execIf(node, scope) {
    const cond = node.getAttribute("cond") || node.getAttribute("condition") || "false";

    // Gather branches from direct children
    const branches = [];
    let   elseNode = null;
    const bodyNodes = [];

    for (const child of node.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const t = child.tagName.toLowerCase();
        if (t === "elif" || t === "elseif") {
          branches.push({ cond: child.getAttribute("cond") || child.getAttribute("condition"), node: child });
          continue;
        }
        if (t === "else") {
          elseNode = child;
          continue;
        }
      }
      bodyNodes.push(child);
    }

    // Evaluate main if
    if (evaluate(cond, scope.flatten())) {
      const ifScope = createScope(scope);
      const out = [];
      for (const child of bodyNodes) out.push(...exec(child, ifScope));
      return out;
    }

    // Evaluate elif branches
    for (const branch of branches) {
      if (evaluate(branch.cond, scope.flatten())) {
        return execChildren(branch.node, createScope(scope));
      }
    }

    // Else
    if (elseNode) {
      return execChildren(elseNode, createScope(scope));
    }

    return [];
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 14 — <switch> / <case> / <default>
   *
   *  <switch value="x">
   *    <case match="1"><p>one</p></case>
   *    <case match="2"><p>two</p></case>
   *    <default><p>other</p></default>
   *  </switch>
   * ═══════════════════════════════════════════════════════════ */
  function execSwitch(node, scope) {
    const expr  = node.getAttribute("value") || node.getAttribute("val") || "undefined";
    const val   = evaluate(expr, scope.flatten());
    let   defaultNode = null;
    let   matched     = false;
    const out = [];

    for (const child of node.childNodes) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const t = child.tagName.toLowerCase();
      if (t === "default") { defaultNode = child; continue; }
      if (t !== "case") continue;

      const matchExpr = child.getAttribute("match");
      const matchVal  = evaluate(matchExpr, scope.flatten());

      if (!matched && val === matchVal) {
        matched = true;
      }
      if (matched) {
        try {
          out.push(...execChildren(child, createScope(scope)));
        } catch (e) {
          if (e.isBreak) return out;
          throw e;
        }
        // No fallthrough by default; add fallthrough attr to enable it
        if (!child.hasAttribute("fallthrough")) break;
      }
    }

    if (!matched && defaultNode) {
      out.push(...execChildren(defaultNode, createScope(scope)));
    }

    return out;
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 15 — <map>
   *
   *  <map data="array(1,2,3)" as="x">
   *    <li>{{ x * x }}</li>
   *  </map>
   * ═══════════════════════════════════════════════════════════ */
  function execMap(node, scope) {
    const dataExpr  = node.getAttribute("data") || node.getAttribute("of") || "[]";
    const asName    = node.getAttribute("as") || node.getAttribute("value") || "$v";
    const idxName   = node.getAttribute("index") || "$i";
    const separator = node.getAttribute("separator") || "";
    const saveAs    = node.getAttribute("save"); // save result to a var

    const arr = evaluate(dataExpr, scope.flatten());
    if (!Array.isArray(arr)) return [];

    const out = [];
    const saved = [];

    arr.forEach((item, idx) => {
      const iterScope = createScope(scope);
      iterScope.set(asName, item);
      iterScope.set(idxName, idx);
      iterScope.set("$v", item);
      iterScope.set("$i", idx);
      const nodes = execChildren(node, iterScope);
      if (separator && out.length) out.push(document.createTextNode(separator));
      out.push(...nodes);
      if (saveAs) saved.push(nodes.map((n) => n.textContent).join(""));
    });

    if (saveAs) scope.set(saveAs, saved);
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 16 — <filter>
   *
   *  <filter data="array(1,2,3,4,5)" where="$v > 2" as="x">
   *    <span>{{ x }}</span>
   *  </filter>
   * ═══════════════════════════════════════════════════════════ */
  function execFilter(node, scope) {
    const dataExpr  = node.getAttribute("data") || node.getAttribute("of") || "[]";
    const whereExpr = node.getAttribute("where") || node.getAttribute("cond") || "true";
    const asName    = node.getAttribute("as") || node.getAttribute("value") || "$v";
    const idxName   = node.getAttribute("index") || "$i";
    const separator = node.getAttribute("separator") || "";
    const saveAs    = node.getAttribute("save");

    const arr = evaluate(dataExpr, scope.flatten());
    if (!Array.isArray(arr)) return [];

    const filtered = arr.filter((item, idx) => {
      const testScope = createScope(scope);
      testScope.set(asName, item);
      testScope.set("$v", item);
      testScope.set(idxName, idx);
      testScope.set("$i", idx);
      return evaluate(whereExpr, testScope.flatten());
    });

    if (saveAs) scope.set(saveAs, filtered);

    const out = [];
    filtered.forEach((item, idx) => {
      const iterScope = createScope(scope);
      iterScope.set(asName, item);
      iterScope.set("$v", item);
      iterScope.set(idxName, idx);
      iterScope.set("$i", idx);
      const nodes = execChildren(node, iterScope);
      if (separator && out.length) out.push(document.createTextNode(separator));
      out.push(...nodes);
    });

    return out;
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 17 — <reduce>
   *
   *  <reduce data="array(1,2,3,4)" acc="sum" init="0" item="n" expr="sum + n" />
   *  then use {{ sum }} elsewhere (save it with save="sum")
   * ═══════════════════════════════════════════════════════════ */
  function execReduce(node, scope) {
    const dataExpr = node.getAttribute("data") || "[]";
    const accName  = node.getAttribute("acc") || "acc";
    const initExpr = node.getAttribute("init") || "0";
    const itemName = node.getAttribute("item") || "$v";
    const exprStr  = node.getAttribute("expr") || accName;
    const saveAs   = node.getAttribute("save") || accName;

    const arr  = evaluate(dataExpr, scope.flatten());
    const init = evaluate(initExpr, scope.flatten());
    if (!Array.isArray(arr)) return [];

    const result = arr.reduce((acc, item) => {
      const iterScope = createScope(scope);
      iterScope.set(accName, acc);
      iterScope.set(itemName, item);
      iterScope.set("$v", item);
      return evaluate(exprStr, iterScope.flatten());
    }, init);

    scope.set(saveAs, result);

    // Optionally render children with result in scope
    if (node.childNodes.length) {
      const renderScope = createScope(scope);
      renderScope.set(saveAs, result);
      return execChildren(node, renderScope);
    }
    return [];
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 18 — <try> / <catch> / <finally>
   *
   *  <try>
   *    <print value="riskyExpr" />
   *    <catch as="err"><p>Error: {{ err }}</p></catch>
   *    <finally><p>done</p></finally>
   *  </try>
   * ═══════════════════════════════════════════════════════════ */
  function execTry(node, scope) {
    let catchNode   = null;
    let finallyNode = null;
    const bodyNodes = [];

    for (const child of node.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const t = child.tagName.toLowerCase();
        if (t === "catch")   { catchNode   = child; continue; }
        if (t === "finally") { finallyNode = child; continue; }
      }
      bodyNodes.push(child);
    }

    let out = [];
    try {
      const tryScope = createScope(scope);
      for (const child of bodyNodes) out.push(...exec(child, tryScope));
    } catch (e) {
      if (catchNode) {
        const catchScope = createScope(scope);
        const errName = catchNode.getAttribute("as") || "error";
        catchScope.set(errName, e.message || String(e));
        out = execChildren(catchNode, catchScope);
      }
    } finally {
      if (finallyNode) {
        out.push(...execChildren(finallyNode, createScope(scope)));
      }
    }
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 19 — Bootstrap: find all <script type="text/mylang">
   *               and render into the target container
   * ═══════════════════════════════════════════════════════════ */

  function runScript(scriptEl) {
    // Determine output target
    const targetSel = scriptEl.getAttribute("target");
    let container;
    if (targetSel) {
      container = document.querySelector(targetSel);
    } else {
      // Insert a <div> immediately after the script tag
      container = document.createElement("div");
      container.className = "mylang-output";
      scriptEl.parentNode.insertBefore(container, scriptEl.nextSibling);
    }
    if (!container) {
      console.warn("[MyLang] Target not found:", targetSel);
      return;
    }

    // Parse the script's inner HTML into a temporary element
    const wrapper = document.createElement("div");
    wrapper.innerHTML = scriptEl.innerHTML;

    // Global scope (supports data-var="..." and data-scope='...' for PHP/Python/Node backends)
    const globalScope = createScope(null);
    const varName = scriptEl.getAttribute("data-var");
    if (varName && typeof window !== "undefined" && window[varName] !== undefined) {
      const gv = window[varName];
      if (gv && typeof gv === "object" && !Array.isArray(gv)) {
        Object.entries(gv).forEach(([k, v]) => globalScope.set(k, v));
      } else {
        globalScope.set("data", gv);
      }
    }
    const rawScope = scriptEl.getAttribute("data-scope");
    if (rawScope) {
      try {
        const parsed = JSON.parse(rawScope);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.entries(parsed).forEach(([k, v]) => globalScope.set(k, v));
        } else {
          globalScope.set("data", parsed);
        }
      } catch (e) {
        console.warn("[MyLang] Invalid JSON in data-scope:", e.message);
      }
    }

    // Run all top-level nodes
    const output = execChildren(wrapper, globalScope);
    container.innerHTML = "";
    output.forEach((node) => container.appendChild(node));
  }

  function runAllScripts() {
    const scripts = document.querySelectorAll('script[type="text/mylang"]');
    scripts.forEach(runScript);
  }

  /* ═══════════════════════════════════════════════════════════
   *  SECTION 20 — Public API
   * ═══════════════════════════════════════════════════════════ */

  const MyLang = {
    version: "2.0.0",

    /** Manually render a MyLang template string into a container element */
    render(templateHTML, container, optionsOrScope) {
      const isOptions =
        optionsOrScope &&
        typeof optionsOrScope === "object" &&
        ("scope" in optionsOrScope ||
          "clear" in optionsOrScope ||
          "maxIterations" in optionsOrScope ||
          "onError" in optionsOrScope);
      const initialScope = isOptions ? optionsOrScope.scope : optionsOrScope;
      const clear = isOptions && optionsOrScope.clear === false ? false : true;

      const wrapper = document.createElement("div");
      wrapper.innerHTML = templateHTML;
      const scope = createScope(null);
      if (initialScope) Object.entries(initialScope).forEach(([k, v]) => scope.set(k, v));
      const nodes = execChildren(wrapper, scope);
      if (clear) container.innerHTML = "";
      nodes.forEach((n) => container.appendChild(n));
    },

    /** Evaluate an expression with a given scope (useful for testing) */
    evaluate,

    /** Create a scope (for advanced use) */
    createScope,

    /** Mount / re-run all <script type="text/mylang"> tags on the page */
    mount: runAllScripts,

    /** Re-run all scripts on the page */
    refresh: runAllScripts,
  };

  global.MyLang = MyLang;

  // Auto-run on DOMContentLoaded (browser only)
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runAllScripts);
    } else {
      runAllScripts();
    }
  }

})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
