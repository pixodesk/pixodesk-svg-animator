import tseslint from 'typescript-eslint';
import vuePlugin from 'eslint-plugin-vue';

// No `as never` (first-use review §17c): give the value its real type — in tests, `untyped<T>()` for input that is wrong on purpose.
const NO_AS_NEVER = { selector: 'TSAsExpression > TSNeverKeyword', message: 'No `as never`: give the value its real type (tests: `untyped<T>()` for deliberately wrong input).' };
// No `as unknown as`, source or test: the real type, a named cast helper (`asTupleItems`, `isTimelineCtor`, …), or `untyped<T>()` in tests.
const NO_AS_UNKNOWN_AS = { selector: 'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]', message: 'No `as unknown as`: give the value its real type — or a named cast helper where TypeScript cannot follow (tests: `untyped<T>()`).' };

export default tseslint.config(
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['src/*.test.ts'],
                },
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            'vue': vuePlugin,
        },
        rules: {
            // Forbid template literals (matching web/react package convention)
            // Use string concatenation instead: 'string ' + value
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'TemplateLiteral',
                    message: 'Template literals are not allowed. Use string concatenation instead.',
                },
                NO_AS_NEVER,
                NO_AS_UNKNOWN_AS,
            ],
        },
    },
    {
        // Tests (and scripts) may use template literals; `as never` and `as unknown as` stay forbidden
        files: ['src/*.test.ts'],
        rules: {
            'no-restricted-syntax': ['error', NO_AS_NEVER, NO_AS_UNKNOWN_AS],
        },
    },
    {
        // No `any`, source or test (first-use review §17c): give the value its real type. A fact TypeScript
        // cannot follow is stated once, by a named cast (`asBuilt`, `drivenByDocument`, the tests' `untyped`).
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: { parser: tseslint.parser },
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-non-null-assertion': 'error' },
    }
);
