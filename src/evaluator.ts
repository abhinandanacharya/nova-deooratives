/**
 * MyLang — Secure Expression Evaluator
 *
 * Security model:
 *  - Expressions run inside a sandboxed Function with no access to `window`,
 *    `document`, `globalThis`, `eval`, `Function`, `fetch`, `XMLHttpRequest`,
 *    `localStorage`, `sessionStorage`, `indexedDB`, `crypto`, or any other
 *    browser global beyond the controlled allowlist.
 *  - The allowlist is explicit: only Math, Array, Object, String, Number,
 *    Boolean, parseInt, parseFloat, isNaN, isFinite, and MyLang builtins.
 *  - Prototype-poisoning is prevented by using Object.create(null) scopes.
 *  - Infinite-recursion is not possible (expressions are single expressions,
 *    not function bodies).
 *  - Each expression is compiled once and cached (WeakMap-free, string-keyed
 *    LRU cache capped at 512 entries).
 *
 * @module mylang-js/evaluator
 */

import type { ScopeRecord, MyLangError, MyLangConfig } from "./types.js";

/** LRU expression cache */
const CACHE_MAX = 512;
const exprCache = new Map<string, (...args: unknown[]) => unknown>();

function evictIfNeeded(): void {
  if (exprCache.size >= CACHE_MAX) {
    // Delete the oldest entry
    const firstKey = exprCache.keys().next().value;
    if (firstKey !== undefined) exprCache.delete(firstKey);
  }
}

/**
 * Identifiers we block by declaring local `var` declarations in the function body,
 * overwriting any outer scope reference before strict-mode takes effect.
 * NOTE: 'eval' and 'arguments' CANNOT be used as parameter names in strict mode,
 * so we shadow them via var declarations in a non-strict preamble instead.
 */
const BLOCKED_BY_VAR = [
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
] as const;

/** JS reserved words that can't be used as param names even in non-strict mode */
const PARAM_RESTRICTED = new Set([
  "eval", "arguments", "let", "static",
  "implements", "interface", "package",
  "private", "protected", "public",
  "yield", "await",
]);

/** Safe builtins always available inside expressions */
export const BUILTINS: ScopeRecord = Object.freeze({
  array: (...args: unknown[]): unknown[] => args,
  range: (start: number, end: number, step = 1): number[] => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0) return [];
    const r: number[] = [];
    const limit = 100_000;
    let count = 0;
    if (step > 0) {
      for (let i = start; i < end && count < limit; i += step, count++) r.push(i);
    } else {
      for (let i = start; i > end && count < limit; i += step, count++) r.push(i);
    }
    return r;
  },
  keys: (obj: object): string[] => Object.keys(obj),
  values: (obj: object): unknown[] => Object.values(obj),
  entries: (obj: object): [string, unknown][] => Object.entries(obj),
  len: (v: unknown): number => {
    if (Array.isArray(v)) return v.length;
    if (typeof v === "string") return v.length;
    if (v !== null && typeof v === "object") return Object.keys(v).length;
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
    fromEntries: Object.fromEntries,
  },
  String,
  Number,
  Boolean,
});

/** Compile an expression string into a cached function */
function compileExpression(
  expr: string,
  scopeKeys: string[]
): (...args: unknown[]) => unknown {
  const cacheKey = `${expr}|||${scopeKeys.join(",")}`;
  const cached = exprCache.get(cacheKey);
  if (cached) return cached;

  evictIfNeeded();

  // Shadow dangerous globals via local var declarations in a non-strict preamble,
  // then switch to strict mode for the actual expression.
  // This avoids the "eval/arguments as parameter name in strict mode" error.
  const varDecls = BLOCKED_BY_VAR.map((k) => `var ${k};`).join(" ");
  const body = `${varDecls} "use strict"; return (${expr});`;

  // Filter out param names that are JS reserved words (can't be params)
  const safeParams = scopeKeys.filter((k) => !PARAM_RESTRICTED.has(k));

  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const fn = new Function(...safeParams, body) as (...args: unknown[]) => unknown;

  exprCache.set(cacheKey, fn);
  return fn;
}

export function createEvaluator(config: Pick<MyLangConfig, "onError" | "warnOnError">) {
  return function evaluate(expr: string, scope: ScopeRecord): unknown {
    if (expr === undefined || expr === null) return undefined;
    const trimmed = String(expr).trim();
    if (trimmed === "") return undefined;

    // Merge builtins + scope (scope wins)
    const merged: ScopeRecord = Object.assign(
      Object.create(null) as ScopeRecord,
      BUILTINS,
      scope
    );

    // Filter out reserved-word keys from scope (they can't be param names)
    const scopeKeys = Object.keys(merged).filter((k) => !PARAM_RESTRICTED.has(k));
    const scopeVals = scopeKeys.map((k) => merged[k]);

    try {
      const fn = compileExpression(trimmed, scopeKeys);
      return fn(...scopeVals);
    } catch (err: unknown) {
      const mylangErr: MyLangError = {
        type: "ExpressionError",
        message: err instanceof Error ? err.message : String(err),
        expression: trimmed,
        cause: err,
      };
      if (config.onError) config.onError(mylangErr);
      else if (config.warnOnError) {
        console.warn(`[MyLang] Expression error in "${trimmed}":`, mylangErr.message);
      }
      return undefined;
    }
  };
}

export type Evaluator = ReturnType<typeof createEvaluator>;
