/**
 * MyLang — Scope (variable store with lexical scoping)
 * @module mylang-js/scope
 */
import type { IScope, ScopeRecord } from "./types.js";
export declare class Scope implements IScope {
    private readonly _own;
    readonly parent: IScope | null;
    constructor(parent?: IScope | null, initial?: ScopeRecord);
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    /**
     * Walk up the scope chain and set where the variable was first defined.
     * Falls back to setting locally if not found anywhere above.
     */
    setUpper(key: string, value: unknown): void;
    /** Flatten the full scope chain into a plain object (child wins) */
    flatten(): ScopeRecord;
}
export declare function createScope(parent?: IScope | null, initial?: ScopeRecord): IScope;
//# sourceMappingURL=scope.d.ts.map