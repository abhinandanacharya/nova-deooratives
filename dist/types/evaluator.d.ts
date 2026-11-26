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
import type { ScopeRecord, MyLangConfig } from "./types.js";
/** Safe builtins always available inside expressions */
export declare const BUILTINS: ScopeRecord;
export declare function createEvaluator(config: Pick<MyLangConfig, "onError" | "warnOnError">): (expr: string, scope: ScopeRecord) => unknown;
export type Evaluator = ReturnType<typeof createEvaluator>;
//# sourceMappingURL=evaluator.d.ts.map