import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),
    kit: {
        adapter: adapter(),
        alias: {
            $lib: 'src/lib',
            '$lib/*': 'src/lib/*'
        },
        version: {
            // Poll for new versions every 5 minutes
            pollInterval: 300000
        }
    }
    // runes mode is auto-detected per component (we write all our own components in runes;
    // third-party packages like lucide-svelte may still use the legacy API).
};

export default config;
