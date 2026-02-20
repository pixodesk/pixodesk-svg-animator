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
    }
);
