export type CatalogItemState =
    | 'synced'
    | 'failed'
    | 'not_built'
    | 'removed_from_catalog';

export const CATALOG_ITEM_STATES: readonly CatalogItemState[] = [
    'synced',
    'failed',
    'not_built',
    'removed_from_catalog',
];

export type CatalogItemType = 'hands-on' | 'mcq';

export type CatalogSyncStatus =
    | 'never'
    | 'running'
    | 'success'
    | 'partial'
    | 'failed';

export type CatalogItemOutcome =
    | 'created'
    | 'updated'
    | 'skipped'
    | 'metadata_updated'
    | 'failed'
    | 'not_built'
    | 'removed';

export interface CatalogItemResult {
    catalogId: string;
    outcome: CatalogItemOutcome;
    trainingDefinitionId?: string | null;
    sandboxDefinitionId?: string | null;
    error?: string;
}

export interface CatalogTrackResult {
    slug: string;
    outcome: 'created' | 'exists' | 'failed';
    error?: string;
}

export interface CatalogSyncSummary {
    commit: string | null;
    startedAt: string;
    finishedAt: string;
    created: number;
    updated: number;
    skipped: number;
    metadataUpdated: number;
    failed: number;
    notBuilt: number;
    removed: number;
    /** Set when the whole run failed before any entry was processed. */
    error?: string;
    items: CatalogItemResult[];
    tracks: CatalogTrackResult[];
}

export interface CatalogSource {
    id: string;
    repoUrl: string;
    rev: string;
    lastSyncedCommit: string | null;
    lastSyncAt: string | null;
    lastSyncStatus: CatalogSyncStatus;
    lastSyncSummary: CatalogSyncSummary | null;
    createdAt: string;
    updatedAt: string;
}

/** Definition ids are Postgres bigint values, serialized as strings. */
export interface CatalogItem {
    id: string;
    sourceId: string;
    catalogId: string;
    type: CatalogItemType;
    course: string;
    courseTitle: string;
    courseOrder: number;
    unit: string;
    unitOrder: number;
    orderInCourse: number;
    difficulty: string;
    title: string;
    definitionTitle: string;
    description: string;
    path: string | null;
    contentHash: string | null;
    trainingDefinitionId: string | null;
    sandboxDefinitionId: string | null;
    state: CatalogItemState;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCatalogSourcePayload {
    repoUrl: string;
    rev?: string;
}

export interface UpdateCatalogSourcePayload {
    repoUrl?: string;
    rev?: string;
}

export interface CatalogItemsQuery {
    state?: CatalogItemState;
    course?: string;
}
