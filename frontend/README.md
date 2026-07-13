# Blueprint Frontend

Next.js frontend scaffold for the Blueprint monorepo.

## Getting Started

```bash
# Start development server
bun dev

# Typecheck
bun typecheck

# Validate CSS token usage
bun run validate:css-tokens
```

## Design Tokens

All Tailwind/CSS token values live in `src/styles/globals.css`. Components must
reference tokens by name — hardcoded arbitrary values (e.g., `text-[15px]`,
`bg-[#fff]`) are rejected by the `validate:css-tokens` pre-commit hook. Add a
new token to `globals.css` when none fits.
