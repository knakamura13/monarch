/** Read a string field from `initial` only if `name` is in `allowed` (prevents arbitrary key reads). */
export function fieldFromInitial<T extends string>(
    initial: Record<string, unknown>,
    allowed: readonly T[],
    name: string,
    fallback = ''
): string {
    if (!allowed.includes(name as T)) return fallback;
    const v = initial[name as keyof typeof initial];
    if (v == null) return fallback;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
    return String(v);
}
