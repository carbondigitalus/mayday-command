// NPM Modules
import prettierConfig from 'eslint-config-prettier';
import prettier from 'eslint-plugin-prettier';

export const baseConfig = [
    {
        ignores: ['dist/**', 'node_modules/**']
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                node: true,
                jest: true
            }
        },
        plugins: {
            prettier
        },
        rules: {
            ...prettierConfig.rules,
            'prettier/prettier': 'error'
        }
    }
];
