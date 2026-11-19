import { HttpErrorResponse } from '@angular/common/http';
import {
    CatalogCertification,
    CatalogItem,
    CatalogSyncStatus,
    CatalogSyncSummary,
} from './cybergoatz-catalog.model';

export interface CatalogErrorView {
    kind: 'conflict' | 'invalid-catalog' | 'forbidden' | 'generic';
    message: string;
    /** Catalog validation errors (422 only). */
    details: string[];
}

const MAX_MESSAGE_LENGTH = 300;

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : null;
}

function serverMessage(body: unknown): string | null {
    const record = asRecord(body);
    const message = record?.['message'];
    if (typeof message === 'string') {
        return message;
    }
    if (Array.isArray(message)) {
        const parts = message.filter(
            (part): part is string => typeof part === 'string',
        );
        return parts.length > 0 ? parts.join('; ') : null;
    }
    return typeof body === 'string' && body.trim() && !body.includes('<')
        ? body
        : null;
}

function limit(text: string): string {
    const single = text.split('\n')[0].trim();
    return single.length > MAX_MESSAGE_LENGTH
        ? `${single.slice(0, MAX_MESSAGE_LENGTH)}...`
        : single;
}

/**
 * Turns an HTTP failure into a short message safe to show to the user.
 * Never exposes stack traces or raw response bodies.
 */
export function toCatalogError(
    error: unknown,
    action: 'refresh' | 'save' | 'load' = 'load',
): CatalogErrorView {
    if (!(error instanceof HttpErrorResponse)) {
        return { kind: 'generic', message: 'Unexpected error.', details: [] };
    }
    const message = serverMessage(error.error);
    switch (error.status) {
        case 0:
            return {
                kind: 'generic',
                message: 'Cannot reach the server. Check your connection.',
                details: [],
            };
        case 403:
            return {
                kind: 'forbidden',
                message: 'This page requires the training administrator role.',
                details: [],
            };
        case 409:
            return {
                kind: 'conflict',
                message:
                    action === 'refresh'
                        ? 'A refresh is already running for this source. Try again when it finishes.'
                        : limit(
                              message ??
                                  'A catalog source for this repository and revision already exists.',
                          ),
                details: [],
            };
        case 422: {
            const errors = asRecord(error.error)?.['errors'];
            return {
                kind: 'invalid-catalog',
                message: 'catalog.json is invalid. Nothing was changed.',
                details: Array.isArray(errors)
                    ? errors.filter(
                          (entry): entry is string => typeof entry === 'string',
                      )
                    : [],
            };
        }
        case 502:
            return {
                kind: 'generic',
                message: limit(
                    message ?? 'GitHub or an upstream service failed.',
                ),
                details: [],
            };
        default:
            return {
                kind: 'generic',
                message: limit(
                    message ??
                        (action === 'refresh'
                            ? 'Refresh failed.'
                            : action === 'save'
                              ? 'Unable to save the source.'
                              : 'Unable to load catalog data.'),
                ),
                details: [],
            };
    }
}

export function shortCommit(commit: string | null | undefined): string {
    return commit ? commit.slice(0, 7) : '-';
}

export function truncate(text: string | null, max = 60): string {
    if (!text) {
        return '';
    }
    return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
}

/** Course order, then order in course, then catalog id. */
export function sortCatalogItems(items: CatalogItem[]): CatalogItem[] {
    return [...items].sort(
        (a, b) =>
            a.courseOrder - b.courseOrder ||
            a.orderInCourse - b.orderInCourse ||
            a.catalogId.localeCompare(b.catalogId),
    );
}

/** Distinct courses (id and title) in course order. */
export function distinctCourses(
    items: CatalogItem[],
): { id: string; title: string }[] {
    const seen = new Map<string, { title: string; order: number }>();
    for (const item of items) {
        if (!seen.has(item.course)) {
            seen.set(item.course, {
                title: item.courseTitle,
                order: item.courseOrder,
            });
        }
    }
    return [...seen.entries()]
        .sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))
        .map(([id, value]) => ({ id, title: value.title }));
}

export interface SummaryCount {
    label: string;
    value: number;
}

export function summaryCounts(summary: CatalogSyncSummary): SummaryCount[] {
    return [
        { label: 'Created', value: summary.created },
        { label: 'Updated', value: summary.updated },
        { label: 'Skipped', value: summary.skipped },
        { label: 'Metadata updated', value: summary.metadataUpdated },
        { label: 'Resumed', value: summary.resumed },
        { label: 'Older versions kept', value: summary.supersededKept },
        { label: 'Failed', value: summary.failed },
        { label: 'Not built', value: summary.notBuilt },
        { label: 'Removed', value: summary.removed },
    ];
}

export function hasOlderVersions(item: CatalogItem): boolean {
    return (item.previousVersions?.length ?? 0) > 0;
}

/** Multi-line tooltip text describing superseded versions still in place. */
export function previousVersionsText(item: CatalogItem): string {
    return (item.previousVersions ?? [])
        .map((version) =>
            [
                `Reason: ${version.keptReason ?? 'cleanup not attempted yet'}`,
                `definition ${version.trainingDefinitionId ?? '-'}`,
                `pool ${version.poolId ?? '-'}`,
                `instance ${version.trainingInstanceId ?? '-'}`,
            ].join(', '),
        )
        .join('\n');
}

/** Mirrors the backend: https://github.com/<owner>/<repo>[.git], nothing else. */
export function isGithubHttpsUrl(value: string): boolean {
    return /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}\/?$/i.test(
        value.trim(),
    );
}

export const REV_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/* ---------- Plain-language view helpers for the Catalog page ---------- */

export type CatalogTypeFilter = '' | CatalogItem['type'];
export type CatalogStatusFilter = '' | 'ready' | 'attention';

export interface CatalogViewFilters {
    search: string;
    course: string;
    type: CatalogTypeFilter;
    status: CatalogStatusFilter;
    certification: string;
}

/**
 * Entries without a folder in the repository ("not built") are never shown.
 * Entries removed from the repository are shown only with technical details on.
 */
export function isListed(item: CatalogItem, technical: boolean): boolean {
    if (item.state === 'not_built') {
        return false;
    }
    return technical || item.state !== 'removed_from_catalog';
}

export function filterCatalogItems(
    items: CatalogItem[],
    filters: CatalogViewFilters,
    technical: boolean,
): CatalogItem[] {
    const search = filters.search.trim().toLowerCase();
    return items.filter((item) => {
        if (!isListed(item, technical)) return false;
        if (filters.course && item.course !== filters.course) return false;
        if (filters.type && item.type !== filters.type) return false;
        if (
            filters.certification &&
            !(item.certifications ?? []).includes(filters.certification)
        )
            return false;
        if (filters.status === 'ready' && item.state !== 'synced') return false;
        if (filters.status === 'attention' && item.state !== 'failed')
            return false;
        if (!search) return true;
        return [item.title, item.description, item.courseTitle, item.unit]
            .join(' ')
            .toLowerCase()
            .includes(search);
    });
}

export function statusLabel(state: CatalogItem['state']): string {
    switch (state) {
        case 'synced':
            return 'Ready';
        case 'failed':
            return 'Needs attention';
        case 'removed_from_catalog':
            return 'No longer in library';
        default:
            return 'Not available';
    }
}

export function typeLabel(type: CatalogItem['type']): string {
    return type === 'mcq' ? 'Quiz' : 'Hands-on lab';
}

export function levelLabel(difficulty: string): string {
    return difficulty
        ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
        : '-';
}

/** "owner/repo" from a GitHub URL, for display. */
export function libraryName(repoUrl: string): string {
    const match = /github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i.exec(
        repoUrl.trim(),
    );
    return match ? match[1] : repoUrl;
}

export function sourceStatusLabel(status: CatalogSyncStatus): {
    text: string;
    tone: 'ok' | 'warn' | 'error' | 'neutral';
} {
    switch (status) {
        case 'success':
            return { text: 'Up to date', tone: 'ok' };
        case 'partial':
            return {
                text: 'Updated, some trainings need attention',
                tone: 'warn',
            };
        case 'failed':
            return { text: 'Last update failed', tone: 'error' };
        case 'running':
            return { text: 'Updating', tone: 'neutral' };
        default:
            return { text: 'Not updated yet', tone: 'neutral' };
    }
}

/** One sentence describing what an update changed, without technical terms. */
export function summarySentence(summary: CatalogSyncSummary): string {
    const parts: string[] = [];
    const plural = (n: number, word: string) =>
        `${n} ${word}${n === 1 ? '' : 's'}`;
    if (summary.created > 0)
        parts.push(`${plural(summary.created, 'new training')} added`);
    if (summary.updated > 0)
        parts.push(
            `${plural(summary.updated, 'training')} updated to a new version`,
        );
    if (summary.removed > 0)
        parts.push(
            `${plural(summary.removed, 'training')} removed from the library`,
        );
    if (summary.failed > 0)
        parts.push(`${plural(summary.failed, 'training')} could not be set up`);
    if (summary.error)
        return 'The update could not finish. Nothing was changed.';
    return parts.length > 0
        ? `${parts.join(', ')}.`
        : 'No changes. Everything was already up to date.';
}

/** Certifications used by at least one of the given items, sorted by name. */
export function usedCertifications(
    certifications: CatalogCertification[],
    items: CatalogItem[],
): CatalogCertification[] {
    const used = new Set(items.flatMap((item) => item.certifications ?? []));
    return certifications
        .filter((certification) => used.has(certification.id))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** Display names of an item's certifications, in catalog order. */
export function certificationNames(
    item: CatalogItem,
    byId: Map<string, CatalogCertification>,
): string[] {
    return (item.certifications ?? []).map((id) => byId.get(id)?.name ?? id);
}
