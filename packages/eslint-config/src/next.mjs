// NPM Modules
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettierConfig from 'eslint-config-prettier';
import prettier from 'eslint-plugin-prettier';

// Custom Modules
import { baseConfig } from './base.mjs';

export const nextJSConfig = (tsconfigRootDir) => [
    ...baseConfig,
    ...nextVitals,
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: { jsx: true },
                project: ['./tsconfig.json'],
                tsconfigRootDir,
                sourceType: 'module'
            },
            globals: {
                node: true
            }
        },
        plugins: {
            '@typescript-eslint': typescriptEslint,
            prettier
        },
        rules: {
            ...typescriptEslint.configs.recommended.rules,
            ...prettierConfig.rules,
            'prettier/prettier': 'error',

            '@next/next/no-img-element': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off'
        }
    }
];
