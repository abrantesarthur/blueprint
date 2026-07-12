---
name: plan
description: Based on a spec file, produces a component manifest (what to build) and a feature list (how it should behave). The component manifest feeds /craft; the feature list feeds /assemble.
disable-model-invocation: true
effort: max
argument-hint: [path-to-spec]
---

## Arguments

The user provides the path to a spec file within `frontend/spec/` (e.g., `/plan frontend/spec/landing-page.md`).

## Steps

### 1. Gather context

- Read the spec. If it does not exist, warn the user and exit. If it has leftover `TODO` or unanswered `Open Questions`, warn the user and exit.
- Read `frontend/src/` to understand what components, hooks, services, and stores already exist.
- Read the component schema at `.claude/skills/craft/component-schema.json`.
- Read the feature schema at `.claude/skills/plan/feature-schema.json`.

### 2. Inspect artboards

Call `get_guide({ topic: "paper-mcp-instructions" })` once to load the Paper MCP guide.

The spec's **Components** section already lists every distinct visual component with its artboard appearances and breakpoint differences. Use it as your starting point — do NOT re-identify components from scratch.

Use Paper MCP to deepen your understanding of each component listed in the spec:

- Call `get_tree_summary` on the artboards where the component appears to understand its node structure and identify child components. Start with the default depth; if a region is too deeply nested, either call again with a higher depth or call on a specific child node ID to drill in cheaply.
- Call `get_screenshot` for visual context.
- Identify composition relationships: which components contain other components.

### 3. Produce the component manifest

Write `frontend/spec/<view>.components.json`, following the schema in `.claude/skills/craft/component-schema.json`.

**Rules for component manifest generation:**

1. **Start from the spec's Components table.** Every component listed there must appear in the manifest. You may add components the spec missed (e.g., small sub-components discovered during artboard inspection), but the spec's inventory is the baseline.

2. **Check for existing components.** For each identified component:
   - Search `frontend/src/components/` and `frontend/src/views/*/components/` for files whose name or purpose might match.
   - For each candidate, **read its source code** and compare its JSX structure against the Paper `get_tree_summary` and screenshot of the new component. Name matches alone are not sufficient — a file named `RatingCard.tsx` may render something entirely different from what Paper shows.
   - If the structure and purpose clearly align, set `existingComponent` to that path. `/craft` will make the final call on reuse vs. extend vs. build new with the dev server running.
   - If a candidate is similar but you're not confident it matches, set `existingComponent` to `null` and mention the candidate in the component's `description` field (e.g., "similar to `src/components/ui/SharpStar.tsx` — verify during craft").
   - Do NOT start the dev server to visually verify — that's `/craft`'s job.

3. **Always include a view-root component.** The manifest MUST include one top-level entry representing the view itself:
   - `name`: `<View>View` (e.g., `SearchView`)
   - `path`: `src/views/<view>/index.tsx`
   - `scope`: `"view"`
   - `composedOf`: every top-level component that appears on the view
   - `artboards`: the full-page artboard IDs (not a child `nodeHint` — the root is the artboard itself)
   - `props`: typically `[]`. The view owns its own state; `/assemble` wires data fetching and callbacks later.
   - `existingComponent`: usually `null` unless a prior view already exists at that path.

4. **Decide scope:**
   - `"shared"` → if the component is used (or likely to be used) by more than one view. Place in `src/components/ui/` for primitives or `src/components/<category>/` for feature-specific shared components.
   - `"view"` → if the component is specific to this view only. Place in `src/views/<view>/components/` (or at `src/views/<view>/index.tsx` for the view-root).

5. **Define props** from what the component needs to render.
   - **Add `isLoading: boolean`** when the component renders data fetched from the backend AND occupies enough visual space, so that `/craft` will render a skeleton (composed from `src/components/ui/Skeleton.tsx`) mirroring the loaded layout.
   - **Skip `isLoading`** for small inline elements where a skeleton adds noise without value — badges, avatars, inline counts, icons, individual buttons.
   - When in doubt, prefer adding it at the container level (e.g., `UserCard` with `isLoading`) rather than on every leaf inside it.

6. **Set `composedOf`** to list other components in this manifest that this component contains. This determines build order in `/craft`.

7. **Set `artboards`** with the Paper artboard IDs (from the spec's Artboards table) and a `nodeHint` describing where to find the component in each artboard's tree. If a component doesn't appear at a certain breakpoint, set that breakpoint to `null`.

8. **Order components** dependency-first: components with no `composedOf` entries come first. The view-root naturally lands last.

9. **Set `status` to either `"pending"` or `"done"` — never `"in_progress"`.** `"in_progress"` is reserved by `/craft` at runtime to mark the component it is actively building; emitting it here would cause `/craft` to skip the component:
   - `"pending"` → the component must be built or extended by `/craft`. Use this both for brand-new components AND for existing components that need modifications for this spec.
   - `"done"` → the component already exists and requires **zero changes** for this spec.

### 4. Produce the feature list

Write `frontend/spec/<view>.features.json`, following the schema in `.claude/skills/plan/feature-schema.json`.

**Rules for feature identification:**

1. You must create features covering everything in the spec: State Machine transitions, Interactions, API Calls, Form Validation, and Responsive Behavior.

2. Each feature MUST reference the components it depends on via the `components` array (using names from the component manifest).

3. Specify features in implementation order: features specified first will be implemented first!

4. Category selection:
   - **functional**: some user action produces a visible outcome (e.g., clicking "submit" shows a success message).
   - **state-transition**: some user action causes navigation to a different page or view.
   - **validation**: verifies that invalid or incomplete input is rejected with appropriate feedback.
   - **api-call**: verifies backend interaction — right endpoint called, HTTP errors handled.
   - **responsive**: verifies layout or interaction differences across viewport sizes.

5. **Set every feature's `status` to `"pending"`.** `"in_progress"` is reserved by `/assemble` at runtime, and `"done"` is only set once `/assemble` has wired and verified the feature. Never emit `"in_progress"` or `"done"` here.

## Output

This skill produces two files:

| File                                   | Consumed by |
| -------------------------------------- | ----------- |
| `frontend/spec/<view>.components.json` | `/craft`    |
| `frontend/spec/<view>.features.json`   | `/assemble` |
