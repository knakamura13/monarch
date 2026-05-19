/**
 * Shared utilities for custom Pointer Event-based drag and drop.
 */

export const POINTER_MOVE_THRESHOLD_PX = 8;
export const CLICK_PROTECTION_TIMEOUT_MS = 50;

/**
 * Calculates if the movement distance exceeds the drag threshold.
 */
export function isDragThresholdMet(startX: number, startY: number, currentX: number, currentY: number): boolean {
    const dx = currentX - startX;
    const dy = currentY - startY;
    return Math.sqrt(dx * dx + dy * dy) > POINTER_MOVE_THRESHOLD_PX;
}

/**
 * Common drag state properties.
 */
export interface BaseDragState {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
}

/**
 * Throttles a function using requestAnimationFrame.
 */
export function createRafThrottle<T extends (...args: unknown[]) => void>(fn: T): {
    handler: (...args: Parameters<T>) => void;
    cancel: () => void;
} {
    let rafId: number | null = null;

    const handler = (...args: Parameters<T>) => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
            rafId = null;
            fn(...args);
        });
    };

    const cancel = () => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    return { handler, cancel };
}

/**
 * Prevents default and propagation for drag-related events.
 */
export function preventDragPropagation(event: Event) {
    event.preventDefault();
    event.stopPropagation();
}

/**
 * Common CSS for drag ghosts.
 */
export const DRAG_GHOST_STYLES = {
    position: 'fixed' as const,
    pointerEvents: 'none' as const,
    zIndex: 99999,
    opacity: 0.9,
    boxShadow: '0 12px 24px rgba(0,0,0,0.2)'
};
