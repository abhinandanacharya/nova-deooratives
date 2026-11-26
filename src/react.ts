/**
 * MyLang — React integration helper
 * 
 * @example
 * import { MyLangTemplate } from 'mylang-js/react'
 *
 * function App() {
 *   return (
 *     <MyLangTemplate
 *       template={`<for of="items" as="x"><p>{{ x.name }}</p></for>`}
 *       scope={{ items: [{ name: 'Alice' }, { name: 'Bob' }] }}
 *     />
 *   )
 * }
 */

// This is a thin wrapper — the main mylang-js package handles the logic.
// In your project, install both: npm install mylang-js react

export function createReactIntegration(React: {
  useRef: <T>(init: T | null) => { current: T | null };
  useEffect: (fn: () => void | (() => void), deps: unknown[]) => void;
  createElement: (type: string, props: Record<string, unknown> | null, ...children: unknown[]) => unknown;
}) {
  const { useRef, useEffect, createElement } = React;

  function MyLangTemplate({
    template,
    scope = {},
    tag = "div",
    className = "mylang-output",
    ...rest
  }: {
    template: string;
    scope?: Record<string, unknown>;
    tag?: string;
    className?: string;
    [key: string]: unknown;
  }) {
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
      if (!ref.current) return;
      // Dynamically import MyLang to allow SSR
      import("./index.js").then((mod) => {
        const MyLang = mod.default || mod.MyLang;
        MyLang.render(template, ref.current as HTMLElement, { scope });
      });
    }, [template, JSON.stringify(scope)]);

    return createElement(tag, { ref, className, ...rest } as Record<string, unknown>);
  }

  return { MyLangTemplate };
}
