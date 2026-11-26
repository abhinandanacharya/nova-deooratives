/**
 * MyLang — Main Entry Point
 * @module mylang-js
 */

import type {
  MyLangAPI,
  MyLangConfig,
  MyLangError,
  RenderOptions,
  MountOptions,
  IScope,
  ScopeRecord,
} from "./types.js";
import { createScope as _createScope } from "./scope.js";
import { createEvaluator } from "./evaluator.js";
import { createExecutor } from "./executor.js";

export type {
  MyLangAPI,
  MyLangConfig,
  RenderOptions,
  MountOptions,
  IScope,
  ScopeRecord,
  MyLangError,
} from "./types.js";
export { BreakSignal, ContinueSignal } from "./types.js";
export { createScope, Scope } from "./scope.js";
export { BUILTINS } from "./evaluator.js";

/** Current library version — keep in sync with package.json */
export const VERSION = "1.0.0";

/** Default global config */
const defaultConfig: MyLangConfig = {
  maxIterations: 100_000,
  warnOnError: true,
  delimiters: ["{{", "}}"],
};

function buildMyLang(): MyLangAPI {
  let config: MyLangConfig = { ...defaultConfig };

  function getEvaluator() {
    return createEvaluator({ onError: config.onError, warnOnError: config.warnOnError });
  }

  function getExecutor() {
    return createExecutor(config, getEvaluator());
  }

  const ML_TAG_NAMES =
    "for|each|repeat|while|dowhile|if|elif|elseif|else|switch|case|default|map|filter|reduce|try|catch|finally|let|print|log|break|continue";

  const ML_OPEN_RE = new RegExp(
    `<(${ML_TAG_NAMES})((?:\\s+(?:"[^"]*"|'[^']*'|[^>"'/]|/(?!>))*)?)\\s*(\\/?)>`,
    "gi"
  );
  const ML_CLOSE_RE = new RegExp(`</(${ML_TAG_NAMES})\\s*>`, "gi");

  /**
   * Parse a MyLang template string into a temporary DOM element.
   * Rewrites MyLang tags into `<template data-ml-tag="...">` so the browser's
   * HTML5 parser never foster-parents `<for>`/`<if>` out of `<table>`/`<tr>`/`<select>`,
   * and self-closing tags like `<let ... />` or `<break />` never swallow siblings.
   */
  function parse(template: string): Element {
    const normalized = template
      .replace(ML_OPEN_RE, (_, tag: string, attrs: string, selfClose: string) => {
        const lower = tag.toLowerCase();
        return selfClose
          ? `<template data-ml-tag="${lower}"${attrs}></template>`
          : `<template data-ml-tag="${lower}"${attrs}>`;
      })
      .replace(ML_CLOSE_RE, "</template>");

    const wrapper = document.createElement("div");
    wrapper.innerHTML = normalized;
    return wrapper;
  }

  function render(
    template: string,
    container: Element,
    options: RenderOptions = {}
  ): void {
    const mergedConfig: MyLangConfig = {
      ...config,
      ...(options.maxIterations !== undefined ? { maxIterations: options.maxIterations } : {}),
      ...(options.onError !== undefined ? { onError: options.onError } : {}),
    };

    const evaluator = createEvaluator({
      onError: mergedConfig.onError,
      warnOnError: mergedConfig.warnOnError,
    });
    const executor = createExecutor(mergedConfig, evaluator);

    const scope = _createScope(null, options.scope ?? {});
    const wrapper = parse(template);
    const nodes = executor.execChildren(wrapper, scope);

    if (options.clear !== false) container.innerHTML = "";
    nodes.forEach((n) => container.appendChild(n));
  }

  function parseScriptScope(scriptEl: Element): ScopeRecord {
    const scope: ScopeRecord = {};

    // 1. Optional global variable reference: <script type="text/mylang" data-var="PAGE_DATA">
    const varName = scriptEl.getAttribute("data-var");
    if (varName && typeof window !== "undefined") {
      const globalVal = (window as unknown as Record<string, unknown>)[varName];
      if (globalVal && typeof globalVal === "object" && !Array.isArray(globalVal)) {
        Object.assign(scope, globalVal);
      } else if (globalVal !== undefined) {
        scope["data"] = globalVal;
      }
    }

    // 2. Optional inline JSON: <script type="text/mylang" data-scope='<?= json_encode(...) ?>'>
    const rawJson = scriptEl.getAttribute("data-scope");
    if (rawJson) {
      try {
        const parsed: unknown = JSON.parse(rawJson);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.assign(scope, parsed);
        } else {
          scope["data"] = parsed;
        }
      } catch (err) {
        const mylangErr: MyLangError = {
          type: "RenderError",
          message: `Invalid JSON in data-scope attribute: ${err instanceof Error ? err.message : String(err)}`,
          cause: err,
        };
        if (config.onError) config.onError(mylangErr);
        else if (config.warnOnError) console.warn("[MyLang]", mylangErr.message);
      }
    }

    return scope;
  }

  function runScript(scriptEl: Element): void {
    const targetSel = scriptEl.getAttribute("target");
    let container: Element | null;

    if (targetSel) {
      container = document.querySelector(targetSel);
    } else {
      container = document.createElement("div");
      container.className = "mylang-output";
      scriptEl.parentNode?.insertBefore(container, scriptEl.nextSibling);
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

  function mount(options: MountOptions = {}): void {
    const scripts = document.querySelectorAll('script[type="text/mylang"]');
    scripts.forEach(runScript);
  }

  function evaluate(expression: string, scope: ScopeRecord = {}): unknown {
    return getEvaluator()(expression, scope);
  }

  function createScope(
    parent: IScope | null = null,
    initial: ScopeRecord = {}
  ): IScope {
    return _createScope(parent, initial);
  }

  const api: MyLangAPI = {
    get version() { return VERSION; },
    get config() { return config; },
    set config(newConfig: MyLangConfig) { config = { ...config, ...newConfig }; },
    render,
    mount,
    evaluate,
    createScope,
  };

  return api;
}

/** The global MyLang instance */
const MyLang = buildMyLang();

export default MyLang;
export { MyLang };

/* ─── Auto-mount on DOMContentLoaded (browser only) ─── */
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => MyLang.mount());
  } else {
    // Already loaded (e.g., deferred script)
    MyLang.mount();
  }
}

/* ─── UMD/global export ─── */
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["MyLang"] = MyLang;
}
