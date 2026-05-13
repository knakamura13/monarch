import { writable } from 'svelte/store';

// Store for the BeforeInstallPromptEvent
// We use Svelte 4 store because it's easier to interop with global events in this context
// but we'll consume it in Svelte 5 components.
export const installPromptEvent = writable<any>(null);
export const canInstall = writable(false);

export function setInstallPrompt(event: any) {
    installPromptEvent.set(event);
    canInstall.set(true);
}

export async function promptInstall() {
    let event: any;
    installPromptEvent.subscribe((v) => (event = v))();

    if (!event) return false;

    event.prompt();
    const { outcome } = await event.userChoice;
    
    if (outcome === 'accepted') {
        installPromptEvent.set(null);
        canInstall.set(false);
        return true;
    }
    
    return false;
}
