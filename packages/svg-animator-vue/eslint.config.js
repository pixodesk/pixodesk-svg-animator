import tseslint from 'typescript-eslint';
import vuePlugin from 'eslint-plugin-vue';

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
            ],
        },
    },
    {
        // Exclude test files from this rule
        files: ['src/*.test.ts'],
        rules: {
            'no-restricted-syntax': 'off',
        },
    },
    {
        // No `any`, source or test (first-use review §17c): give the value its real type. A fact TypeScript
        // cannot follow is stated once, by a named cast (`asBuilt`, `drivenByDocument`, the tests' `untyped`).
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: { parser: tseslint.parser },
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: { '@typescript-eslint/no-explicit-any': 'error' },
    }
);
