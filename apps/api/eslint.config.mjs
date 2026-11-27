import { nestJSConfig } from '@mayday-command/eslint-config/nest-js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import prettier from 'eslint-plugin-prettier';

// The shared NestJS config type-checks every *.ts file against
// tsconfig.json, but tsconfig.json only covers src/ (its rootDir is
// scoped there so production build output stays flat). Test files live
// under tests/unit/ instead, so the type-checked block is told to ignore
// them, and a lighter, non-type-checked block below covers them instead
// (still catches unused vars, prettier formatting, and basic rules).
const baseConfig = nestJSConfig(import.meta.dirname).map((entry) =>
    entry.languageOptions?.parserOptions?.project
        ? { ...entry, ignores: ['tests/**/*.ts'] }
        : entry
);

export default [
    ...baseConfig,
    { ignores: ['jest.config.ts'] },
    {
        files: ['tests/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: { sourceType: 'module' },
            globals: { node: true, jest: true }
        },
        plugins: {
            '@typescript-eslint': typescriptEslint,
            prettier
        },
        rules: {
            ...typescriptEslint.configs.recommended.rules,
            ...prettierConfig.rules,
            'prettier/prettier': 'error',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ]
        }
    }
];
