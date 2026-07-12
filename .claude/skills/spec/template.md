# View: {{View Name}}

**Route**: `{{/route}}`
**View folder**: `src/views/{{folder}}/`

## Artboards

Each row is a visual state of this view, with its Paper artboard IDs.

| State          | Desktop  | Tablet   | Mobile   |
| -------------- | -------- | -------- | -------- |
| {{State name}} | `{{ID}}` | `{{ID}}` | `{{ID}}` |

## State Machine

How artboard states connect via user actions. Each arrow is a transition the code must handle.

```
{{State A}} ──── {{user action}} ──► {{State B}}
```

## Interactions

Per-element "what happens when I click/type/select X", grouped by paper UI elements.

### {{Section Name}}

| Element          | Action                       | Behavior                                                    |
| ---------------- | ---------------------------- | ----------------------------------------------------------- |
| {{Element name}} | {{click/type/select/scroll}} | {{What happens — navigation, API call, state change, etc.}} |

## API Calls

Maps user actions to backend endpoints, including what to do on success and failure.

| Trigger         | Endpoint           | Body              | On Success                                | On Error                           |
| --------------- | ------------------ | ----------------- | ----------------------------------------- | ---------------------------------- |
| {{User action}} | `{{METHOD /path}}` | `{{ { field } }}` | {{State transition, toast, store update}} | {{Error toast, fallback behavior}} |

## Data Requirements

What data this view needs to render, where it comes from, and when to fetch it.

| Data          | Source                    | When                                          |
| ------------- | ------------------------- | --------------------------------------------- |
| {{Data name}} | {{API endpoint or store}} | {{On page load, on interaction, conditional}} |

## Form Validation

Frontend validation rules per field — checked before any API call is made.

### {{Form Name}}

| Field          | Rules                                                |
| -------------- | ---------------------------------------------------- |
| {{Field name}} | {{Required/optional. Format. Min/max. Constraints.}} |

## Components

Distinct visual components identified in the artboards. Each entry names the component, lists which artboards it appears in, and notes any structural differences across breakpoints. This inventory feeds `/plan` for component manifest generation.

| Component         | Artboards                       | Breakpoint Differences                                           |
| ----------------- | ------------------------------- | ---------------------------------------------------------------- |
| {{ComponentName}} | {{Artboard 1, Artboard 2, ...}} | {{e.g., "sidebar on Desktop, bottom sheet on Mobile" or "none"}} |

## Responsive Behavior

Structural and behavioral differences across breakpoints.

| Behavior    | Mobile              | Tablet              | Desktop              |
| ----------- | ------------------- | ------------------- | -------------------- |
| {{Feature}} | {{Mobile behavior}} | {{Tablet behavior}} | {{Desktop behavior}} |

## API Gaps

Mismatches between what the design requires and what the backend currently provides.

> {{Description of the gap. Include options for resolution.}}

## Open Questions

Decisions that must be resolved before implementation can begin.

- [ ] {{Decision that needs to be made before implementation}}
