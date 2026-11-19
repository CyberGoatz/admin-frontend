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
    | 'resumed'
    | 'failed'
    | 'not_built'
    | 'removed';

export interface CatalogItemResult {
    catalogId: string;
    outcome: CatalogItemOutcome;
    trainingDefinitionId?: string | null;
    sandboxDefinitionId?: string | null;
    poolId?: string | null;
    trainingInstanceId?: string | null;
    /** Set when an older version could not be cleaned up and was kept. */
    supersededKept?: string[];
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
    /** Entries where earlier steps were completed (pool, instance). */
    resumed: number;
    /** Entries whose previous version was kept because cleanup was not safe. */
    supersededKept: number;
    failed: number;
    notBuilt: number;
    removed: number;
    /** Set when the whole run failed before any entry was processed. */
    error?: string;
    items: CatalogItemResult[];
}

export interface CatalogSource {
    id: string;
    repoUrl: string;
    rev: string;
    lastSyncedCommit: string | null;
    lastSyncAt: string | null;
    lastSyncStatus: CatalogSyncStatus;
    lastSyncSummary: CatalogSyncSummary | null;
    /** Certification list from the catalog read by the last refresh. */
    certifications?: CatalogCertification[] | null;
    createdAt: string;
    updatedAt: string;
}

export interface CatalogCertification {
    id: string;
    name: string;
    issuer?: string;
    area?: string;
    level?: string;
}

export interface CatalogPreviousVersion {
    trainingDefinitionId: string | null;
    poolId: string | null;
    trainingInstanceId: string | null;
    /** Why this version was kept; null while cleanup has not been tried. */
    keptReason: string | null;
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
    /** Certification ids; absent before the first refresh with certifications. */
    certifications?: string[] | null;
    path: string | null;
    contentHash: string | null;
    trainingDefinitionId: string | null;
    sandboxDefinitionId: string | null;
    /** Null for MCQs, which have no pool. */
    poolId: string | null;
    trainingInstanceId: string | null;
    previousVersions: CatalogPreviousVersion[] | null;
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
