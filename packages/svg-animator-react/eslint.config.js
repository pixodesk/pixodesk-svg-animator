import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

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
            ],
        },
    },
    {
        // Exclude test files from this rule
        files: ['**/*.test.{ts,tsx}'],
        rules: {
            'no-restricted-syntax': 'off',
        },
    }
);
