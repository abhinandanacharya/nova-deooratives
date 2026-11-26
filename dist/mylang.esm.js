/*!
 * MyLang v2.0.0
 * (c) 2026 abhinandanacharya
 * Released under the MIT License
 * https://github.com/abhinandanacharya/nova-deooratives
 */

// src/scope.ts
var Scope = class {
  constructor(parent = null, initial) {
    this._own = /* @__PURE__ */ Object.create(null);
    this.parent = parent;
    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        this._own[k] = v;
      }
    }
  }
  get(key) {
    if (key in this._own)
      return this._own[key];
    if (this.parent)
      return this.parent.get(key);
    return void 0;
  }
  set(key, value) {
    this._own[key] = value;
  }
  /**
   * Walk up the scope chain and set where the variable was first defined.
   * Falls back to setting locally if not found anywhere above.
   */
  setUpper(key, value) {
    if (key in this._own) {
      this._own[key] = value;
      return;
    }
    if (this.parent) {
      this.parent.setUpper(key, value);
      return;
    }
    this._own[key] = value;
  }
  /** Flatten the full scope chain into a plain object (child wins) */
  flatten() {
    const base = this.parent ? this.parent.flatten() : /* @__PURE__ */ Object.create(null);
    return Object.assign(base, this._own);
  }
};
function createScope(parent = null, initial) {
  return new Scope(parent, initial);
}

// src/evaluator.ts
var CACHE_MAX = 512;
var exprCache = /* @__PURE__ */ new Map();
function evictIfNeeded() {
  if (exprCache.size >= CACHE_MAX) {
    const firstKey = exprCache.keys().next().value;
    if (firstKey !== void 0)
      exprCache.delete(firstKey);
  }
}
var BLOCKED_BY_VAR = [
  "window",
  "globalThis",
  "self",
  "global",
  "eval",
  "Function",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "Worker",
  "SharedWorker",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "openDatabase",
  "crypto",
  "document",
  "location",
  "history",
  "navigator",
  "screen",
  "alert",
  "confirm",
  "prompt",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "importScripts",
  "require",
  "module",
  "exports",
  "__dirname",
  "__filename",
  "process",
  "Buffer"
];
var PARAM_RESTRICTED = /* @__PURE__ */ new Set([
  "eval",
  "arguments",
  "let",
  "static",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
  "yield",
  "await"
]);
var BUILTINS = Object.freeze({
  array: (...args) => args,
  range: (start, end, step = 1) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0)
      return [];
    const r = [];
    const limit = 1e5;
    let count = 0;
    if (step > 0) {
      for (let i = start; i < end && count < limit; i += step, count++)
        r.push(i);
    } else {
      for (let i = start; i > end && count < limit; i += step, count++)
        r.push(i);
    }
    return r;
  },
  keys: (obj) => Object.keys(obj),
  values: (obj) => Object.values(obj),
  entries: (obj) => Object.entries(obj),
  len: (v) => {
    if (Array.isArray(v))
      return v.length;
    if (typeof v === "string")
      return v.length;
    if (v !== null && typeof v === "object")
      return Object.keys(v).length;
    return 0;
  },
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
    keys: Object.keys,
    values: Object.values,
    entries: Object.entries,
    assign: Object.assign,
    freeze: Object.freeze,
    fromEntries: Object.fromEntries
  },
  String,
  Number,
  Boolean
});
function compileExpression(expr, scopeKeys) {
  const cacheKey = `${expr}|||${scopeKeys.join(",")}`;
  const cached = exprCache.get(cacheKey);
  if (cached)
    return cached;
  evictIfNeeded();
  const varDecls = BLOCKED_BY_VAR.map((k) => `var ${k};`).join(" ");
  const body = `${varDecls} "use strict"; return (${expr});`;
  const safeParams = scopeKeys.filter((k) => !PARAM_RESTRICTED.has(k));
  const fn = new Function(...safeParams, body);
  exprCache.set(cacheKey, fn);
  return fn;
}
function createEvaluator(config) {
  return function evaluate(expr, scope) {
    if (expr === void 0 || expr === null)
      return void 0;
    const trimmed = String(expr).trim();
    if (trimmed === "")
      return void 0;
    const merged = Object.assign(
      /* @__PURE__ */ Object.create(null),
      BUILTINS,
      scope
    );
    const scopeKeys = Object.keys(merged).filter((k) => !PARAM_RESTRICTED.has(k));
    const scopeVals = scopeKeys.map((k) => merged[k]);
    try {
      const fn = compileExpression(trimmed, scopeKeys);
      return fn(...scopeVals);
    } catch (err) {
      const mylangErr = {
        type: "ExpressionError",
        message: err instanceof Error ? err.message : String(err),
        expression: trimmed,
        cause: err
      };
      if (config.onError)
        config.onError(mylangErr);
      else if (config.warnOnError) {
        console.warn(`[MyLang] Expression error in "${trimmed}":`, mylangErr.message);
      }
      return void 0;
    }
  };
}

// src/types.ts
var BreakSignal = class _BreakSignal extends Error {
  constructor() {
    super("break");
    this.isBreak = true;
    this.name = "BreakSignal";
    Object.setPrototypeOf(this, _BreakSignal.prototype);
  }
};
var ContinueSignal = class _ContinueSignal extends Error {
  constructor() {
    super("continue");
    this.isContinue = true;
    this.name = "ContinueSignal";
    Object.setPrototypeOf(this, _ContinueSignal.prototype);
  }
};

// src/executor.ts
function parseInitExpr(init) {
  const m = init.trim().match(/^(?:let\s+|var\s+|const\s+)?(\w+)\s*=\s*(.+)$/);
  return m && m[1] && m[2] ? { name: m[1], expr: m[2] } : null;
}
function applyStep(stepExpr, scope, evaluate) {
  const s = stepExpr.trim();
  const postfix = s.match(/^(\w+)(\+\+|--)$/);
  if (postfix && postfix[1] && postfix[2]) {
    const v = scope.get(postfix[1]);
    scope.setUpper(postfix[1], typeof v === "number" ? v + (postfix[2] === "++" ? 1 : -1) : v);
    return;
  }
  const prefix = s.match(/^(\+\+|--)(\w+)$/);
  if (prefix && prefix[2]) {
    const v = scope.get(prefix[2]);
    scope.setUpper(prefix[2], typeof v === "number" ? v + (prefix[1] === "++" ? 1 : -1) : v);
    return;
  }
  const compound = s.match(/^(\w+)\s*([+\-*/])=\s*(.+)$/);
  if (compound && compound[1] && compound[2] && compound[3]) {
    const val = evaluate(`(${String(scope.get(compound[1]))}) ${compound[2]} (${compound[3]})`, scope.flatten());
    scope.setUpper(compound[1], val);
  }
}
function interpolateText(text, scope, evaluate, openDelim, closeDelim) {
  const escapedOpen = openDelim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedClose = closeDelim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedOpen}([\\s\\S]+?)${escapedClose}`, "g");
  const replaced = text.replace(pattern, (_, expr) => {
    const v = evaluate(expr.trim(), scope.flatten());
    return v === null || v === void 0 ? "" : String(v);
  });
  return document.createTextNode(replaced);
}
function createExecutor(config, evaluate) {
  const MAX = config.maxIterations;
  const [openDelim, closeDelim] = config.delimiters;
  function execText(node, scope) {
    return [interpolateText(node.textContent ?? "", scope, evaluate, openDelim, closeDelim)];
  }
  function execPassthrough(node, scope) {
    const clone = document.createElement(node.tagName);
    for (const attr of Array.from(node.attributes)) {
      const val = interpolateText(attr.value, scope, evaluate, openDelim, closeDelim).textContent ?? "";
      clone.setAttribute(attr.name, val);
    }
    execChildren(node, scope).forEach((c) => clone.appendChild(c));
    return [clone];
  }
  function getChildNodes(parent) {
    if (parent instanceof Element && parent.tagName.toLowerCase() === "template" && parent.hasAttribute("data-ml-tag")) {
      return Array.from(parent.content.childNodes);
    }
    return Array.from(parent.childNodes);
  }
  function getTagName(el) {
    if (el.tagName.toLowerCase() === "template" && el.hasAttribute("data-ml-tag")) {
      return (el.getAttribute("data-ml-tag") ?? "").toLowerCase();
    }
    return el.tagName.toLowerCase();
  }
  function execChildren(parent, scope) {
    const out = [];
    for (const child of getChildNodes(parent)) {
      out.push(...exec(child, scope));
    }
    return out;
  }
  function exec(node, scope) {
    if (node.nodeType === Node.TEXT_NODE)
      return execText(node, scope);
    if (node.nodeType !== Node.ELEMENT_NODE)
      return [];
    const el = node;
    const tag = getTagName(el);
    switch (tag) {
      case "for":
        return execFor(el, scope);
      case "each":
        return execEach(el, scope);
      case "repeat":
        return execRepeat(el, scope);
      case "while":
        return execWhile(el, scope);
      case "dowhile":
        return execDoWhile(el, scope);
      case "if":
        return execIf(el, scope);
      case "switch":
        return execSwitch(el, scope);
      case "map":
        return execMap(el, scope);
      case "filter":
        return execFilter(el, scope);
      case "reduce":
        return execReduce(el, scope);
      case "let":
        return execLet(el, scope);
      case "print":
        return execPrint(el, scope);
      case "log":
        return execLog(el, scope);
      case "break":
        throw new BreakSignal();
      case "continue":
        throw new ContinueSignal();
      case "try":
        return execTry(el, scope);
      default:
        return execPassthrough(el, scope);
    }
  }
  function execLet(node, scope) {
    const name = node.getAttribute("name");
    if (!name)
      return [];
    const exprAttr = node.getAttribute("value") ?? node.getAttribute("val");
    const upper = node.hasAttribute("upper");
    const val = exprAttr !== null ? evaluate(exprAttr, scope.flatten()) : void 0;
    if (upper)
      scope.setUpper(name, val);
    else
      scope.set(name, val);
    return [];
  }
  function execPrint(node, scope) {
    const expr = node.getAttribute("value") ?? node.getAttribute("val");
    if (expr !== null) {
      const v = evaluate(expr, scope.flatten());
      return [document.createTextNode(v === null || v === void 0 ? "" : String(v))];
    }
    return execChildren(node, scope);
  }
  function execLog(node, scope) {
    const expr = node.getAttribute("value") ?? node.textContent ?? "";
    const v = evaluate(expr.trim(), scope.flatten());
    console.log("[MyLang]", v);
    return [];
  }
  function execFor(node, scope) {
    const separator = node.getAttribute("separator") ?? "";
    const printable = node.getAttribute("printable");
    if (node.hasAttribute("init") || node.hasAttribute("cond") || node.hasAttribute("step")) {
      return execForClassic(node, scope, separator);
    }
    if (node.hasAttribute("range"))
      return execForRange(node, scope, separator);
    if (node.hasAttribute("in"))
      return execForIn(node, scope, separator);
    if (node.hasAttribute("of"))
      return execForOf(node, scope, separator);
    return execForData(node, scope, separator, printable);
  }
  function withSeparator(out, separator) {
    if (separator && out.length > 0)
      out.push(document.createTextNode(separator));
  }
  function execForClassic(node, scope, separator) {
    const initExpr = node.getAttribute("init") ?? "";
    const condExpr = node.getAttribute("cond") ?? "true";
    const stepExpr = node.getAttribute("step") ?? "";
    const loopScope = createScope(scope);
    const out = [];
    const parsed = parseInitExpr(initExpr);
    if (parsed) {
      loopScope.set(parsed.name, evaluate(parsed.expr, { ...scope.flatten() }));
    }
    let iters = 0;
    while (evaluate(condExpr, loopScope.flatten()) && iters++ < MAX) {
      const iterScope = createScope(loopScope);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal)
          break;
        if (e instanceof ContinueSignal) {
          if (stepExpr)
            applyStep(stepExpr, loopScope, evaluate);
          continue;
        }
        throw e;
      }
      if (stepExpr)
        applyStep(stepExpr, loopScope, evaluate);
    }
    return out;
  }
  function execForRange(node, scope, separator) {
    const rangeStr = node.getAttribute("range") ?? "0,0";
    const parts = rangeStr.split(",").map((s) => Number(evaluate(s.trim(), scope.flatten())));
    const [start = 0, end = 0, step = 1] = parts;
    const asName = node.getAttribute("as") ?? node.getAttribute("index") ?? "$i";
    const idxName = node.getAttribute("index") ?? "$i";
    const out = [];
    let iters = 0;
    const cond = step > 0 ? (i) => i < end : (i) => i > end;
    for (let i = start; cond(i) && iters++ < MAX; i += step) {
      const iterScope = createScope(scope);
      iterScope.set(asName, i);
      iterScope.set(idxName, i);
      iterScope.set("$i", i);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal)
          break;
        if (e instanceof ContinueSignal)
          continue;
        throw e;
      }
    }
    return out;
  }
  function execForIn(node, scope, separator) {
    const objExpr = node.getAttribute("in") ?? "{}";
    const obj = evaluate(objExpr, scope.flatten());
    const asName = node.getAttribute("as") ?? node.getAttribute("key") ?? "$key";
    const idxName = node.getAttribute("index") ?? "$i";
    const out = [];
    let idx = 0;
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key))
        continue;
      const iterScope = createScope(scope);
      iterScope.set(asName, key);
      iterScope.set("$key", key);
      iterScope.set("$val", obj[key]);
      iterScope.set(idxName, idx++);
      iterScope.set("$i", idx - 1);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal)
          break;
        if (e instanceof ContinueSignal)
          continue;
        throw e;
      }
    }
    return out;
  }
  function execForOf(node, scope, separator) {
    const iterExpr = node.getAttribute("of") ?? "[]";
    const iterable = evaluate(iterExpr, scope.flatten());
    const asName = node.getAttribute("as") ?? node.getAttribute("value") ?? "$v";
    const idxName = node.getAttribute("index") ?? "$i";
    const out = [];
    let idx = 0;
    if (!iterable || typeof iterable[Symbol.iterator] !== "function")
      return [];
    for (const item of iterable) {
      const iterScope = createScope(scope);
      iterScope.set(asName, item);
      iterScope.set("$v", item);
      iterScope.set(idxName, idx++);
      iterScope.set("$i", idx - 1);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal)
          break;
        if (e instanceof ContinueSignal)
          continue;
        throw e;
      }
    }
    return out;
  }
  function execForData(node, scope, separator, printable) {
    const dataExpr = node.getAttribute("data") ?? "[]";
    const rawIndex = node.getAttribute("index");
    const idxName = rawIndex === "default" ? "$i" : rawIndex ?? "$i";
    const valName = printable ?? node.getAttribute("value") ?? node.getAttribute("val") ?? "$v";
    const data = evaluate(dataExpr, scope.flatten());
    if (data === void 0 || data === null)
      return [];
    const entries = Array.isArray(data) ? data.map((v, i) => [i, v]) : Object.entries(data);
    const out = [];
    for (const [i, v] of entries) {
      const iterScope = createScope(scope);
      iterScope.set("$i", i);
      iterScope.set("$v", v);
      iterScope.set(idxName, i);
      iterScope.set(valName, v);
      if (printable)
        iterScope.set(printable, v);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal)
          break;
        if (e instanceof ContinueSignal)
          continue;
        throw e;
      }
    }
    return out;
  }
  function execEach(node, scope) {
    const separator = node.getAttribute("separator") ?? "";
    return execForOf(node, scope, separator);
  }
  function execRepeat(node, scope) {
    const times = Number(evaluate(node.getAttribute("times") ?? "0", scope.flatten()));
    const idxName = node.getAttribute("index") ?? "$i";
    const separator = node.getAttribute("separator") ?? "";
    const out = [];
    for (let i = 0; i < times && i < MAX; i++) {
      const iterScope = createScope(scope);
      iterScope.set(idxName, i);
      iterScope.set("$i", i);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal)
          break;
        if (e instanceof ContinueSignal)
          continue;
        throw e;
      }
    }
    return out;
  }
  function execWhile(node, scope) {
    const condExpr = node.getAttribute("cond") ?? node.getAttribute("condition") ?? "false";
    const separator = node.getAttribute("separator") ?? "";
    const out = [];
    let iters = 0;
    while (evaluate(condExpr, scope.flatten()) && iters++ < MAX) {
      const iterScope = createScope(scope);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal)
          break;
        if (e instanceof ContinueSignal)
          continue;
        throw e;
      }
    }
    return out;
  }
  function execDoWhile(node, scope) {
    const condExpr = node.getAttribute("cond") ?? node.getAttribute("condition") ?? "false";
    const separator = node.getAttribute("separator") ?? "";
    const out = [];
    let first = true;
    let iters = 0;
    do {
      const iterScope = createScope(scope);
      try {
        if (separator && !first)
          out.push(document.createTextNode(separator));
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal)
          break;
        if (e instanceof ContinueSignal) {
          first = false;
          continue;
        }
        throw e;
      }
      first = false;
      iters++;
    } while (evaluate(condExpr, scope.flatten()) && iters < MAX);
    return out;
  }
  function execIf(node, scope) {
    const cond = node.getAttribute("cond") ?? node.getAttribute("condition") ?? "false";
    const branches = [];
    let elseNode = null;
    const bodyNodes = [];
    for (const child of getChildNodes(node)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const t = getTagName(child);
        if (t === "elif" || t === "elseif") {
          branches.push({
            cond: child.getAttribute("cond") ?? child.getAttribute("condition") ?? "false",
            node: child
          });
          continue;
        }
        if (t === "else") {
          elseNode = child;
          continue;
        }
      }
      bodyNodes.push(child);
    }
    if (evaluate(cond, scope.flatten())) {
      const ifScope = createScope(scope);
      const out = [];
      for (const child of bodyNodes)
        out.push(...exec(child, ifScope));
      return out;
    }
    for (const branch of branches) {
      if (evaluate(branch.cond, scope.flatten())) {
        return execChildren(branch.node, createScope(scope));
      }
    }
    if (elseNode)
      return execChildren(elseNode, createScope(scope));
    return [];
  }
  function execSwitch(node, scope) {
    const expr = node.getAttribute("value") ?? node.getAttribute("val") ?? "undefined";
    const val = evaluate(expr, scope.flatten());
    let defaultNode = null;
    let matched = false;
    const out = [];
    for (const child of getChildNodes(node)) {
      if (child.nodeType !== Node.ELEMENT_NODE)
        continue;
      const el = child;
      const t = getTagName(el);
      if (t === "default") {
        defaultNode = el;
        continue;
      }
      if (t !== "case")
        continue;
      const matchExpr = el.getAttribute("match") ?? "undefined";
      const matchVal = evaluate(matchExpr, scope.flatten());
      if (!matched && val === matchVal)
        matched = true;
      if (matched) {
        try {
          out.push(...execChildren(el, createScope(scope)));
        } catch (e) {
          if (e instanceof BreakSignal)
            return out;
          throw e;
        }
        if (!el.hasAttribute("fallthrough"))
          break;
      }
    }
    if (!matched && defaultNode) {
      out.push(...execChildren(defaultNode, createScope(scope)));
    }
    return out;
  }
  function execMap(node, scope) {
    const dataExpr = node.getAttribute("data") ?? node.getAttribute("of") ?? "[]";
    const asName = node.getAttribute("as") ?? node.getAttribute("value") ?? "$v";
    const idxName = node.getAttribute("index") ?? "$i";
    const separator = node.getAttribute("separator") ?? "";
    const saveAs = node.getAttribute("save");
    const arr = evaluate(dataExpr, scope.flatten());
    if (!Array.isArray(arr))
      return [];
    const out = [];
    const saved = [];
    arr.forEach((item, idx) => {
      const iterScope = createScope(scope);
      iterScope.set(asName, item);
      iterScope.set(idxName, idx);
      iterScope.set("$v", item);
      iterScope.set("$i", idx);
      const nodes = execChildren(node, iterScope);
      withSeparator(out, separator);
      out.push(...nodes);
      if (saveAs)
        saved.push(nodes.map((n) => n.textContent).join(""));
    });
    if (saveAs)
      scope.set(saveAs, saved);
    return out;
  }
  function execFilter(node, scope) {
    const dataExpr = node.getAttribute("data") ?? node.getAttribute("of") ?? "[]";
    const whereExpr = node.getAttribute("where") ?? node.getAttribute("cond") ?? "true";
    const asName = node.getAttribute("as") ?? node.getAttribute("value") ?? "$v";
    const idxName = node.getAttribute("index") ?? "$i";
    const separator = node.getAttribute("separator") ?? "";
    const saveAs = node.getAttribute("save");
    const arr = evaluate(dataExpr, scope.flatten());
    if (!Array.isArray(arr))
      return [];
    const filtered = arr.filter((item, idx) => {
      const testScope = createScope(scope);
      testScope.set(asName, item);
      testScope.set("$v", item);
      testScope.set(idxName, idx);
      testScope.set("$i", idx);
      return Boolean(evaluate(whereExpr, testScope.flatten()));
    });
    if (saveAs)
      scope.set(saveAs, filtered);
    const out = [];
    filtered.forEach((item, idx) => {
      const iterScope = createScope(scope);
      iterScope.set(asName, item);
      iterScope.set("$v", item);
      iterScope.set(idxName, idx);
      iterScope.set("$i", idx);
      withSeparator(out, separator);
      out.push(...execChildren(node, iterScope));
    });
    return out;
  }
  function execReduce(node, scope) {
    const dataExpr = node.getAttribute("data") ?? "[]";
    const accName = node.getAttribute("acc") ?? "acc";
    const initExpr = node.getAttribute("init") ?? "0";
    const itemName = node.getAttribute("item") ?? "$v";
    const exprStr = node.getAttribute("expr") ?? accName;
    const saveAs = node.getAttribute("save") ?? accName;
    const arr = evaluate(dataExpr, scope.flatten());
    const init = evaluate(initExpr, scope.flatten());
    if (!Array.isArray(arr))
      return [];
    const result = arr.reduce((acc, item) => {
      const iterScope = createScope(scope);
      iterScope.set(accName, acc);
      iterScope.set(itemName, item);
      iterScope.set("$v", item);
      return evaluate(exprStr, iterScope.flatten());
    }, init);
    scope.set(saveAs, result);
    if (getChildNodes(node).length > 0) {
      const renderScope = createScope(scope);
      renderScope.set(saveAs, result);
      return execChildren(node, renderScope);
    }
    return [];
  }
  function execTry(node, scope) {
    let catchNode = null;
    let finallyNode = null;
    const bodyNodes = [];
    for (const child of getChildNodes(node)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const t = getTagName(child);
        if (t === "catch") {
          catchNode = child;
          continue;
        }
        if (t === "finally") {
          finallyNode = child;
          continue;
        }
      }
      bodyNodes.push(child);
    }
    let out = [];
    try {
      const tryScope = createScope(scope);
      for (const child of bodyNodes)
        out.push(...exec(child, tryScope));
    } catch (e) {
      if (catchNode) {
        const catchScope = createScope(scope);
        const errName = catchNode.getAttribute("as") ?? "error";
        catchScope.set(errName, e instanceof Error ? e.message : String(e));
        out = execChildren(catchNode, catchScope);
      }
    } finally {
      if (finallyNode) {
        out.push(...execChildren(finallyNode, createScope(scope)));
      }
    }
    return out;
  }
  return { exec, execChildren };
}

// src/index.ts
var VERSION = "1.0.0";
var defaultConfig = {
  maxIterations: 1e5,
  warnOnError: true,
  delimiters: ["{{", "}}"]
};
function buildMyLang() {
  let config = { ...defaultConfig };
  function getEvaluator() {
    return createEvaluator({ onError: config.onError, warnOnError: config.warnOnError });
  }
  function getExecutor() {
    return createExecutor(config, getEvaluator());
  }
  const ML_TAG_NAMES = "for|each|repeat|while|dowhile|if|elif|elseif|else|switch|case|default|map|filter|reduce|try|catch|finally|let|print|log|break|continue";
  const ML_OPEN_RE = new RegExp(
    `<(${ML_TAG_NAMES})((?:\\s+(?:"[^"]*"|'[^']*'|[^>"'/]|/(?!>))*)?)\\s*(\\/?)>`,
    "gi"
  );
  const ML_CLOSE_RE = new RegExp(`</(${ML_TAG_NAMES})\\s*>`, "gi");
  function parse(template) {
    const normalized = template.replace(ML_OPEN_RE, (_, tag, attrs, selfClose) => {
      const lower = tag.toLowerCase();
      return selfClose ? `<template data-ml-tag="${lower}"${attrs}></template>` : `<template data-ml-tag="${lower}"${attrs}>`;
    }).replace(ML_CLOSE_RE, "</template>");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = normalized;
    return wrapper;
  }
  function render(template, container, options = {}) {
    const mergedConfig = {
      ...config,
      ...options.maxIterations !== void 0 ? { maxIterations: options.maxIterations } : {},
      ...options.onError !== void 0 ? { onError: options.onError } : {}
    };
    const evaluator = createEvaluator({
      onError: mergedConfig.onError,
      warnOnError: mergedConfig.warnOnError
    });
    const executor = createExecutor(mergedConfig, evaluator);
    const scope = createScope(null, options.scope ?? {});
    const wrapper = parse(template);
    const nodes = executor.execChildren(wrapper, scope);
    if (options.clear !== false)
      container.innerHTML = "";
    nodes.forEach((n) => container.appendChild(n));
  }
  function parseScriptScope(scriptEl) {
    const scope = {};
    const varName = scriptEl.getAttribute("data-var");
    if (varName && typeof window !== "undefined") {
      const globalVal = window[varName];
      if (globalVal && typeof globalVal === "object" && !Array.isArray(globalVal)) {
        Object.assign(scope, globalVal);
      } else if (globalVal !== void 0) {
        scope["data"] = globalVal;
      }
    }
    const rawJson = scriptEl.getAttribute("data-scope");
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.assign(scope, parsed);
        } else {
          scope["data"] = parsed;
        }
      } catch (err) {
        const mylangErr = {
          type: "RenderError",
          message: `Invalid JSON in data-scope attribute: ${err instanceof Error ? err.message : String(err)}`,
          cause: err
        };
        if (config.onError)
          config.onError(mylangErr);
        else if (config.warnOnError)
          console.warn("[MyLang]", mylangErr.message);
      }
    }
    return scope;
  }
  function runScript(scriptEl) {
    var _a;
    const targetSel = scriptEl.getAttribute("target");
    let container;
    if (targetSel) {
      container = document.querySelector(targetSel);
    } else {
      container = document.createElement("div");
      container.className = "mylang-output";
      (_a = scriptEl.parentNode) == null ? void 0 : _a.insertBefore(container, scriptEl.nextSibling);
    }
    if (!container) {
      if (config.warnOnError) {
        console.warn("[MyLang] Target container not found:", targetSel);
      }
      return;
    }
    const scope = parseScriptScope(scriptEl);
    render(scriptEl.innerHTML, container, { scope });
  }
  function mount(options = {}) {
    const scripts = document.querySelectorAll('script[type="text/mylang"]');
    scripts.forEach(runScript);
  }
  function evaluate(expression, scope = {}) {
    return getEvaluator()(expression, scope);
  }
  function createScope2(parent = null, initial = {}) {
    return createScope(parent, initial);
  }
  const api = {
    get version() {
      return VERSION;
    },
    get config() {
      return config;
    },
    set config(newConfig) {
      config = { ...config, ...newConfig };
    },
    render,
    mount,
    evaluate,
    createScope: createScope2
  };
  return api;
}
var MyLang = buildMyLang();
var src_default = MyLang;
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => MyLang.mount());
  } else {
    MyLang.mount();
  }
}
if (typeof window !== "undefined") {
  window["MyLang"] = MyLang;
}
export {
  BUILTINS,
  BreakSignal,
  ContinueSignal,
  MyLang,
  Scope,
  VERSION,
  createScope,
  src_default as default
};
//# sourceMappingURL=mylang.esm.js.map
