import glspConfig from '@eclipse-glsp/eslint-config';

/**
 * Import specifiers that resolve to the importing module's own directory barrel or to one of its
 * parent barrels, up to `depth` levels: `'.'`, `'..'`, `'../..'`, ...
 */
function ownAndParentBarrels(depth) {
    return [
        '.',
        ...Array.from({ length: depth }, (_, level) =>
            Array(level + 1)
                .fill('..')
                .join('/')
        )
    ];
}

export default [
    ...glspConfig,
    {
        ignores: [
            '**/*.js',
            '**/*.mjs',
            '**/*.cjs',
            '**/dist/**',
            '**/lib/**',
            '.worktrees/**',
            // E2E run artifacts. `.vscode-test` holds a full VS Code installation, including
            // bundled extensions that ship eslint configs of their own.
            '**/.vscode-test/**',
            '**/playwright-report/**',
            '**/test-results/**'
        ]
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
    },
    // E2E packages (migrated from glsp-playwright). Kept in sync with the equivalent block in
    // glsp-core, which owns the framework these packages build on.
    {
        files: ['e2e/**/*.{ts,tsx}'],
        rules: {
            // A dangling promise in a page object silently drops the Playwright action it wraps.
            '@typescript-eslint/no-floating-promises': 'error',
            // Playwright's API returns `null` for absent elements, which the page objects pass through.
            'no-null/no-null': 'off',
            // The typescript-eslint variant is required for `allowTypeImports` below.
            'no-restricted-imports': 'off',
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    paths: [
                        // `'.'`, `'..'`, `'../..'`, ... resolve to an own or parent barrel, which
                        // re-exports the importing module itself. Type-only is fine, because the
                        // import erases; a value import closes a runtime cycle and yields a
                        // partially initialized module.
                        ...ownAndParentBarrels(10).map(name => ({
                            name,
                            allowTypeImports: true,
                            message:
                                'Importing an own or parent barrel closes a runtime import cycle. Import the defining ' +
                                'module directly, or keep the import type-only with `import type`.'
                        })),
                        { name: 'src' }
                    ],
                    patterns: [
                        { group: ['**/../index'] },
                        {
                            group: [
                                '@eclipse-glsp/playwright*/src/**',
                                '@eclipse-glsp/playwright*/lib/**',
                                '@eclipse-glsp-examples/workflow-e2e*/src/**',
                                '@eclipse-glsp-examples/workflow-e2e*/lib/**'
                            ],
                            message:
                                'Import from the package root instead. Deep imports are resolved by the Playwright require hook ' +
                                'and load a second copy of the module graph. If a symbol is unreachable, export it from the barrel.'
                        }
                    ]
                }
            ]
        }
    }
];
