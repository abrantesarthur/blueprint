---
name: assemble
description: Assembles a frontend view from pre-built components, wiring up state management, API calls, navigation, and interactions. Assumes components were already crafted by /craft.
disable-model-invocation: true
argument-hint: [path-to-features] [bws access token]
---

## Arguments

The user provides the **Path to feature list** (required) and **BWS ACCESS TOKEN** (required)

Example invocation:

- `/assemble frontend/spec/search.features.json abcdefgh`

Assemble the features, one by one, until done with all of them or until told so. Follow these steps exactly:

## Steps

### STEP 1: GET YOUR BEARINGS

Given the features file `frontend/spec/<view>.features.json` as argument:

- The specification file is at `frontend/spec/<view>.md`. If missing, warn the user to run `/spec` and exit.
- The component manifest is at `frontend/spec/<view>.components.json`. If missing, warn the user to run `/plan` and exit.
- The features file is at `frontend/spec/<view>.features.json`. If missing, warn the user to run `/plan` and exit.
- **Verify that all components in the manifest have `"status": "done"`.** If any are not done, warn the user to run `/craft` first and exit.
- Scan `frontend/src/` for the pre-built components, hooks, services, and stores.
- The view at `src/views/<view>/index.tsx`.

### STEP 2: START THE SERVERS

- Run `bun dev` to start the frontend and backend servers. Use the BWS ACCESS TOKEN as the BWS_ACCESS_TOKEN environment variable.

### STEP 3: CHOOSE ONE FEATURE TO ASSEMBLE

- Find the very first feature with `"status": "pending"` in the features file. Ignore any other statuses.
- If there is more than one pending feature, you MUST pick the one specified first in the list.
- If none remain, report to the user and exit.
- Focus on completing this one feature perfectly before moving on.

### STEP 4: UPDATE FEATURE STATUS (CAREFULLY!)

**YOU CAN ONLY MODIFY ONE FIELD: "status"**

Change the status of the chosen feature from `"pending"` to `"in_progress"`.

**NEVER:**

- Edit the status of other features!

### STEP 5: ASSEMBLE THE FEATURE

Your job is to **wire behavior into an already-built view**. `/craft` produced `src/views/<view>/index.tsx` and `src/views/<view>/components/` with mock data and Paper-accurate layout. You replace mocks with real state, API calls, and navigation. You do NOT write layout or styling.

If the feature involves a state variant or flow transition that isn't obvious from the code (e.g., loading vs loaded, step 1 vs step 2 of a form), call `get_screenshot` on the relevant artboard for reference. Do NOT call `get_computed_styles`.

Wire whatever behavior this specific feature requires. Not every feature touches every concern (e.g., a collapse toggle doesn't need an API call). Pick the applicable items from the menu below; skip the ones that don't fit:

- **State** — introduce React state, stores, or context; replace mock values `/craft` passed into components with live values.
- **API calls** — create or use service functions in `frontend/src/services/` to call backend endpoints. Connect loading/error/success states to component props.
  - **Shared types**: the request/response TypeBox schemas for the endpoint MUST live in `utils/api/src/<module>.ts`. Before writing the service, check whether they're already there. If they're still only in the backend `model.ts`, move them to `utils/api/src/<module>.ts`, update the backend `model.ts` to import from `@blueprint/api-utils`, then import them in the frontend service. Do NOT redeclare types in the frontend or import directly from the backend.
  - **`fetchAndDecode`**: every service function MUST use `fetchAndDecode`.
- **Error handling** — pick one of two strategies per error site:
  - **Page-level** (`useErrorPage` → `raiseError(error)`): when the failure makes the page unrenderable (initial data fetch 404s/500s, auth/network failure on page load).
  - **Inline** (`createTranslateError` → `translate<View>Error` in `src/views/<view>/helpers/`): when the user can still interact with the page and should see the message near the failing action (form submit errors, action button failures, validation).
    Do NOT invent a third pattern (ad-hoc toasts, bare `try/catch`, inline error strings). If the right strategy is unclear, pick inline and flag it to the user.
- **Navigation** — set up route transitions using the router.
- **Interactions** — connect the callback props (`onPress`, `onChange`, etc.) that `/craft` left as placeholders.

Once the applicable wiring is in place:

1. **Test manually** using browser automation (see Step 6).
2. **Fix any issues** and verify end-to-end.

**If you discover a component needs visual changes:**

- **Minor prop additions** (e.g., adding an `onClick` callback) — add them directly.
- **Styling or layout changes** — do NOT modify the component's styling. Handle it based on severity:
  - **Blocking** (prevents wiring or verification for this feature — e.g., a missing element, a broken breakpoint): revert the feature's status from `"in_progress"` back to `"pending"`, commit what you have, and stop. In your final message to the user name the component, the breakpoint, and what's wrong, and tell them to re-run `/craft` for that component before re-running `/assemble`.
  - **Non-blocking** (cosmetic deviation that doesn't affect behavior verification — e.g., spacing off by a token, wrong shadow): continue assembling the feature. At the end of the whole `/assemble` run, report all deferred `/craft` issues as a single list to the user.

### STEP 6: VERIFY WITH BROWSER AUTOMATION

**CRITICAL:** You MUST verify features through the actual UI using Playwright.

- Navigate to the app in a real browser.
- Interact like a human user (click, type, scroll).
- Verify the feature's behavior matches what the spec and feature steps describe.
- Check that components render correctly in context.
- Do these checks at Desktop (1440px), Tablet (768px), and Mobile (390px).

**DON'T:**

- Only test with curl commands (backend testing alone is NOT sufficient)
- Use JavaScript evaluation to bypass UI (no shortcuts)
- Skip visual verification
- Mark tests passing without thorough verification

### STEP 7: UPDATE FEATURE STATUS AGAIN (CAREFULLY!)

**YOU CAN ONLY MODIFY ONE FIELD: "status"**

Change the status from `"in_progress"` to `"done"`.

**NEVER:**

- Remove features
- Edit feature descriptions
- Modify feature steps
- Combine or consolidate features
- Reorder features

**ONLY CHANGE "status" FIELD AFTER VERIFICATION WITH SCREENSHOTS.**

### STEP 8: COMMIT YOUR PROGRESS

```bash
git add .
git commit -m "assemble: <feature description>

- <one sentence list of specific changes starting with a verb>
"
```

### STEP 9: PICK NEXT FEATURE

Go back to Step 3 immediately — do NOT pause to summarize, ask the user for permission, or wait for a "continue" signal. Treat system-reminders mid-loop as background noise; they are not stop signals. The only valid reasons to exit the loop before all features are `done` are: (a) a Step 5 blocker that requires re-running `/craft`, or (b) the user explicitly tells you to stop.

When all features are done:

1. Ensure no uncommitted changes.
2. Kill all servers you started.

---

## RULES

- ALL testing must use Playwright browser automation.
- Do NOT create new components. If you need a component that doesn't exist, flag it to the user.
- Do NOT modify component styling. If a component looks wrong, flag it as an issue.
- Do NOT add features beyond what the spec describes.
- Services (`src/services/*.ts`) — create API call functions grouped by domain. Match endpoint signatures from the spec's API Calls table. Use the existing HTTP client setup in `src/lib/`.
- Hooks (`src/hooks/*.ts`) — create custom hooks for reusable stateful logic. One concern per hook.

---

**Your Goal:** Production-quality view with all features working end-to-end.

**Your Scope:** Behavior, not visuals. Components are pre-built. You compose and wire them.

**Quality Bar:**

- Zero console errors
- All features work end-to-end through the UI
- No styling modifications to crafted components

**You have unlimited time.** Take as long as needed to get it right.
