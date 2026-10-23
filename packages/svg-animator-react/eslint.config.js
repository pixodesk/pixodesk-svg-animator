import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

// No `as never` (first-use review §17c): give the value its real type — in tests, `untyped<T>()` for input that is wrong on purpose.
const NO_AS_NEVER = { selector: 'TSAsExpression > TSNeverKeyword', message: 'No `as never`: give the value its real type (tests: `untyped<T>()` for deliberately wrong input).' };
// No `as unknown as`, source or test: the real type, a named cast helper (`asTupleItems`, `isTimelineCtor`, …), or `untyped<T>()` in tests.
const NO_AS_UNKNOWN_AS = { selector: 'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]', message: 'No `as unknown as`: give the value its real type — or a named cast helper where TypeScript cannot follow (tests: `untyped<T>()`).' };

export default tseslint.config(
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['src/*.test.{ts,tsx}'],
                },
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            'react': reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            // React recommended rules
            'react/jsx-key': 'error',
            'react/jsx-no-duplicate-props': 'error',
            'react/jsx-no-undef': 'error',
            'react/no-children-prop': 'error',
            'react/no-deprecated': 'warn',
            'react/no-direct-mutation-state': 'error',
            'react/no-unknown-property': 'error',
            'react/react-in-jsx-scope': 'off',  // Not required with React 17+ JSX transform
            'react/prop-types': 'off',           // Covered by TypeScript

            // React Hooks
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',

            // Forbid template literals (matching web package convention)
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
        files: ['**/*.test.{ts,tsx}'],
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
