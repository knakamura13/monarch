# Track: Mobile Optimization - Track 2: PWA Reliability

## Objective
Enhance the Progressive Web App (PWA) experience by providing update notifications, custom install prompts, and valid iOS startup assets.

## Key Files & Context
- `vite.config.ts`: PWA plugin configuration.
- `src/routes/+layout.svelte`: Root layout for global UI components.
- `src/lib/components/pwa/ReloadPrompt.svelte`: (New) SW update notification.
- `src/lib/components/pwa/InstallPrompt.svelte`: (New) Custom install trigger.
- `src/app.html`: iOS splash screen meta tags.

## Implementation Steps

### 1. Implement Service Worker Update UI ([F-15])
- Create `src/lib/components/pwa/ReloadPrompt.svelte`.
- Use `virtual:pwa-register/svelte` to detect updates.
- Show a toast-like prompt when a new version is available.
- Integrate into `src/routes/+layout.svelte`.

### 2. Capture `beforeinstallprompt` for Custom Install UI ([F-24])
- Implement global state (or store) to capture the `beforeinstallprompt` event.
- Create `src/lib/components/pwa/InstallPrompt.svelte`.
- Show an "Install App" button in the Sidebar or as a dismissible banner after meaningful engagement.

### 3. Resolve iOS Splash Screen Placeholders ([F-3])
- Update `src/app.html`.
- For now, remove the placeholder `apple-touch-startup-image` links that point to the small icon, as they cause distorted splash screens.
- Add a comment for the user to generate these assets using `pwa-asset-generator`.

## Verification & Testing
- **Manual Verification:**
  - Trigger a SW update (by changing a file and rebuilding) and verify the reload prompt appears.
  - Verify "Install App" appears in supported browsers after the `beforeinstallprompt` event fires.
  - Verify iOS startup behavior (no more distorted icon splash).
- **Automated Verification:**
  - Lighthouse PWA "Installable" audit.
