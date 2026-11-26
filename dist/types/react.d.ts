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
export declare function createReactIntegration(React: {
    useRef: <T>(init: T | null) => {
        current: T | null;
    };
    useEffect: (fn: () => void | (() => void), deps: unknown[]) => void;
    createElement: (type: string, props: Record<string, unknown> | null, ...children: unknown[]) => unknown;
}): {
    MyLangTemplate: ({ template, scope, tag, className, ...rest }: {
        template: string;
        scope?: Record<string, unknown>;
        tag?: string;
        className?: string;
        [key: string]: unknown;
    }) => unknown;
};
//# sourceMappingURL=react.d.ts.map