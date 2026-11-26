/**
 * MyLang — Types & Interfaces
 * @module mylang-js/types
 */
/** A flat key→value record for scope bindings */
export type ScopeRecord = Record<string, unknown>;
/** The public scope interface */
export interface IScope {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    setUpper(key: string, value: unknown): void;
    flatten(): ScopeRecord;
    readonly parent: IScope | null;
}
/** Built-in helper functions available inside every expression */
export interface BuiltinHelpers {
    array: (...args: unknown[]) => unknown[];
    range: (start: number, end: number, step?: number) => number[];
    keys: (obj: object) => string[];
    values: (obj: object) => unknown[];
    entries: (obj: object) => [string, unknown][];
    len: (v: unknown[] | object) => number;
    str: typeof String;
    num: typeof Number;
    bool: typeof Boolean;
    json: typeof JSON.stringify;
    parse: typeof JSON.parse;
    Math: typeof Math;
    parseInt: typeof parseInt;
    parseFloat: typeof parseFloat;
    isNaN: typeof isNaN;
    isFinite: typeof isFinite;
    Array: typeof Array;
    Object: typeof Object;
    String: typeof String;
    Number: typeof Number;
    Boolean: typeof Boolean;
}
/** Options for MyLang.render() */
export interface RenderOptions {
    /** Initial variable bindings */
    scope?: ScopeRecord;
    /** Whether to clear the container before rendering (default: true) */
    clear?: boolean;
    /**
     * Maximum loop iterations before safety cutoff.
     * Default: 100_000
     */
    maxIterations?: number;
    /**
     * Error handler. If provided, errors are passed here instead of
     * silently swallowed. Useful for debugging.
     */
    onError?: (error: MyLangError) => void;
}
/** Options for MyLang.mount() */
export interface MountOptions extends RenderOptions {
    /** CSS selector or Element for the script source */
    source?: string | Element;
    /** CSS selector or Element for the output target */
    target?: string | Element;
}
/** Structured error from MyLang */
export interface MyLangError {
    type: "ExpressionError" | "RenderError" | "SecurityError";
    message: string;
    expression?: string;
    tag?: string;
    cause?: unknown;
}
/** The main MyLang public API */
export interface MyLangAPI {
    /**
     * Render a MyLang template string into a container element.
     *
     * @example
     * MyLang.render(
     *   `<for of="items" as="x"><p>{{ x }}</p></for>`,
     *   document.getElementById('output')!,
     *   { scope: { items: [1, 2, 3] } }
     * );
     */
    render(template: string, container: Element, options?: RenderOptions): void;
    /**
     * Mount all `<script type="text/mylang">` tags on the page.
     * Called automatically on DOMContentLoaded.
     */
    mount(options?: MountOptions): void;
    /**
     * Evaluate a single expression string in a given scope.
     * Returns `undefined` on error (or calls onError if configured).
     *
     * @example
     * MyLang.evaluate("x * 2 + 1", { x: 5 }) // → 11
     */
    evaluate(expression: string, scope?: ScopeRecord): unknown;
    /**
     * Create a new scope, optionally inheriting from a parent scope.
     */
    createScope(parent?: IScope | null, initial?: ScopeRecord): IScope;
    /** MyLang version string */
    readonly version: string;
    /** Global configuration */
    config: MyLangConfig;
}
/** Global configuration object */
export interface MyLangConfig {
    /** Maximum iterations for any loop. Default: 100_000 */
    maxIterations: number;
    /** Whether to log warnings to console. Default: true */
    warnOnError: boolean;
    /** Custom error handler */
    onError?: ((error: MyLangError) => void) | undefined;
    /** Interpolation delimiters. Default: ['{{', '}}'] */
    delimiters: [string, string];
    /**
     * Security: list of JS globals allowed inside expressions.
     * If set, only these identifiers are exposed.
     * Leave undefined to use the built-in safe allowlist.
     */
    allowedGlobals?: string[];
}
/** Internal signals */
export declare class BreakSignal extends Error {
    readonly isBreak: true;
    constructor();
}
export declare class ContinueSignal extends Error {
    readonly isContinue: true;
    constructor();
}
//# sourceMappingURL=types.d.ts.map