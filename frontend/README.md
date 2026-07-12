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

## Design-to-Code Workflow

We use a 4-step pipeline to go from Paper designs to working code. Each step has a dedicated Claude Code skill.

```
/spec → you review → /plan → you review → /craft (components) → /assemble (behavior)
```

| Step        | Skill                  | Input                 | Output                                                                 | Human action                                          |
| ----------- | ---------------------- | --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| 1. Spec     | `/spec <view>`         | View name + Artboards | `frontend/spec/<view>.md`                                              | Review spec. Fill in TODOs and answer open questions. |
| 2. Plan     | `/plan <spec>`         | Spec                  | `frontend/spec/<view>.components.json` + `<view>.features.json`        | Review component manifest and feature list.           |
| 3. Craft    | `/craft <components>`  | Component manifest    | Component files in `src/views/<view>/components/` + `src/components/`  | Review crafted components for visual accuracy.        |
| 4. Assemble | `/assemble <features>` | Feature list          | Wired-up view with state, API calls, navigation                        | Review assembled view for behavioral correctness.     |

**Key files:**

- `frontend/spec/artboard-ids.md` — maps every artboard name to its Desktop/Tablet/Mobile Paper IDs
- `frontend/spec/<view>.md` — behavior spec (states, interactions, API calls, validation)
- `frontend/spec/<view>.components.json` — component manifest (what to build, with Paper artboard references)
- `frontend/spec/<view>.features.json` — behavioral feature requirements (references components by name)
- `.claude/skills/spec/template.md` — template used by `/spec` to scaffold new specs
- `.claude/skills/craft/component-schema.json` — schema for the component manifest

## Design Tokens

All Tailwind/CSS token values live in `src/styles/globals.css`. Components must
reference tokens by name — hardcoded arbitrary values (e.g., `text-[15px]`,
`bg-[#fff]`) are rejected by the `validate:css-tokens` pre-commit hook. Add a
new token to `globals.css` when none fits.
