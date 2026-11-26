/**
 * MyLang — Core Executor (DOM tree walker)
 * Processes each custom tag and returns an array of DOM nodes.
 * @module mylang-js/executor
 */

import type { IScope, MyLangConfig } from "./types.js";
import { BreakSignal, ContinueSignal } from "./types.js";
import { createScope } from "./scope.js";
import type { Evaluator } from "./evaluator.js";

type OutputNodes = Node[];

/** Re-export signals so executor consumers can catch them */
export { BreakSignal, ContinueSignal };

/** Parse "i=0" or "let i = 0" into {name, expr} */
function parseInitExpr(init: string): { name: string; expr: string } | null {
  const m = init.trim().match(/^(?:let\s+|var\s+|const\s+)?(\w+)\s*=\s*(.+)$/);
  return m && m[1] && m[2] ? { name: m[1], expr: m[2] } : null;
}

/** Parse "i++" / "--i" / "i+=2" into a step function */
function applyStep(
  stepExpr: string,
  scope: IScope,
  evaluate: Evaluator
): void {
  const s = stepExpr.trim();
  // i++ or i--
  const postfix = s.match(/^(\w+)(\+\+|--)$/);
  if (postfix && postfix[1] && postfix[2]) {
    const v = scope.get(postfix[1]);
    scope.setUpper(postfix[1], typeof v === "number" ? v + (postfix[2] === "++" ? 1 : -1) : v);
    return;
  }
  // ++i or --i
  const prefix = s.match(/^(\+\+|--)(\w+)$/);
  if (prefix && prefix[2]) {
    const v = scope.get(prefix[2]);
    scope.setUpper(prefix[2], typeof v === "number" ? v + (prefix[1] === "++" ? 1 : -1) : v);
    return;
  }
  // i += 2  / i -= 1 / i *= 2 / i /= 2
  const compound = s.match(/^(\w+)\s*([+\-*/])=\s*(.+)$/);
  if (compound && compound[1] && compound[2] && compound[3]) {
    const val = evaluate(`(${String(scope.get(compound[1]))}) ${compound[2]} (${compound[3]})`, scope.flatten());
    scope.setUpper(compound[1], val);
  }
}

/** Interpolate {{ expr }} inside a text string */
function interpolateText(
  text: string,
  scope: IScope,
  evaluate: Evaluator,
  openDelim: string,
  closeDelim: string
): Text {
  const escapedOpen = openDelim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedClose = closeDelim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedOpen}([\\s\\S]+?)${escapedClose}`, "g");
  const replaced = text.replace(pattern, (_, expr: string) => {
    const v = evaluate(expr.trim(), scope.flatten());
    return v === null || v === undefined ? "" : String(v);
  });
  return document.createTextNode(replaced);
}

export function createExecutor(
  config: MyLangConfig,
  evaluate: Evaluator
) {
  const MAX = config.maxIterations;
  const [openDelim, closeDelim] = config.delimiters;

  /** Text node with interpolation */
  function execText(node: Text, scope: IScope): OutputNodes {
    return [interpolateText(node.textContent ?? "", scope, evaluate, openDelim, closeDelim)];
  }

  /** Standard HTML passthrough — clone + process children */
  function execPassthrough(node: Element, scope: IScope): OutputNodes {
    const clone = document.createElement(node.tagName);
    for (const attr of Array.from(node.attributes)) {
      const val = interpolateText(attr.value, scope, evaluate, openDelim, closeDelim).textContent ?? "";
      clone.setAttribute(attr.name, val);
    }
    execChildren(node, scope).forEach((c) => clone.appendChild(c));
    return [clone];
  }

  /** Return child nodes, unwrapping <template data-ml-tag="..."> content */
  function getChildNodes(parent: Element | DocumentFragment): Node[] {
    if (
      parent instanceof Element &&
      parent.tagName.toLowerCase() === "template" &&
      parent.hasAttribute("data-ml-tag")
    ) {
      return Array.from((parent as HTMLTemplateElement).content.childNodes);
    }
    return Array.from(parent.childNodes);
  }

  /** Return logical tag name (unwrapping <template data-ml-tag="...">) */
  function getTagName(el: Element): string {
    if (el.tagName.toLowerCase() === "template" && el.hasAttribute("data-ml-tag")) {
      return (el.getAttribute("data-ml-tag") ?? "").toLowerCase();
    }
    return el.tagName.toLowerCase();
  }

  /** Execute all child nodes and flatten results */
  function execChildren(parent: Element | DocumentFragment, scope: IScope): OutputNodes {
    const out: OutputNodes = [];
    for (const child of getChildNodes(parent)) {
      out.push(...exec(child, scope));
    }
    return out;
  }

  /** Dispatch a node to the right handler */
  function exec(node: Node, scope: IScope): OutputNodes {
    if (node.nodeType === Node.TEXT_NODE) return execText(node as Text, scope);
    if (node.nodeType !== Node.ELEMENT_NODE) return [];

    const el = node as Element;
    const tag = getTagName(el);

    switch (tag) {
      case "for":      return execFor(el, scope);
      case "each":     return execEach(el, scope);
      case "repeat":   return execRepeat(el, scope);
      case "while":    return execWhile(el, scope);
      case "dowhile":  return execDoWhile(el, scope);
      case "if":       return execIf(el, scope);
      case "switch":   return execSwitch(el, scope);
      case "map":      return execMap(el, scope);
      case "filter":   return execFilter(el, scope);
      case "reduce":   return execReduce(el, scope);
      case "let":      return execLet(el, scope);
      case "print":    return execPrint(el, scope);
      case "log":      return execLog(el, scope);
      case "break":    throw new BreakSignal();
      case "continue": throw new ContinueSignal();
      case "try":      return execTry(el, scope);
      default:         return execPassthrough(el, scope);
    }
  }

  /* ── <let> ─────────────────────────────────────────────── */
  function execLet(node: Element, scope: IScope): OutputNodes {
    const name = node.getAttribute("name");
    if (!name) return [];
    const exprAttr = node.getAttribute("value") ?? node.getAttribute("val");
    const upper = node.hasAttribute("upper");
    const val = exprAttr !== null ? evaluate(exprAttr, scope.flatten()) : undefined;
    if (upper) scope.setUpper(name, val);
    else scope.set(name, val);
    return [];
  }

  /* ── <print> ───────────────────────────────────────────── */
  function execPrint(node: Element, scope: IScope): OutputNodes {
    const expr = node.getAttribute("value") ?? node.getAttribute("val");
    if (expr !== null) {
      const v = evaluate(expr, scope.flatten());
      return [document.createTextNode(v === null || v === undefined ? "" : String(v))];
    }
    return execChildren(node, scope);
  }

  /* ── <log> ─────────────────────────────────────────────── */
  function execLog(node: Element, scope: IScope): OutputNodes {
    const expr = node.getAttribute("value") ?? node.textContent ?? "";
    const v = evaluate(expr.trim(), scope.flatten());
    console.log("[MyLang]", v);
    return [];
  }

  /* ── <for> ─────────────────────────────────────────────── */
  function execFor(node: Element, scope: IScope): OutputNodes {
    const separator = node.getAttribute("separator") ?? "";
    const printable = node.getAttribute("printable");

    // Mode B — classic C-style
    if (node.hasAttribute("init") || node.hasAttribute("cond") || node.hasAttribute("step")) {
      return execForClassic(node, scope, separator);
    }
    // Mode C — range
    if (node.hasAttribute("range")) return execForRange(node, scope, separator);
    // Mode D — for-in
    if (node.hasAttribute("in")) return execForIn(node, scope, separator);
    // Mode E — for-of
    if (node.hasAttribute("of")) return execForOf(node, scope, separator);
    // Mode A — data=
    return execForData(node, scope, separator, printable);
  }

  function withSeparator(out: OutputNodes, separator: string): void {
    if (separator && out.length > 0) out.push(document.createTextNode(separator));
  }

  function execForClassic(node: Element, scope: IScope, separator: string): OutputNodes {
    const initExpr = node.getAttribute("init") ?? "";
    const condExpr = node.getAttribute("cond") ?? "true";
    const stepExpr = node.getAttribute("step") ?? "";
    const loopScope = createScope(scope);
    const out: OutputNodes = [];

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
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) {
          if (stepExpr) applyStep(stepExpr, loopScope, evaluate);
          continue;
        }
        throw e;
      }
      if (stepExpr) applyStep(stepExpr, loopScope, evaluate);
    }
    return out;
  }

  function execForRange(node: Element, scope: IScope, separator: string): OutputNodes {
    const rangeStr = node.getAttribute("range") ?? "0,0";
    const parts = rangeStr.split(",").map((s) => Number(evaluate(s.trim(), scope.flatten())));
    const [start = 0, end = 0, step = 1] = parts;
    const asName = node.getAttribute("as") ?? node.getAttribute("index") ?? "$i";
    const idxName = node.getAttribute("index") ?? "$i";
    const out: OutputNodes = [];

    let iters = 0;
    const cond = step > 0 ? (i: number) => i < end : (i: number) => i > end;
    for (let i = start; cond(i) && iters++ < MAX; i += step) {
      const iterScope = createScope(scope);
      iterScope.set(asName, i);
      iterScope.set(idxName, i);
      iterScope.set("$i", i);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
    return out;
  }

  function execForIn(node: Element, scope: IScope, separator: string): OutputNodes {
    const objExpr = node.getAttribute("in") ?? "{}";
    const obj = evaluate(objExpr, scope.flatten()) as Record<string, unknown>;
    const asName = node.getAttribute("as") ?? node.getAttribute("key") ?? "$key";
    const idxName = node.getAttribute("index") ?? "$i";
    const out: OutputNodes = [];
    let idx = 0;

    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
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
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
    return out;
  }

  function execForOf(node: Element, scope: IScope, separator: string): OutputNodes {
    const iterExpr = node.getAttribute("of") ?? "[]";
    const iterable = evaluate(iterExpr, scope.flatten()) as Iterable<unknown>;
    const asName = node.getAttribute("as") ?? node.getAttribute("value") ?? "$v";
    const idxName = node.getAttribute("index") ?? "$i";
    const out: OutputNodes = [];
    let idx = 0;

    if (!iterable || typeof (iterable as unknown as { [Symbol.iterator]?: unknown })[Symbol.iterator] !== "function") return [];

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
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
    return out;
  }

  function execForData(
    node: Element,
    scope: IScope,
    separator: string,
    printable: string | null
  ): OutputNodes {
    const dataExpr = node.getAttribute("data") ?? "[]";
    const rawIndex = node.getAttribute("index");
    const idxName = rawIndex === "default" ? "$i" : (rawIndex ?? "$i");
    const valName = printable ?? node.getAttribute("value") ?? node.getAttribute("val") ?? "$v";
    const data = evaluate(dataExpr, scope.flatten());
    if (data === undefined || data === null) return [];

    const entries: [unknown, unknown][] = Array.isArray(data)
      ? data.map((v, i) => [i, v])
      : Object.entries(data as object);

    const out: OutputNodes = [];
    for (const [i, v] of entries) {
      const iterScope = createScope(scope);
      iterScope.set("$i", i);
      iterScope.set("$v", v);
      iterScope.set(idxName, i);
      iterScope.set(valName, v);
      if (printable) iterScope.set(printable, v);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
    return out;
  }

  /* ── <each> ────────────────────────────────────────────── */
  function execEach(node: Element, scope: IScope): OutputNodes {
    const separator = node.getAttribute("separator") ?? "";
    return execForOf(node, scope, separator);
  }

  /* ── <repeat> ──────────────────────────────────────────── */
  function execRepeat(node: Element, scope: IScope): OutputNodes {
    const times = Number(evaluate(node.getAttribute("times") ?? "0", scope.flatten()));
    const idxName = node.getAttribute("index") ?? "$i";
    const separator = node.getAttribute("separator") ?? "";
    const out: OutputNodes = [];

    for (let i = 0; i < times && i < MAX; i++) {
      const iterScope = createScope(scope);
      iterScope.set(idxName, i);
      iterScope.set("$i", i);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
    return out;
  }

  /* ── <while> ───────────────────────────────────────────── */
  function execWhile(node: Element, scope: IScope): OutputNodes {
    const condExpr = node.getAttribute("cond") ?? node.getAttribute("condition") ?? "false";
    const separator = node.getAttribute("separator") ?? "";
    const out: OutputNodes = [];
    let iters = 0;

    while (evaluate(condExpr, scope.flatten()) && iters++ < MAX) {
      const iterScope = createScope(scope);
      try {
        withSeparator(out, separator);
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
    return out;
  }

  /* ── <dowhile> ─────────────────────────────────────────── */
  function execDoWhile(node: Element, scope: IScope): OutputNodes {
    const condExpr = node.getAttribute("cond") ?? node.getAttribute("condition") ?? "false";
    const separator = node.getAttribute("separator") ?? "";
    const out: OutputNodes = [];
    let first = true;
    let iters = 0;

    do {
      const iterScope = createScope(scope);
      try {
        if (separator && !first) out.push(document.createTextNode(separator));
        out.push(...execChildren(node, iterScope));
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) { first = false; continue; }
        throw e;
      }
      first = false;
      iters++;
    } while (evaluate(condExpr, scope.flatten()) && iters < MAX);

    return out;
  }

  /* ── <if> / <elif> / <else> ────────────────────────────── */
  function execIf(node: Element, scope: IScope): OutputNodes {
    const cond = node.getAttribute("cond") ?? node.getAttribute("condition") ?? "false";
    const branches: { cond: string; node: Element }[] = [];
    let elseNode: Element | null = null;
    const bodyNodes: Node[] = [];

    for (const child of getChildNodes(node)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const t = getTagName(child as Element);
        if (t === "elif" || t === "elseif") {
          branches.push({
            cond: (child as Element).getAttribute("cond") ?? (child as Element).getAttribute("condition") ?? "false",
            node: child as Element,
          });
          continue;
        }
        if (t === "else") { elseNode = child as Element; continue; }
      }
      bodyNodes.push(child);
    }

    if (evaluate(cond, scope.flatten())) {
      const ifScope = createScope(scope);
      const out: OutputNodes = [];
      for (const child of bodyNodes) out.push(...exec(child, ifScope));
      return out;
    }

    for (const branch of branches) {
      if (evaluate(branch.cond, scope.flatten())) {
        return execChildren(branch.node, createScope(scope));
      }
    }

    if (elseNode) return execChildren(elseNode, createScope(scope));
    return [];
  }

  /* ── <switch> / <case> / <default> ─────────────────────── */
  function execSwitch(node: Element, scope: IScope): OutputNodes {
    const expr = node.getAttribute("value") ?? node.getAttribute("val") ?? "undefined";
    const val = evaluate(expr, scope.flatten());
    let defaultNode: Element | null = null;
    let matched = false;
    const out: OutputNodes = [];

    for (const child of getChildNodes(node)) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      const t = getTagName(el);
      if (t === "default") { defaultNode = el; continue; }
      if (t !== "case") continue;

      const matchExpr = el.getAttribute("match") ?? "undefined";
      const matchVal = evaluate(matchExpr, scope.flatten());

      if (!matched && val === matchVal) matched = true;
      if (matched) {
        try {
          out.push(...execChildren(el, createScope(scope)));
        } catch (e) {
          if (e instanceof BreakSignal) return out;
          throw e;
        }
        if (!el.hasAttribute("fallthrough")) break;
      }
    }

    if (!matched && defaultNode) {
      out.push(...execChildren(defaultNode, createScope(scope)));
    }
    return out;
  }

  /* ── <map> ─────────────────────────────────────────────── */
  function execMap(node: Element, scope: IScope): OutputNodes {
    const dataExpr = node.getAttribute("data") ?? node.getAttribute("of") ?? "[]";
    const asName = node.getAttribute("as") ?? node.getAttribute("value") ?? "$v";
    const idxName = node.getAttribute("index") ?? "$i";
    const separator = node.getAttribute("separator") ?? "";
    const saveAs = node.getAttribute("save");
    const arr = evaluate(dataExpr, scope.flatten());
    if (!Array.isArray(arr)) return [];

    const out: OutputNodes = [];
    const saved: string[] = [];

    arr.forEach((item: unknown, idx: number) => {
      const iterScope = createScope(scope);
      iterScope.set(asName, item);
      iterScope.set(idxName, idx);
      iterScope.set("$v", item);
      iterScope.set("$i", idx);
      const nodes = execChildren(node, iterScope);
      withSeparator(out, separator);
      out.push(...nodes);
      if (saveAs) saved.push(nodes.map((n) => n.textContent).join(""));
    });

    if (saveAs) scope.set(saveAs, saved);
    return out;
  }

  /* ── <filter> ──────────────────────────────────────────── */
  function execFilter(node: Element, scope: IScope): OutputNodes {
    const dataExpr = node.getAttribute("data") ?? node.getAttribute("of") ?? "[]";
    const whereExpr = node.getAttribute("where") ?? node.getAttribute("cond") ?? "true";
    const asName = node.getAttribute("as") ?? node.getAttribute("value") ?? "$v";
    const idxName = node.getAttribute("index") ?? "$i";
    const separator = node.getAttribute("separator") ?? "";
    const saveAs = node.getAttribute("save");

    const arr = evaluate(dataExpr, scope.flatten());
    if (!Array.isArray(arr)) return [];

    const filtered = (arr as unknown[]).filter((item: unknown, idx: number) => {
      const testScope = createScope(scope);
      testScope.set(asName, item);
      testScope.set("$v", item);
      testScope.set(idxName, idx);
      testScope.set("$i", idx);
      return Boolean(evaluate(whereExpr, testScope.flatten()));
    });

    if (saveAs) scope.set(saveAs, filtered);

    const out: OutputNodes = [];
    filtered.forEach((item: unknown, idx: number) => {
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

  /* ── <reduce> ──────────────────────────────────────────── */
  function execReduce(node: Element, scope: IScope): OutputNodes {
    const dataExpr = node.getAttribute("data") ?? "[]";
    const accName = node.getAttribute("acc") ?? "acc";
    const initExpr = node.getAttribute("init") ?? "0";
    const itemName = node.getAttribute("item") ?? "$v";
    const exprStr = node.getAttribute("expr") ?? accName;
    const saveAs = node.getAttribute("save") ?? accName;

    const arr = evaluate(dataExpr, scope.flatten());
    const init = evaluate(initExpr, scope.flatten());
    if (!Array.isArray(arr)) return [];

    const result = (arr as unknown[]).reduce((acc: unknown, item: unknown) => {
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

  /* ── <try> / <catch> / <finally> ───────────────────────── */
  function execTry(node: Element, scope: IScope): OutputNodes {
    let catchNode: Element | null = null;
    let finallyNode: Element | null = null;
    const bodyNodes: Node[] = [];

    for (const child of getChildNodes(node)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const t = getTagName(child as Element);
        if (t === "catch") { catchNode = child as Element; continue; }
        if (t === "finally") { finallyNode = child as Element; continue; }
      }
      bodyNodes.push(child);
    }

    let out: OutputNodes = [];
    try {
      const tryScope = createScope(scope);
      for (const child of bodyNodes) out.push(...exec(child, tryScope));
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

export type Executor = ReturnType<typeof createExecutor>;
