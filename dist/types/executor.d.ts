/**
 * MyLang — Core Executor (DOM tree walker)
 * Processes each custom tag and returns an array of DOM nodes.
 * @module mylang-js/executor
 */
import type { IScope, MyLangConfig } from "./types.js";
import { BreakSignal, ContinueSignal } from "./types.js";
import type { Evaluator } from "./evaluator.js";
type OutputNodes = Node[];
/** Re-export signals so executor consumers can catch them */
export { BreakSignal, ContinueSignal };
export declare function createExecutor(config: MyLangConfig, evaluate: Evaluator): {
    exec: (node: Node, scope: IScope) => OutputNodes;
    execChildren: (parent: Element | DocumentFragment, scope: IScope) => OutputNodes;
};
export type Executor = ReturnType<typeof createExecutor>;
//# sourceMappingURL=executor.d.ts.map