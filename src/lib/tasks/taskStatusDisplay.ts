export function taskStatusPillClass(status: string): string {
    switch (status) {
        case 'To do':
            return 's-note';
        case 'Doing':
            return 's-active';
        case 'On hold':
            return 's-waiting';
        case 'Done':
            return 's-done';
        default:
            return '';
    }
}

export function taskStatusLabel(status: string): string {
    switch (status) {
        case 'To do':
        case 'Doing':
        case 'On hold':
        case 'Done':
            return status;
        default:
            return status;
    }
}
