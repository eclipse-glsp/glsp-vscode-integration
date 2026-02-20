import glspConfig from '@eclipse-glsp/eslint-config';

export default [
    ...glspConfig,
    {
        ignores: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/dist/**', '**/lib/**']
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    name: 'sprotty',
                    message: "The sprotty default exports are customized and reexported by GLSP. Please use '@eclipse-glsp/client' instead"
                },
                {
                    name: 'sprotty-protocol',
                    message:
                        "The sprotty-protocol default exports are customized and reexported by GLSP. Please use '@eclipse-glsp/protocol' or '@eclipse-glsp/client' instead"
                }
            ]
        }
    },
    {
        files: [
            'packages/vscode-integration/**/*.{ts,tsx}',
            'example/workflow/extension/**/*.{ts,tsx}',
            'example/workflow/web-extension/**/*.{ts,tsx}'
        ],
        rules: {
            'import-x/no-unresolved': 'off'
        }
    }
];
