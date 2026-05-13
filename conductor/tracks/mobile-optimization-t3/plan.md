# Track: Mobile Optimization - Track 3: Refinement & Performance

## Objective
Finalize mobile optimizations by implementing automated image handling and enhancing interactive feedback for touch users.

## Key Files & Context
- `package.json`: Dependency for `@sveltejs/enhanced-img`.
- `svelte.config.js`: Configuration for enhanced images.
- `src/lib/components/layout/AuthShell.svelte`: Logo image.
- `src/routes/(app)/dashboard/+page.svelte`: Task item active states.
- `src/app.css`: Global active state styles.

## Implementation Steps

### 1. Adopt `@sveltejs/enhanced-img` ([A-4])
- Install `@sveltejs/enhanced-img`.
- Update `svelte.config.js` to include the plugin.
- Replace `<img>` with `<enhanced:img>` for key branding assets like the logo.

### 2. Add `:active` Tap Feedback ([D-7])
- Update `src/app.css` or specific component styles.
- Add `:active` states for `.task-item` and other primary interactive list elements.
- Example: `transform: scale(0.98)` or a background color shift.

### 3. Preload Primary Display Font ([A-5])
- Update `src/app.html`.
- Add `<link rel="preload" as="font" ...>` for `Playfair Display` to improve LCP and reduce layout shift.

## Verification & Testing
- **Manual Verification:**
  - Tap dashboard items and verify immediate visual feedback.
  - Verify logo is served in WebP/AVIF format in Network tab.
- **Automated Verification:**
  - Lighthouse performance audit (LCP and CLS improvements).
