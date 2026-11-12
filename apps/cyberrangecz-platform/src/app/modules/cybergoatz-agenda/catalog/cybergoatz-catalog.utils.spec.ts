import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { CatalogItem, CatalogSyncSummary } from './cybergoatz-catalog.model';
import {
    distinctCourses,
    isGithubHttpsUrl,
    shortCommit,
    sortCatalogItems,
    summaryCounts,
    toCatalogError,
    tracksCreated,
    truncate,
} from './cybergoatz-catalog.utils';

function item(partial: Partial<CatalogItem>): CatalogItem {
    return {
        id: 'x',
        sourceId: 's',
        catalogId: 'a',
        type: 'hands-on',
        course: 'c1',
        courseTitle: 'Course 1',
        courseOrder: 1,
        unit: 'u',
        unitOrder: 1,
        orderInCourse: 1,
        difficulty: 'easy',
        title: 't',
        definitionTitle: 't',
        description: '',
        path: null,
        contentHash: null,
        trainingDefinitionId: null,
        sandboxDefinitionId: null,
        state: 'synced',
        lastError: null,
        createdAt: '',
        updatedAt: '',
        ...partial,
    };
}

const http = (status: number, error?: unknown) =>
    new HttpErrorResponse({ status, error });

describe('toCatalogError', () => {
    it('maps 409 on refresh to the already-running message', () => {
        const view = toCatalogError(http(409, { message: 'x' }), 'refresh');
        expect(view.kind).toBe('conflict');
        expect(view.message).toContain('already running');
    });

    it('keeps the server message for a duplicate source (409 on save)', () => {
        const view = toCatalogError(
            http(409, { message: 'A catalog source already exists' }),
            'save',
        );
        expect(view.message).toBe('A catalog source already exists');
    });

    it('lists catalog errors on 422', () => {
        const view = toCatalogError(
            http(422, { message: 'bad', errors: ['e1', 'e2', 5] }),
            'refresh',
        );
        expect(view.kind).toBe('invalid-catalog');
        expect(view.details).toEqual(['e1', 'e2']);
    });

    it('shows the 502 and 400 messages, joining validation arrays', () => {
        expect(
            toCatalogError(http(502, { message: 'GitHub down' }), 'refresh')
                .message,
        ).toBe('GitHub down');
        expect(
            toCatalogError(http(400, { message: ['a', 'b'] }), 'save').message,
        ).toBe('a; b');
    });

    it('never leaks stack traces or HTML bodies', () => {
        const view = toCatalogError(
            http(500, '<html>Error\n at foo (bar.js:1)</html>'),
            'refresh',
        );
        expect(view.message).toBe('Refresh failed.');
        const multi = toCatalogError(
            http(500, { message: 'boom\n    at stack line' }),
            'refresh',
        );
        expect(multi.message).toBe('boom');
    });

    it('handles 403, network failure and non-HTTP errors', () => {
        expect(toCatalogError(http(403)).kind).toBe('forbidden');
        expect(toCatalogError(http(0)).message).toContain('Cannot reach');
        expect(toCatalogError(new Error('x')).message).toBe(
            'Unexpected error.',
        );
    });
});

describe('item helpers', () => {
    it('sorts by course order, then order in course, then id', () => {
        const sorted = sortCatalogItems([
            item({ catalogId: 'c', courseOrder: 2, orderInCourse: 1 }),
            item({ catalogId: 'b', courseOrder: 1, orderInCourse: 2 }),
            item({ catalogId: 'a', courseOrder: 1, orderInCourse: 1 }),
        ]);
        expect(sorted.map((i) => i.catalogId)).toEqual(['a', 'b', 'c']);
    });

    it('does not mutate the input when sorting', () => {
        const input = [
            item({ catalogId: 'b', orderInCourse: 2 }),
            item({ catalogId: 'a', orderInCourse: 1 }),
        ];
        sortCatalogItems(input);
        expect(input[0].catalogId).toBe('b');
    });

    it('derives distinct courses in course order', () => {
        const courses = distinctCourses([
            item({ course: 'b', courseTitle: 'B', courseOrder: 2 }),
            item({ course: 'a', courseTitle: 'A', courseOrder: 1 }),
            item({ course: 'b', courseTitle: 'B', courseOrder: 2 }),
        ]);
        expect(courses).toEqual([
            { id: 'a', title: 'A' },
            { id: 'b', title: 'B' },
        ]);
    });

    it('truncates and shortens', () => {
        expect(truncate(null)).toBe('');
        expect(truncate('abc', 5)).toBe('abc');
        expect(truncate('abcdefgh', 5)).toBe('abcde...');
        expect(shortCommit('0123456789abcdef')).toBe('0123456');
        expect(shortCommit(null)).toBe('-');
    });
});

describe('summary helpers', () => {
    const summary: CatalogSyncSummary = {
        commit: 'abc',
        startedAt: '',
        finishedAt: '',
        created: 1,
        updated: 2,
        skipped: 3,
        metadataUpdated: 4,
        failed: 5,
        notBuilt: 6,
        removed: 7,
        items: [],
        tracks: [
            { slug: 'a', outcome: 'created' },
            { slug: 'b', outcome: 'exists' },
        ],
    };

    it('lists all seven counts', () => {
        expect(summaryCounts(summary).map((c) => c.value)).toEqual([
            1, 2, 3, 4, 5, 6, 7,
        ]);
    });

    it('returns only created tracks', () => {
        expect(tracksCreated(summary).map((t) => t.slug)).toEqual(['a']);
    });
});

describe('isGithubHttpsUrl', () => {
    it('accepts github https repo urls', () => {
        expect(isGithubHttpsUrl('https://github.com/o/r')).toBe(true);
        expect(isGithubHttpsUrl(' https://github.com/o/r.git ')).toBe(true);
        expect(isGithubHttpsUrl('https://github.com/o/r/')).toBe(true);
    });

    it('rejects other forms', () => {
        for (const value of [
            'http://github.com/o/r',
            'https://gitlab.com/o/r',
            'https://github.com/o',
            'https://github.com/o/r/tree/main',
            'https://user@github.com/o/r',
            'git@github.com:o/r.git',
        ]) {
            expect(isGithubHttpsUrl(value), value).toBe(false);
        }
    });
});
