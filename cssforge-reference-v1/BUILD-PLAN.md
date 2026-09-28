# CSSForge — Build Plan

The project is intentionally split so each agent run stays small.

## Phase 01 — Visual Foundation
Build the extension shell with fixture data:
- WXT/React/TypeScript foundation
- Shadow Root
- inspector
- Design/Code/HTML tabs
- Design section shells
- bottom dock
- shared popover shell
- Changes/Navigator visual surfaces

No CSS analysis engine yet.

## Phase 02 — Interaction Foundation
Make the UI itself work:
- tabs
- accordions
- popovers
- drag/clamp
- dock active states
- keyboard/focus
- viewport behavior

Still mostly fixture-driven.

## Phase 03 — Real Picker
Connect:
- hover target
- selection
- outline
- element identity
- dimensions
- font summary
- parent navigation

## Phase 04 — Core Design Editing
Connect reversible editing for:
- geometry
- spacing
- typography
- color
- background-color
- display
- border
- position
- opacity

## Phase 05 — Rich Design
Connect:
- Media/Pseudo context
- background layers/gradients
- shadows
- filters
- contextual canvas controls where safe

## Phase 06 — Code + HTML
Connect:
- authored CSS source model
- CodeMirror line editor
- validation/value tools
- HTML navigator
- source/context groups

## Phase 07 — Changes + Global Tools
Connect:
- undo/rollback
- grouped diffs
- copy/export
- dock tools
- responsive/measure/color tools where real

## Phase 08 — Correctness/Hardening
Only after the product looks right:
- stylesheet indexing
- specificity
- conservative cascade
- Shadow DOM/root correctness
- inaccessible-source handling
- performance hardening

Each phase has its own file under `phases/`.
