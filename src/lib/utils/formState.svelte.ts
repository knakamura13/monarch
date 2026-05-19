export function createFormState() {
    let submitting = $state(false);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function stop() {
        submitting = false;
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    }

    function start() {
        if (submitting) return;
        submitting = true;

        // Safety timeout: 10 seconds
        timeoutId = setTimeout(() => {
            if (submitting) {
                console.warn('Form submission timed out after 10s');
                stop();
            }
        }, 10000);
    }

    return {
        get submitting() {
            return submitting;
        },
        start,
        stop
    };
}
