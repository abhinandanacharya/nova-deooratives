/**
 * MyLang — Main Entry Point
 * @module mylang-js
 */
import type { MyLangAPI } from "./types.js";
export type { MyLangAPI, MyLangConfig, RenderOptions, MountOptions, IScope, ScopeRecord, MyLangError, } from "./types.js";
export { BreakSignal, ContinueSignal } from "./types.js";
export { createScope, Scope } from "./scope.js";
export { BUILTINS } from "./evaluator.js";
/** Current library version — keep in sync with package.json */
export declare const VERSION = "1.0.0";
/** The global MyLang instance */
declare const MyLang: MyLangAPI;
export default MyLang;
export { MyLang };
//# sourceMappingURL=index.d.ts.map