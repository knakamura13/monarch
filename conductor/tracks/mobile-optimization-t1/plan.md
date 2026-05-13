# Track: Mobile Optimization - Track 1: Critical & Access

## Objective
Address critical mobile usability and accessibility issues identified in the audit, focusing on orientation locks, touch target sizes, and input hints.

## Key Files & Context
- `static/manifest.webmanifest`: Orientation lock.
- `settings/manifest.webmanifest`: Orientation lock.
- `src/app.css`: Global button and touch target styles.
- `src/routes/(app)/settings/security/+page.svelte`: TOTP input mode.

## Implementation Steps

### 1. Remove Orientation Lock
- Update `static/manifest.webmanifest` and `settings/manifest.webmanifest`.
- Change or remove `"orientation": "portrait-primary"`.

### 2. Increase Touch Target Minimums
- Update `src/app.css`.
- Change `.btn.icon` width/height in `@media (pointer: coarse)` from `40px` to `44px`.

### 3. Restore TOTP `inputmode`
- Update `src/routes/(app)/settings/security/+page.svelte`.
- Add `inputmode="numeric"` to the TOTP verification input.

## Verification & Testing
- **Manual Verification:**
  - Rotate device to landscape on an installed PWA.
  - Use DevTools (Coarse Pointer) to verify button size is exactly 44x44px.
  - Verify numeric keypad appears on mobile for settings TOTP.
- **Automated Verification:**
  - Run `npx lighthouse <url> --only-categories=pwa` and verify orientation audit passes.
