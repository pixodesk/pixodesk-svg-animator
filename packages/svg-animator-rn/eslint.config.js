import tseslint from 'typescript-eslint';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

// No `as never` (first-use review §17c): give the value its real type — in tests, `untyped<T>()` for input that is wrong on purpose.
const NO_AS_NEVER = { selector: 'TSAsExpression > TSNeverKeyword', message: 'No `as never`: give the value its real type (tests: `untyped<T>()` for deliberately wrong input).' };
// Tests only (shipped source keeps a few on purpose): give the value its real type, or `untyped<T>()` for deliberately wrong input.
const NO_AS_UNKNOWN_AS = { selector: 'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]', message: 'No `as unknown as` in tests: give the value its real type, or `untyped<T>()` for deliberately wrong input.' };

export default tseslint.config(
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            'react-hooks': reactHooksPlugin,
        },
        rules: {
            // React Hooks (as in the React package)
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',

            // Forbid template literals (e.g., `string ${value}`)
            // Use string concatenation instead: 'string ' + value
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'TemplateLiteral',
                    message: 'Template literals are not allowed. Use string concatenation instead.',
                },
                NO_AS_NEVER,
            ],
        },
    },
    {
        // Tests (and scripts) may use template literals; `as never` and `as unknown as` stay forbidden
        files: ['**/*.test.{ts,tsx}', 'scripts/**/*.ts'],
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
