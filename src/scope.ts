/**
 * MyLang — Scope (variable store with lexical scoping)
 * @module mylang-js/scope
 */

import type { IScope, ScopeRecord } from "./types.js";

export class Scope implements IScope {
  private readonly _own: ScopeRecord = Object.create(null) as ScopeRecord;
  public readonly parent: IScope | null;

  constructor(parent: IScope | null = null, initial?: ScopeRecord) {
    this.parent = parent;
    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        this._own[k] = v;
      }
    }
  }

  get(key: string): unknown {
    if (key in this._own) return this._own[key];
    if (this.parent) return this.parent.get(key);
    return undefined;
  }

  set(key: string, value: unknown): void {
    this._own[key] = value;
  }

  /**
   * Walk up the scope chain and set where the variable was first defined.
   * Falls back to setting locally if not found anywhere above.
   */
  setUpper(key: string, value: unknown): void {
    if (key in this._own) {
      this._own[key] = value;
      return;
    }
    if (this.parent) {
      this.parent.setUpper(key, value);
      return;
    }
    // Not found anywhere — define here
    this._own[key] = value;
  }

  /** Flatten the full scope chain into a plain object (child wins) */
  flatten(): ScopeRecord {
    const base: ScopeRecord = this.parent
      ? this.parent.flatten()
      : (Object.create(null) as ScopeRecord);
    return Object.assign(base, this._own);
  }
}

export function createScope(
  parent: IScope | null = null,
  initial?: ScopeRecord
): IScope {
  return new Scope(parent, initial);
}
