import { describe, it, expect } from 'vitest';
import { fmtDate, fmtDateTime, daysUntil, isOverdue } from '$lib/utils/dates';
import { titleCase, initials, pluralize, truncate } from '$lib/utils/format';
import { addDays, subDays } from 'date-fns';

describe('date utils', () => {
    it('formats nullish as em dash', () => {
        expect(fmtDate(null)).toBe('—');
        expect(fmtDateTime(null)).toBe('—');
    });

    it('rejects invalid dates', () => {
        expect(fmtDate('not a date')).toBe('—');
    });

    it('daysUntil returns calendar-day diff', () => {
        expect(daysUntil(addDays(new Date(), 3))).toBe(3);
        expect(daysUntil(subDays(new Date(), 2))).toBe(-2);
    });

    it('isOverdue is true for past dates', () => {
        expect(isOverdue(subDays(new Date(), 1))).toBe(true);
        expect(isOverdue(addDays(new Date(), 1))).toBe(false);
    });
});

describe('format utils', () => {
    it('titleCase converts SNAKE_CASE', () => {
        expect(titleCase('SOME_SNAKE_CASE')).toBe('Some Snake Case');
    });

    it('initials picks first two name parts', () => {
        expect(initials('Avery Demo', 'a@b.com')).toBe('AD');
        expect(initials(null, 'foo@bar.com')).toBe('FO');
        expect(initials('Singleword')).toBe('SI');
    });

    it('pluralize handles singular and plural', () => {
        expect(pluralize(1, 'apple')).toBe('1 apple');
        expect(pluralize(3, 'apple')).toBe('3 apples');
        expect(pluralize(2, 'box', 'boxes')).toBe('2 boxes');
    });

    it('truncate adds ellipsis', () => {
        expect(truncate('abcdef', 4)).toBe('abc…');
        expect(truncate('abc', 10)).toBe('abc');
    });
});
