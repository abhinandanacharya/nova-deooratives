# Contributing to MyLang.js

Thank you for your interest in contributing! 🎉

## Development Setup

```bash
git clone https://github.com/abhinandanacharya/nova-deooratives.git
cd mylang-js
npm install
npm run dev        # TypeScript watch mode
npm test           # Run all tests
npm run build      # Full production build
```

## Project Structure

```
mylang-js/
├── src/
│   ├── index.ts       — Main entry point & public API
│   ├── types.ts       — TypeScript interfaces & signal classes
│   ├── scope.ts       — Lexical scope implementation
│   ├── evaluator.ts   — Secure expression evaluator
│   ├── executor.ts    — DOM tag processor / executor
│   └── react.ts       — React integration helper
├── tests/
│   └── core.test.js   — Jest test suite
├── scripts/
│   ├── build.mjs      — esbuild bundle script
│   └── minify.mjs     — Minification script
├── docs/
│   └── index.html     — Documentation site (multi-language)
├── dist/              — Built output (committed for CDN)
├── examples/          — Real-world usage examples
├── package.json
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

## Submitting Changes

1. **Fork** the repository
2. Create a **feature branch**: `git checkout -b feat/my-feature`
3. **Write tests** for new tags/features in `tests/`
4. Ensure **all tests pass**: `npm test`
5. Run the **build**: `npm run build`
6. Submit a **Pull Request** with a clear description

## Adding a New Tag

1. Add the TypeScript interface to `src/types.ts` if needed
2. Implement the handler as `execMyTag(node, scope)` in `src/executor.ts`
3. Add the case to the `switch` in `exec()`
4. Write tests in `tests/core.test.js`
5. Document the tag in `README.md` and `docs/index.html`

## Code Style

- TypeScript strict mode — no `any`
- All public functions must have JSDoc comments
- Follow existing naming conventions: `exec*` for tag handlers
- Keep the security model intact — never expose blocked globals

## Reporting Bugs

Open an issue at https://github.com/abhinandanacharya/nova-deooratives/issues

Include:
- MyLang version
- Browser / Node.js version
- Minimal reproduction (template + expected vs actual output)

## License

By contributing, you agree your code is released under the MIT license.
