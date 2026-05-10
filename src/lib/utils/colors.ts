/**
 * Generates a consistent accent color based on a seed string.
 * Returns one of the project's CSS variable names for accent colors.
 */
export function getAccentColor(seed: string): { bg: string; text: string; fill: string } {
    const colors = [
        { bg: 'var(--sage)', text: 'var(--sage-d)', fill: 'var(--sage-fill)' },
        { bg: 'var(--butter)', text: 'var(--butter-d)', fill: 'var(--butter-fill)' },
        { bg: 'var(--blush)', text: 'var(--blush-d)', fill: 'var(--blush-fill)' },
        { bg: 'var(--peri)', text: 'var(--peri-d)', fill: 'var(--peri-d)' }, // peri-fill not defined, use -d
        { bg: 'var(--lilac)', text: 'var(--lilac-d)', fill: 'var(--lilac-d)' } // lilac-fill not defined, use -d
    ];

    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    const color = colors.at(index);
    if (!color) return colors[0]!;
    return color;
}
