---
name: craft
description: Builds frontend components from a component manifest, translating Paper designs into React code with pixel-accurate styling. Produces visually verified components before any behavior wiring.
disable-model-invocation: true
effort: max
argument-hint: [path-to-components] [bws access token]
---

## Arguments

The user provides:

1. **Path to component manifest** (required) — e.g., `frontend/spec/search.components.json`
2. **BWS ACCESS TOKEN** (required)

Example invocation:

- `/craft frontend/spec/search.components.json abcdefgh`

## Steps

You MUST implement each step in order. Start from step 1, then 2, then 3. Once you reach steps 4 to 11, implement them in a loop as long as there are still components with `"status": "pending"` to be picked.

### STEP 1: GET YOUR BEARINGS

- Read the component manifest at the provided path.
- Read the corresponding spec file (e.g., `frontend/spec/search.md` for `search.components.json`). If missing, warn the user to run `/spec` first and exit.
- Read `.claude/skills/craft/component-schema.json` to understand the manifest format.
- Read `frontend/src/styles/globals.css` to learn ALL available design tokens (colors, spacing, font sizes, radii, shadows, etc.).
- Scan `frontend/src/components/` for existing shared components.
- Scan `frontend/src/views/` for existing view components.

### STEP 2: START THE SERVERS

- Run `bun dev` to start the frontend and backend servers. Use the BWS ACCESS TOKEN as the BWS_ACCESS_TOKEN environment variable.

### STEP 3: DETERMINE BUILD ORDER

- Sort components so that dependencies are built first: if component A lists component B in its `composedOf` array, B must be built before A.
- Within the same dependency level, build shared-scope components before view-scope components.
- The view-root (`src/views/<view>/index.tsx`) naturally lands last because it composes everything else.

### STEP 4: PICK THE NEXT COMPONENT

- Find the first component in the sorted list with `"status": "pending"`. If none remain, report to the user and exit.
- Set `"status": "in_progress"` for this one picked component.
- Do not touch any other component's status, or any other field of this component, or any other file.

**Anti-patterns to avoid:**

- Tracking progress only in the internal Task tool (TaskCreate/TaskUpdate) and skipping the manifest update.
- Skipping the `pending to in_progress` transition.
- Flipping multiple components to `in_progress` (or to `done`) in a single edit. One component per iteration of Steps 4–10, period.
- Deferring the status write until "after I've understood the design" — write it first, then read Paper.

After this step, the manifest must show exactly one component with `"status": "in_progress"` and zero changes to any other component's status.

### STEP 5: EXTRACT DESIGN TOKENS FROM PAPER

Call `get_guide({ topic: "paper-mcp-instructions" })` once (if not already done this session) to load the Paper MCP guide. Before doing any typographic styling, call `get_font_family_info` to learn the exact font families used in the design.

This is the most critical step. You MUST extract exact values — do not approximate.

For the **view-root component** (`src/views/<view>/index.tsx`), extract only the **outer layout** — page gutters, top-level grid or flex container, section gaps, sidebar width, header/footer positioning. The inner styling of each child component was already locked when that component was built, so don't re-extract it.

For each breakpoint (Desktop, Tablet, Mobile) where the component has an artboard reference:

1. Call `get_tree_summary` on the artboard to locate the component using the `nodeHint`.
2. Once you find the component's node(s), call `get_computed_styles` on them to extract:
   - **Typography**: font-size, font-weight, line-height, letter-spacing, color
   - **Spacing**: padding, margin, gap (all sides)
   - **Sizing**: width, height, min/max constraints
   - **Borders**: border-width, border-color, border-radius
   - **Backgrounds**: background-color, gradients, opacity
   - **Shadows**: box-shadow
   - **Layout**: display, flex-direction, align-items, justify-content
3. Call `get_screenshot` on the component's node for visual reference.

**Map every extracted value to a design token from `globals.css`.** For example:

- If Paper says `font-size: 14px` → use `text-body-md` (since `--text-body-md: 14px`)
- If Paper says `color: #222222` → use `text-foreground` (since `--color-foreground: #222222`)

If a value has NO matching token in `globals.css`, create a new CSS variable in `globals.css` following the existing naming conventions, then use it.

**NEVER hardcode CSS values.** Every color, spacing, font-size, radius, and shadow MUST reference a `globals.css` token via Tailwind classes.

### STEP 6: CHECK FOR EXISTING COMPONENT

Identify the candidate to evaluate:

- If `existingComponent` is set, that's the candidate.
- If `existingComponent` is null but the component's `description` mentions a candidate path (e.g., "similar to `src/components/ui/SharpStar.tsx`"), use that path as the candidate.
- If neither applies, skip to Step 7.

For the candidate, make a deliberate reuse decision by running these checks:

1. **Read the source code** at `existingComponent` to understand its props, variants, and internal structure.
2. **Render it in the browser.** Find a page in the running app where the component is already used (grep its imports), navigate there with Playwright, and take screenshots at Desktop (1440px), Tablet (768px), and Mobile (390px). If no usage exists yet, render it on a temporary route.
3. **Compare against Paper** (screenshots + tokens from Step 5):
   - **Visual identity** — typography, spacing, colors, layout at all breakpoints
   - **Structural similarity** — does the JSX tree match Paper's tree?
   - **Prop adequacy** — can the existing props express what the new use case needs?

Pick one outcome:

- **Reuse as-is** — visual match AND props are sufficient. Import and use; no code changes.
- **Extend** — visual match AND needs extra props or variants (e.g., a new size, a color variant). Add the minimum new props. You MUST verify every other view that imports the component still renders correctly: grep the imports and re-check each usage in the browser at all breakpoints.
- **Use as reference** — partial match. Build a new component, borrowing patterns (prop shapes, internal structure, token usage) from the existing one.
- **Abandon the match** — no meaningful overlap. Proceed as if `existingComponent` were null.

### STEP 7: BUILD THE COMPONENT

Build the component following these rules:

1. **One file, one component** at the path specified in the manifest.
2. **Props**: Implement the exact props listed in the manifest. Do not add extra props the manifest didn't specify.
3. **Skeleton state**: If the manifest includes `isLoading: boolean`, render a skeleton when true that mirrors the actual layout — same structure, same widths, same gaps at every breakpoint. If `isLoading` is not in the manifest, do NOT add it — that decision was made during `/plan`.
4. **Design tokens only**: Use Tailwind classes that reference `globals.css` variables. Zero hardcoded values.
5. **Responsive**: Use Tailwind responsive modifiers (`md:`, `lg:`) for breakpoint differences found in Step 5.
6. **Lucide icons**: If the component needs icons, extract the exact SVG path from Paper via `get_computed_styles` or `get_tree_summary`, then find the matching Lucide icon. Do NOT guess by appearance.
7. **shadcn primitives**: Prefer pulling components via the shadcn MCP tool and adapting them, rather than building from zero.
8. **Copy text**: All user-facing strings go in `src/views/<view>/constants.ts` as a `COPY` object. If the component is shared, strings go in `src/components/constants.ts`.
9. **cursor-pointer**: Every clickable element MUST include `cursor-pointer`.
10. **No app-level behavior**: Do NOT wire API calls, navigation, or cross-component state — expose those via callback props (e.g., `onPress`, `onChange`) for `/assemble` to fill in. Purely local visual state (expand/collapse, hover, internal tab selection) may stay inside the component. Use placeholder/mock data for rendering.
11. **View-root routing**: When building the view-root (`src/views/<view>/index.tsx`), also create `src/app/<view>/page.tsx` if it doesn't already exist. It's a thin Suspense wrapper that imports `<View>View` and exports a default `<View>Page`. You need this file to exist so Step 8 can navigate to `/<view>` in Playwright for verification. Example:

    ```tsx
    import { Suspense } from "react";
    import { SearchView } from "@/views/search";

    export default function SearchPage() {
      return (
        <Suspense fallback={null}>
          <SearchView />
        </Suspense>
      );
    }
    ```

### STEP 8: VERIFY AT ALL BREAKPOINTS

**CRITICAL:** Verification is primarily **numerical**, not visual. Eyeballing screenshots misses off-by-a-few-pixels errors and wrong font weights. Numbers don't.

For each breakpoint (Desktop at 1440px, Tablet at 768px, Mobile at 390px):

1. **Render the component.** For the view-root, navigate to `/<view>` — the route wrapper from rule 11 makes it renderable. For any other component, create a temporary test page that mounts it in isolation.

2. **Extract computed styles from the rendered DOM.** Use `mcp__playwright__browser_evaluate` to call `window.getComputedStyle(element)` on every node that had a token extracted in Step 5. Collect: `font-size`, `font-weight`, `line-height`, `letter-spacing`, `color`, all four `padding-*`, all four `margin-*`, `gap`, `width`, `height`, `border-*`, `border-radius`, `background-color`, `box-shadow`, `display`, `flex-direction`, `align-items`, `justify-content`.

3. **Compare each value against the Paper-extracted value from Step 5.** This is an exact comparison — `16px` ≠ `15px`, `500` ≠ `600`, `rgb(34, 34, 34)` ≠ `rgb(17, 17, 17)`. Record every mismatch.

4. **Sanity-check layout structurally** with a Playwright screenshot vs. a Paper screenshot. This catches things numbers don't: wrong element order, missing/extra nodes, flex direction applied to the wrong parent. Do NOT use screenshots to judge sizes/colors/spacing — trust step 3 for those.

5. **Fix every mismatch and re-run steps 2–4.** Do not proceed to Step 9 until the numerical diff is empty at all three breakpoints.

Also verify the skeleton state (if `isLoading` is in the props):

1. Render with `isLoading={true}` and repeat step 2 on the skeleton tree.
2. Compare the skeleton's computed dimensions and gaps against the loaded layout's — same structure, same sizing, same spacing.

### STEP 9: UPDATE STATUS

- Set `"status": "done"` for the component you just verified, before staging or committing anything.
- Only modify the status field of this one component. Do not touch any other component's status, or any other field of this component, or any other file.

**Anti-patterns to avoid:**

- Building several components, then sweeping all their statuses from `pending` (or `in_progress`) to `done` in a single edit at the end of the run.
- Skipping Step 9 because the code "works fine" — even if the build succeeds, leaving the manifest stale corrupts the input that the next `/craft` invocation will read.
- Running Step 10 first and Step 9 after. The status flip belongs in the same commit as the component's code; do it before `git add`.

After this step, the manifest must show exactly zero components with `"status": "in_progress"`.

### STEP 10: COMMIT

The commit MUST be one component per commit, and it MUST include the manifest's `in_progress → done` flip from Step 9 alongside the component's source files.

Before running `git add`, verify:

- The current component's manifest entry shows `"status": "done"` (Step 9 was performed).
- No other component's status field has changed in this commit.
- Only this component's source files (plus the manifest) appear in the diff. If unrelated work has snuck in, unstage it.

```bash
git add .
git commit -m "craft <ComponentName>

- <one sentence describing what was built>
"
```

**Anti-patterns to avoid:**

- ❌ Bundling multiple components into a single commit (e.g., "craft MenuRow + MenuRowCallout + MenuHeader"). Each component gets its own commit so reviewers, bisects, and `/craft` reruns can reason about them individually.
- ❌ Committing source code without the manifest update, or vice versa.

### STEP 11: NEXT COMPONENT

Go back to Step 4 and pick the next pending component. When all components are done:

1. Ensure no uncommitted changes.
2. Kill all servers you started.

---

## RULES

- This skill is PURELY VISUAL. Do not wire up API calls, routing, or state management.
- ALL visual verification must use Playwright browser automation. Compare against Paper designs.
- Make sure a component doesn't already exist in `frontend/src/components/` or `frontend/src/views/<name>/components/` before building.
- Prefer pulling components via the shadcn MCP tool and adapting them.
- Do NOT modify existing shared components without checking if other views depend on them.
- Do NOT use placeholder images from external URLs.
- Do NOT try to use Paper MCP's `get_fill_image` to pull images. Assets are in `frontend/public/`.
- NEVER hardcode CSS values. ALWAYS reference variables from `globals.css`.
- Extract exact Lucide icon names from Paper SVG paths — do not guess.

## Quality Bar

- Zero hardcoded CSS values — every style maps to a `globals.css` token
- Pixel-accurate match to Paper artboards at all 3 breakpoints
- Skeleton states that mirror the loaded layout
- Clean component API matching the manifest's props
