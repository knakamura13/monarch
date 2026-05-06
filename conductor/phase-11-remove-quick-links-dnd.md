# Drag-and-Drop Removal Plan - Quick Links

## Objective
Remove all drag-and-drop, reordering, and folder-interaction functionality from the Quick Links feature to resolve the broken implementation and simplify the component.

## Key Files to Change
- `src/lib/components/quick-links/QuickLinksGrid.svelte`
- `src/lib/components/quick-links/quickLinkDrag.ts`

## Proposed Solution
1. **Delete `src/lib/components/quick-links/quickLinkDrag.ts`**: This utility file is dedicated to drag-and-drop logic and will no longer be needed.
2. **Refactor `src/lib/components/quick-links/QuickLinksGrid.svelte`**:
   - Remove all drag-and-drop related state: `dragState`, `dragging`, `beginDrag`, `updateDrag`, `clearDrag`, `reorderLocal`, `orderedIds`, `otherItems`, etc.
   - Remove event listeners: `onpointerdown` handlers on folder and link items.
   - Remove the absolute-positioned overlay (`#if dragState`) that mimics the dragged item.
   - Clean up CSS classes or styles associated with dragging state.

## Verification & Testing
- Manually verify that quick links and folders are still displayed correctly.
- Verify that clicking or interacting with quick links/folders still triggers intended actions (e.g., opening a link or folder) without triggering unintended drag behavior.
- Ensure no compilation errors remain after removing the references to `quickLinkDrag.ts` and the deleted drag state.
