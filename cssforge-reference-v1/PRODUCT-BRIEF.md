# CSSForge — Product Brief

## Product idea

CSSForge is a local-first visual CSS inspection and editing extension for Chrome/Chromium.

The product should feel like a professional on-page editing environment rather than a dashboard or DevTools clone.

## Primary UX model

The page remains the main workspace.

The UI is composed of:

1. **selected-element inspector**
2. **contextual on-canvas controls**
3. **persistent bottom global dock**
4. **dedicated surfaces** such as Navigator and Changes

The inspector does not own every feature.

## Main task surfaces

Use the CSS Pro task model as the visible foundation:

- **Design**
- **Code**
- **HTML**

Do not implement fake AI/Chat. Add it only in the future if CSSForge gains a real capability.

## Build philosophy

Phase 1 may use fixture/mock data to make the UI visually correct before a real inspection engine exists.

Mock state must stay isolated to development fixtures and must not leak into production behavior once real data is connected.

## Initial browser target

Chrome/Chromium, Manifest V3.

## Product constraints

- local-first
- no remote executable code
- minimal permissions
- Shadow DOM isolation for on-page UI
- reversible edits once real editing is connected
- accessibility is required
- no unnecessary framework churn
