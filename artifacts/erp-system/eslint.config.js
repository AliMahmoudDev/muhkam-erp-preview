import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

/* ══════════════════════════════════════════════════════════════════
   Local plugin: erp/no-hardcoded-colors
   Prevents regression of hardcoded Tailwind color classes and inline
   hex values — enforces the MUHKAM design-token layer.

   Catches:
     • text-white[/*]    in className  → use text-ink[/*]
     • bg-white/*        in className  → use bg-surface / bg-raised
     • border-white/*    in className  → use border-line
     • #rrggbb hex       in style prop → use var(--bg-card) etc.

   Does NOT catch (known limitation): cn() calls, template literals,
   computed class names. Those require a separate codemod pass.
   ══════════════════════════════════════════════════════════════════ */
const erpNoHardcodedColors = {
  rules: {
    'no-hardcoded-colors': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow hardcoded Tailwind color classes and hex values — use design tokens instead',
        },
        schema: [],
        messages: {
          textWhite:
            'Replace "text-white" with "text-ink" (design token). For opacity: text-ink/{{opacity}}',
          bgWhite:
            'Replace "{{cls}}" with bg-surface or bg-raised (design tokens that flip light/dark)',
          borderWhite:
            'Replace "border-white/..." with "border-line" (design token)',
          hexInStyle:
            'Replace hex color "{{hex}}" with a CSS variable token, e.g. var(--bg-card), var(--bg-app)',
        },
      },
      create(context) {
        /**
         * Check a string value from a JSX attribute for forbidden patterns.
         * Reports issues on the provided AST node.
         */
        function checkClassName(node, value) {
          if (typeof value !== 'string') return;

          // text-white (with or without opacity modifier)
          if (/\btext-white\b/.test(value)) {
            context.report({
              node,
              messageId: 'textWhite',
              data: { opacity: '50' },
            });
          }

          // bg-white/* patterns
          const bgWhiteMatch = value.match(/\bbg-white\/[^\s"'`]+/);
          if (bgWhiteMatch) {
            context.report({
              node,
              messageId: 'bgWhite',
              data: { cls: bgWhiteMatch[0] },
            });
          }

          // border-white/* patterns
          if (/\bborder-white\//.test(value)) {
            context.report({
              node,
              messageId: 'borderWhite',
            });
          }
        }

        return {
          JSXAttribute(node) {
            const attrName =
              node.name && (node.name.name || node.name.type);

            // ── className prop ──────────────────────────────────────
            if (attrName === 'className') {
              const val = node.value;
              if (!val) return;

              if (val.type === 'Literal' && typeof val.value === 'string') {
                checkClassName(val, val.value);
              }
              // JSXExpressionContainer with a string literal inside
              if (
                val.type === 'JSXExpressionContainer' &&
                val.expression.type === 'Literal' &&
                typeof val.expression.value === 'string'
              ) {
                checkClassName(val.expression, val.expression.value);
              }
            }

            // ── style prop — check for hex color literal values ────
            if (attrName === 'style') {
              const val = node.value;
              if (!val || val.type !== 'JSXExpressionContainer') return;
              const expr = val.expression;
              if (!expr || expr.type !== 'ObjectExpression') return;

              for (const prop of expr.properties) {
                if (
                  prop.type === 'Property' &&
                  prop.value.type === 'Literal' &&
                  typeof prop.value.value === 'string' &&
                  /^#[0-9a-fA-F]{3,8}$/.test(prop.value.value)
                ) {
                  context.report({
                    node: prop.value,
                    messageId: 'hexInStyle',
                    data: { hex: prop.value.value },
                  });
                }
              }
            }
          },
        };
      },
    },
  },
};

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'vite.config.ts', 'vitest.config.ts'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooksPlugin,
      erp: erpNoHardcodedColors,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'off',
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',

      // ── Design-token enforcement ──────────────────────────────────
      // Prevents re-introducing hardcoded Tailwind color classes
      // or inline hex values after the token-codemod migration.
      // Set to 'warn' during migration; upgrade to 'error' once clean.
      'erp/no-hardcoded-colors': 'error',
    },
  },
];
