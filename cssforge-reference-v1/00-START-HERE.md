# CSSForge — START HERE

**Project:** CSSForge  
**Goal:** build a new Chrome extension from zero whose **visible UI/UX and interaction model closely follow the supplied CSS Pro evidence**, while using independent code, branding, icons and wording.

This package is intentionally compact. Do **not** read every image or every video frame on every run.

## Core rule

Build **UI foundation first**, then connect real functionality phase by phase.

The order is:

`visual shell → interaction shell → picker → real Design editing → Code/HTML → Changes/tools → deeper correctness`

Do not start by building a large CSS-analysis engine.

## What the agent reads on each run

Always read only:

1. `PRODUCT-BRIEF.md`
2. `UI-FOUNDATION.md`
3. the current file under `phases/`

Then open **only the reference images named by that phase**.

If an interaction is unclear, open the matching contact sheet.  
Open selected keyframes only if the contact sheet is insufficient.

Do **not** scan the whole reference folder.

## CSS Pro authority

CSS Pro is the visual and interaction reference for:
- inspector shell,
- selected-element header,
- Design / Code / HTML task model,
- Media and pseudo/state controls,
- property-editor hierarchy,
- bottom floating dock,
- contextual canvas controls,
- navigator,
- changes/review surface,
- compact dark density,
- menus/popovers.

Independent implementation is required. Do not copy proprietary source code, logos, brand assets, exact product wording, or proprietary icon artwork.

## Default first phase

Start with:

`phases/01-visual-foundation.md`

Do not start Phase 2 until Phase 1 has screenshot evidence and is visually close to its references.
