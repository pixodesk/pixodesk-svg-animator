import tseslint from 'typescript-eslint';

// No `as never` (first-use review §17c): give the value its real type — in tests, `untyped<T>()` for input that is wrong on purpose.
const NO_AS_NEVER = { selector: 'TSAsExpression > TSNeverKeyword', message: 'No `as never`: give the value its real type (tests: `untyped<T>()` for deliberately wrong input).' };

export default tseslint.config(
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
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
        // Tests (and scripts) may use template literals; `as never` stays forbidden
        files: ['**/*.test.ts', 'scripts/**/*.ts'],
        rules: {
            'no-restricted-syntax': ['error', NO_AS_NEVER],
        },
    },
    {
        // e2e specs and the bundle tests are tests too
        files: ['e2e/**/*.ts', 'bundle-tests/**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        rules: { 'no-restricted-syntax': ['error', NO_AS_NEVER] },
    },
    {
        // No `any`, source or test (first-use review §17c): give the value its real type. A fact TypeScript
        // cannot follow is stated once, by a named cast (`asBuilt`, `drivenByDocument`, the tests' `untyped`).
        files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts', 'bundle-tests/**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-non-null-assertion': 'error' },
    }
);
