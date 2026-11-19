import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { CatalogItem, CatalogSyncSummary } from './cybergoatz-catalog.model';
import {
    CatalogViewFilters,
    distinctCourses,
    filterCatalogItems,
    isListed,
    levelLabel,
    libraryName,
    sourceStatusLabel,
    statusLabel,
    summarySentence,
    typeLabel,
    certificationNames,
    usedCertifications,
    hasOlderVersions,
    previousVersionsText,
    isGithubHttpsUrl,
    shortCommit,
    sortCatalogItems,
    summaryCounts,
    toCatalogError,
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
        poolId: null,
        trainingInstanceId: null,
        previousVersions: null,
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

describe('previous versions', () => {
    const version = {
        trainingDefinitionId: '10',
        poolId: '20',
        trainingInstanceId: '30',
        keptReason: 'instance has training runs',
    };

    it('detects older versions only when the list is non-empty', () => {
        expect(hasOlderVersions(item({}))).toBe(false);
        expect(hasOlderVersions(item({ previousVersions: [] }))).toBe(false);
        expect(hasOlderVersions(item({ previousVersions: [version] }))).toBe(
            true,
        );
    });

    it('describes reason and old ids, one line per version', () => {
        const text = previousVersionsText(
            item({
                previousVersions: [
                    version,
                    { ...version, poolId: null, keptReason: null },
                ],
            }),
        );
        const lines = text.split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe(
            'Reason: instance has training runs, definition 10, pool 20, instance 30',
        );
        expect(lines[1]).toContain('cleanup not attempted yet');
        expect(lines[1]).toContain('pool -');
        expect(previousVersionsText(item({}))).toBe('');
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
        resumed: 8,
        supersededKept: 9,
        failed: 5,
        notBuilt: 6,
        removed: 7,
        items: [],
    };

    it('lists all counts including resumed and superseded kept', () => {
        expect(summaryCounts(summary).map((c) => c.value)).toEqual([
            1, 2, 3, 4, 8, 9, 5, 6, 7,
        ]);
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

describe('plain-language view helpers', () => {
    const ready = item({
        catalogId: 'a',
        title: 'Phishing triage',
        state: 'synced',
        type: 'hands-on',
        course: 'c1',
        certifications: ['sec'],
    });
    const broken = item({
        catalogId: 'b',
        title: 'DNS quiz',
        state: 'failed',
        type: 'mcq',
        course: 'c2',
    });
    const notBuilt = item({
        catalogId: 'c',
        title: 'Future lab',
        state: 'not_built',
    });
    const removed = item({
        catalogId: 'd',
        title: 'Old lab',
        state: 'removed_from_catalog',
    });
    const all = [ready, broken, notBuilt, removed];
    const none: CatalogViewFilters = {
        search: '',
        course: '',
        type: '',
        status: '',
        certification: '',
    };

    it('never lists entries without a folder, and lists removed ones only in technical mode', () => {
        expect(isListed(notBuilt, false)).toBe(false);
        expect(isListed(notBuilt, true)).toBe(false);
        expect(isListed(removed, false)).toBe(false);
        expect(isListed(removed, true)).toBe(true);
        expect(
            filterCatalogItems(all, none, false).map((i) => i.catalogId),
        ).toEqual(['a', 'b']);
    });

    it('filters by search text, course, type and status', () => {
        const ids = (f: Partial<CatalogViewFilters>) =>
            filterCatalogItems(all, { ...none, ...f }, false).map(
                (i) => i.catalogId,
            );
        expect(ids({ search: 'phish' })).toEqual(['a']);
        expect(ids({ course: 'c2' })).toEqual(['b']);
        expect(ids({ type: 'mcq' })).toEqual(['b']);
        expect(ids({ status: 'ready' })).toEqual(['a']);
        expect(ids({ status: 'attention' })).toEqual(['b']);
        expect(ids({ certification: 'sec' })).toEqual(['a']);
    });

    it('uses plain labels', () => {
        expect(statusLabel('synced')).toBe('Ready');
        expect(statusLabel('failed')).toBe('Needs attention');
        expect(typeLabel('mcq')).toBe('Quiz');
        expect(typeLabel('hands-on')).toBe('Hands-on lab');
        expect(levelLabel('beginner')).toBe('Beginner');
        expect(
            libraryName('https://github.com/CyberGoatz/training-catalog.git'),
        ).toBe('CyberGoatz/training-catalog');
        expect(sourceStatusLabel('partial').tone).toBe('warn');
        expect(sourceStatusLabel('success').text).toBe('Up to date');
    });

    it('describes an update in one sentence', () => {
        const base: CatalogSyncSummary = {
            commit: 'abc',
            startedAt: '',
            finishedAt: '',
            created: 0,
            updated: 0,
            skipped: 5,
            metadataUpdated: 0,
            resumed: 0,
            supersededKept: 0,
            failed: 0,
            notBuilt: 40,
            removed: 0,
            items: [],
        };
        expect(summarySentence(base)).toBe(
            'No changes. Everything was already up to date.',
        );
        expect(summarySentence({ ...base, created: 38, failed: 1 })).toBe(
            '38 new trainings added, 1 training could not be set up.',
        );
        expect(summarySentence({ ...base, error: 'boom' })).toBe(
            'The update could not finish. Nothing was changed.',
        );
    });
});

describe('certification helpers', () => {
    it('lists only certifications used by listed items, sorted by name', () => {
        const certs = [
            { id: 'z', name: 'Zeta' },
            { id: 'a', name: 'Alpha' },
            { id: 'u', name: 'Unused' },
        ];
        const items = [
            item({ certifications: ['z', 'a'] }),
            item({ certifications: null }),
        ];
        expect(usedCertifications(certs, items).map((c) => c.name)).toEqual([
            'Alpha',
            'Zeta',
        ]);
    });

    it('maps ids to names and falls back to the id', () => {
        const byId = new Map([['a', { id: 'a', name: 'Alpha' }]]);
        expect(
            certificationNames(item({ certifications: ['a', 'x'] }), byId),
        ).toEqual(['Alpha', 'x']);
    });
});
