import { LayoutDashboard, List, Layers, HelpCircle, CheckSquare, Link } from 'lucide-svelte';

export interface NavItem {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    description?: string;
    ownerOnly?: boolean;
}

export const navigation: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/timeline', label: 'Timeline', icon: List, description: 'Case phases and milestones' },
    { href: '/tasks', label: 'Tasks', icon: CheckSquare, description: 'Personal todos and errands' },
    { href: '/questions', label: 'Questions', icon: HelpCircle, description: 'Research tracker' },
    { href: '/quick-links', label: 'Quick links', icon: Link }
];

// Pre-compute page numbers for O(1) lookup
const pageNumberCache = new Map<string, string>(navigation.map((item, index) => [item.href, String(index + 1).padStart(2, '0')]));

export const privacyCopy = {
    short: 'Private organizational dashboard — not a legal source of truth.',
    long: 'This app is a private organizational tool. Official government and county websites remain the authoritative source. This app does not provide legal advice. Avoid storing unnecessary sensitive identifiers here.'
};

export function getPageNumber(href: string): string {
    return pageNumberCache.get(href) ?? '';
}
