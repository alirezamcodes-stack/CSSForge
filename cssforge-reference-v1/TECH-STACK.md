# CSSForge — Technical Stack

Use this stack unless a concrete blocker is found.

## Extension

- **WXT**
- **Manifest V3**
- **TypeScript**
- **React**

WXT handles extension entrypoints/building; React handles the interaction-heavy UI.

## UI architecture

- Shadow Root mounted from the content script
- React components inside the isolated root
- CSS custom properties + CSS Modules for precise geometry
- mostly pixel-based extension UI dimensions for stable screenshot fidelity
- `@floating-ui/dom` or React equivalent for menus/popovers
- Zustand for compact cross-surface UI state
- CodeMirror 6 later for the real Code editor

## Testing

- Vitest for units
- Playwright for browser/integration and screenshot fixtures

## Avoid

- Tailwind as the primary styling system for this fidelity work
- large design-system libraries that impose their own geometry
- Material UI / Ant / Bootstrap
- iframe-based main inspector
- putting business/cascade logic inside React components

## Suggested source boundaries

```text
entrypoints/
  background.ts
  content.tsx
  popup/

src/
  ui/
    inspector/
    design/
    code/
    html/
    dock/
    changes/
    navigator/
    popovers/
    canvas/
  state/
  engine/
  editing/
  shared/
  styles/
```

Keep visual components independent from the later CSS analysis engine.
