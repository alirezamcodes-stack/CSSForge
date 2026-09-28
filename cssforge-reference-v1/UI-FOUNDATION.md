# CSSForge — UI Foundation

This is the most important design document.

## 1. Overall composition

CSSForge must be **canvas-first**.

A normal selected-element state consists of:

`page + selected element + floating inspector + bottom dock`

Complex interactions may add:
- anchored popovers,
- on-canvas handles/actions,
- dedicated Navigator,
- dedicated Changes review.

## 2. Inspector

The inspector is a narrow dark floating panel.

Header order:
1. selected element identity
2. compact action icons on the right
3. dimensions
4. rendered font summary

Below the header:
- Design
- Code
- HTML

Tabs use a compact underline treatment rather than large pills.

One main internal scroll area.

## 3. Design

Top context:
- Media
- State or pseudo
- compact geometry row

Then progressive sections:
- Spacing
- Typography
- Background
- Display
- Border
- Positioning
- Box shadow
- Text shadow
- Filters

Do not render a generic wall of property inputs.

### Spacing
Spatial box-model presentation.

### Typography
Grouped compact controls.

### Background
Rich/layered workflow. Complex spatial editing can use popovers and canvas handles.

### Effects
Use visual cards and sliders where the reference does.

## 4. Code

Line-oriented compact CSS editor:
- one declaration per line,
- enable/disable affordance,
- syntax hierarchy,
- inline editing,
- contextual media/pseudo blocks,
- inline validation,
- inline value editors where useful.

Do not use a giant textarea as the final view.

## 5. HTML / Navigator

DOM navigation belongs in HTML/Navigator workflows, not a permanent debug tab.

Parent/child navigation should be fast and contextual.

## 6. Bottom dock

The bottom dock is foundational, not optional polish.

Pattern:
- detached circular controls on the left,
- dark central capsule with icon tools,
- detached circular controls on the right.

It is global tooling, separate from the selected property editor.

## 7. Changes

Changes is a dedicated review surface, not merely a tiny inspector tab.

It should later show grouped diffs and real undo/reset/copy/export actions.

## 8. Popovers

All menus/pickers share one placement system:
- anchored
- viewport aware
- flip/clamp
- Escape closes
- focus restores
- keyboard accessible

## 9. Visual character

Target:
- compact
- dark
- professional
- quiet
- precise
- dense without clutter
- very little marketing copy
- very few large cards

Use CSSForge branding and original icons.
