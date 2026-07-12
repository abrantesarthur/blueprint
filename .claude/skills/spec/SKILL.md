---
name: spec
description: Generates a frontend behavior spec from Paper artboards. Takes a view name and artboard names, reads designs via Paper MCP, and scaffolds a spec file with TODOs for how to transform the paper designs into code.
disable-model-invocation: true
effort: max
argument-hint: [view], [artboards]
---

## Arguments

The user provides:

1. **View** (required) — e.g., Search, Signup
2. **Artboard names** (optional) — comma-separated list of artboard base names (without Desktop/Tablet/Mobile prefix). If omitted, ask the user.

Example invocations:

- `/spec Signup, Signup (Step 1), Signup (Step 2), Signup (Step 3)"`

In this case, "Signup" is the view name, and "Signup (Step 1)", "Signup (Step 2)", and "Signup (Step 3)" are the artboard names.

## Steps

### 1. Resolve artboard IDs

Read `frontend/spec/artboard-ids.md` to find the Desktop, Tablet, and Mobile IDs for each artboard name the user listed. If an artboard name doesn't match, ask the user to clarify.

### 2. Inspect artboards via Paper MCP

Before inspecting artboards, call `get_guide({ topic: "paper-mcp-instructions" })` once to load the Paper MCP guide.

For each unique artboard state, inspect **all three variants** (Desktop, Tablet, Mobile):

- Call `get_tree_summary` on each variant to identify UI elements (buttons, inputs, dropdowns, text, icons). Start with the default depth; if a region is too deeply nested to understand, either call again with a higher depth or call on a specific child node ID to drill in cheaply.
- Call `get_screenshot` on each variant for visual context.

Compare across breakpoints to identify:

- Elements that only appear in certain breakpoints.
- Layout patterns that change structure (e.g., sidebar on Desktop → bottom sheet on Mobile).
- Content differences (e.g., truncated text on Mobile, full text on Desktop).

While inspecting, identify the following — you will use this information to fill in the spec template in step 4:

- **Interactive elements** - feed the **Interactions** table (buttons, inputs, links, tabs, toggles)
- **Text content** - user-facing string (headings, labels, placeholders, CTAs)
- **Navigation elements** → inform the **State Machine** (bottom nav, header, breadcrumbs, buttons)
- **Distinct visual components** - feed the **Components** table. A visual component is a self-contained UI piece that could be built independently (cards, modals, form sections, badges, etc.). Note which artboards each component appears in and any structural differences across breakpoints.
- **Breakpoint differences** (behavioral and structural) → feed the **Responsive Behavior** table

### 3. Inspect backend endpoints

Read the relevant backend module files to identify API endpoints this view might use. This will feed the **API Calls** section of the template in Step 4.

### 4. Generate the spec

Read the template at `.claude/skills/spec/template.md` and fill it in:

- **Artboards table**: Fill completely from artboard-ids.md + Paper inspection.
- **State Machine**: Infer transitions from artboard names (e.g., "Step 1" → "Step 2" → "Step 3"). If can't infer from the names, infer from the order in which they were provided in the argument to this skill. Mark uncertain transitions with `TODO: confirm`.
- **Interactions**: List every interactive element found. Fill in the Element and Action columns. For the Behavior column:
  - Fill in obvious behaviors (e.g., close button → close modal, backdrop → dismiss)
  - For navigation, write `TODO: confirm destination route`
  - For API calls, fill in the endpoint if identified from step 3, otherwise write `TODO: identify endpoint`
- **API Calls**: Fill in known endpoints from step 3. Write `TODO` for unidentified triggers.
- **Data Requirements**: Infer from the content visible in artboards. Mark with `TODO` if uncertain.
- **Form Validation**: List all form fields found. Write `TODO: confirm rules` for each.
- **Components**: List every distinct visual component identified in step 2. For each, note which artboards it appears in and any structural differences across breakpoints (e.g., "sidebar on Desktop, bottom sheet on Mobile"). This inventory is consumed by `/plan` to generate the component manifest — be thorough.
- **Responsive Behavior**: Document structural and behavioral differences found by comparing the Desktop, Tablet, and Mobile artboard structures in step 2. Include interaction pattern changes (e.g., bottom sheet vs modal), navigation changes (e.g., sidebar vs dropdown), layout changes (e.g., grid columns), and content visibility changes (e.g., elements present on Desktop but absent on Mobile).
- **API Gaps**: Flag any mismatches between what the design collects and what the backend accepts.
- **Open Questions**: Add any unresolved decisions.

### 5. Write the spec file

Save to `frontend/spec/<view-name-kebab-case>.md`.

## Rules

- Use `TODO` markers liberally. A human will review those. It's better to mark something as TODO than to guess wrong.
- Do NOT invent API endpoints that don't exist in the backend. If unsure, write `TODO`.
- Do NOT guess navigation routes. Write `TODO: confirm destination route`.
- DO fill in everything that can be objectively determined from the artboards (element names, form fields, visual states).
- Keep the spec focused on **behavior**, not visual design. Paper is the source of truth for visuals.
- Follow the exact template structure — do not add or remove sections.
