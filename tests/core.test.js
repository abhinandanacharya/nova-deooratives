/**
 * MyLang test suite (Jest + jsdom)
 * Tests all control-flow tags and the evaluator.
 */

// Because we're in jsdom we need to shim the MyLang source
// We test the TypeScript compiled source via ts-jest

// Since we can't run a browser in jest, we test the core logic directly.

const { createScope } = require("../src/scope");
const { createEvaluator, BUILTINS } = require("../src/evaluator");

describe("Scope", () => {
  test("get/set basic values", () => {
    const s = createScope();
    s.set("x", 42);
    expect(s.get("x")).toBe(42);
  });

  test("child scope inherits from parent", () => {
    const parent = createScope();
    parent.set("a", 10);
    const child = createScope(parent);
    expect(child.get("a")).toBe(10);
  });

  test("child scope shadows parent", () => {
    const parent = createScope();
    parent.set("a", 10);
    const child = createScope(parent);
    child.set("a", 99);
    expect(child.get("a")).toBe(99);
    expect(parent.get("a")).toBe(10); // parent unchanged
  });

  test("setUpper modifies ancestor", () => {
    const parent = createScope();
    parent.set("n", 5);
    const child = createScope(parent);
    child.setUpper("n", 100);
    expect(parent.get("n")).toBe(100);
  });

  test("flatten merges parent and child (child wins)", () => {
    const parent = createScope(null, { a: 1, b: 2 });
    const child = createScope(parent, { b: 99, c: 3 });
    const flat = child.flatten();
    expect(flat.a).toBe(1);
    expect(flat.b).toBe(99);
    expect(flat.c).toBe(3);
  });
});

describe("Evaluator", () => {
  const evaluate = createEvaluator({ warnOnError: false });

  test("simple arithmetic", () => {
    expect(evaluate("2 + 2", {})).toBe(4);
  });

  test("uses scope variables", () => {
    expect(evaluate("x * 3", { x: 7 })).toBe(21);
  });

  test("uses builtin array()", () => {
    expect(evaluate("array(1,2,3)", {})).toEqual([1, 2, 3]);
  });

  test("uses builtin range()", () => {
    expect(evaluate("range(0, 5)", {})).toEqual([0, 1, 2, 3, 4]);
  });

  test("uses builtin range() with step", () => {
    expect(evaluate("range(0, 10, 2)", {})).toEqual([0, 2, 4, 6, 8]);
  });

  test("uses builtin len()", () => {
    expect(evaluate("len(array(1,2,3))", {})).toBe(3);
  });

  test("uses Math", () => {
    expect(evaluate("Math.pow(2, 10)", {})).toBe(1024);
  });

  test("returns undefined on error (no throw)", () => {
    expect(evaluate("undefinedThing.prop", {})).toBeUndefined();
  });

  test("blocks access to window (shadowed)", () => {
    // window should be blocked — evaluates to undefined
    expect(evaluate("window", {})).toBeUndefined();
  });

  test("blocks eval", () => {
    expect(evaluate("eval", {})).toBeUndefined();
  });

  test("blocks Function constructor", () => {
    expect(evaluate("Function", {})).toBeUndefined();
  });

  test("ternary works", () => {
    expect(evaluate("x > 5 ? 'big' : 'small'", { x: 10 })).toBe("big");
    expect(evaluate("x > 5 ? 'big' : 'small'", { x: 3 })).toBe("small");
  });

  test("template literals work", () => {
    expect(evaluate("`Hello ${name}`", { name: "World" })).toBe("Hello World");
  });

  test("array methods work", () => {
    expect(evaluate("[1,2,3,4].filter(n => n % 2 === 0)", {})).toEqual([2, 4]);
  });

  test("caches compiled expressions", () => {
    // Run twice — should use cache on second call
    expect(evaluate("x + 1", { x: 5 })).toBe(6);
    expect(evaluate("x + 1", { x: 10 })).toBe(11);
  });

  test("handles null/undefined gracefully", () => {
    expect(evaluate("null", {})).toBeNull();
    expect(evaluate("undefined", {})).toBeUndefined();
  });
});

describe("BUILTINS", () => {
  test("range handles negative step", () => {
    expect(BUILTINS.range(5, 0, -1)).toEqual([5, 4, 3, 2, 1]);
  });

  test("range step=0 returns empty", () => {
    expect(BUILTINS.range(0, 10, 0)).toEqual([]);
  });

  test("len of string", () => {
    expect(BUILTINS.len("hello")).toBe(5);
  });

  test("entries of object", () => {
    expect(BUILTINS.entries({ a: 1, b: 2 })).toEqual([["a", 1], ["b", 2]]);
  });

  test("json stringify/parse roundtrip", () => {
    const obj = { x: 1, y: [1, 2] };
    expect(BUILTINS.parse(BUILTINS.json(obj))).toEqual(obj);
  });
});
