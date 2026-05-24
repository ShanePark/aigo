# Frontend Design System

AiGo's frontend should feel friendly, practical, and dense enough for repeated family-outing planning. Prefer extending the shared CSS tokens and primitives before adding one-off visual rules.

## Tokens

Global design tokens live in `src/app/globals.css` under `:root`.

- Radius: use `--radius-panel` for cards, panels, fields, maps, and dialogs; `--radius-control` for pills and rounded controls; `--radius-inner` for nested media and segmented choices.
- Spacing: use `--space-1` through `--space-9` for gaps and padding before introducing new pixel values.
- Type: use `--text-micro`, `--text-xs`, `--text-sm`, `--text-base`, and `--text-lg`; use `--weight-label`, `--weight-strong`, and `--weight-title`.
- Controls: use `--control-sm`, `--control-md`, and `--control-lg` for stable button and field heights.
- Motion: use `--motion-fast` for hover/focus transitions and `--motion-standard` for slightly larger UI state changes.

## Primitives

`globals.css` defines shared primitive groups with `:where(...)` selectors:

- Button-like controls: search buttons, map actions, pagination, sort options, and detail actions share rounded control shape and transition behavior.
- Pills and chips: score pills, trust badges, category/distance pills, detail feature chips, and active filter chips share rounded chip foundations.
- Panels and cards: search forms, result cards, map cards, detail blocks, dialogs, galleries, and visit cards share the same panel radius.

When adding a new feature, first reuse an existing class pattern if the element is equivalent. If a new class is necessary, consume the tokens above and keep local CSS focused on layout or domain-specific color.

## Naming

Use user-facing score names consistently:

- `관련도` is contextual search relevance.
- `평가` is the source-backed place evaluation score.
- User visit star ratings should stay labeled separately as visit/user ratings.
