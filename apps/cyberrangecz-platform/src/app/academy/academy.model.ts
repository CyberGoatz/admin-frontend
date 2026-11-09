/**
 * Types for the academy (campus tenancy) API.
 * Hand-written from backend-cybergoatz `openapi/academy.yaml` v0.1.0.
 * Keep field names identical to the contract.
 */

export type MemberRole = 'tenant_admin' | 'professor' | 'ta' | 'student';
export type MemberStatus = 'invited' | 'active' | 'suspended';
export type CourseStatus = 'draft' | 'published' | 'archived';
export type EnrollmentStatus = 'invited' | 'active' | 'dropped' | 'completed';
export type HintPolicy = 'allowed' | 'penalized' | 'disabled';
export type StaffRole = 'owner' | 'instructor' | 'ta';

export interface Branding {
    productName: string;
    legalName?: string;
    logoUrl?: string;
    logoDarkUrl?: string;
    markUrl?: string;
    faviconUrl?: string;
    colorPrimary: string;
    colorOnPrimary: string;
    colorAccent?: string;
    supportEmail?: string;
    emailFromName?: string;
}

export interface AdminConfigProvider {
    label?: string;
    issuer?: string;
    clientId?: string;
    scope?: string;
    logoutUrl?: string;
}

export interface AdminConfig {
    tenant?: string;
    title?: string;
    /** IANA zone for dates and lab windows. */
    timezone?: string;
    branding?: Branding;
    authConfig?: {
        providers?: AdminConfigProvider[];
    };
}

export interface Member {
    id: string;
    role: MemberRole;
    status: MemberStatus;
    email: string;
    givenName?: string;
    familyName?: string;
    displayName?: string;
    rollNumber?: string | null;
    department?: string | null;
    invitedAt?: string;
    activatedAt?: string | null;
}

export interface MemberPage {
    items: Member[];
    page: number;
    size: number;
    total: number;
}

export interface MemberInvite {
    email: string;
    firstName: string;
    lastName?: string;
    role: MemberRole;
    department?: string;
    sendInvite?: boolean;
}

export interface MemberPatch {
    role?: MemberRole;
    status?: MemberStatus;
    department?: string;
}

export interface MemberQuery {
    role?: MemberRole;
    status?: MemberStatus;
    q?: string;
    page?: number;
    size?: number;
}

export interface LibraryMission {
    trainingDefinitionId: number;
    title: string;
    description?: string;
    source: 'library' | 'tenant';
    estimatedDurationMinutes?: number;
    levels?: number;
    maxScore?: number;
    sandboxDefinitionId?: number | null;
    topics?: string[];
    mitreTechniques?: string[];
}

export interface CourseInput {
    code: string;
    title: string;
    term: string;
    section?: string | null;
    description?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    leaderboardEnabled?: boolean;
}

export type CoursePatch = Partial<CourseInput>;

export interface CourseStaffInput {
    memberId: string;
    role: 'instructor' | 'ta';
}

export interface CourseStaff {
    memberId: string;
    displayName: string;
    role: StaffRole;
}

export interface CourseSummary {
    id: string;
    code: string;
    title: string;
    term: string;
    section?: string | null;
    status: CourseStatus;
    startsAt?: string | null;
    endsAt?: string | null;
    enrolledCount: number;
    missionCount: number;
    staff: CourseStaff[];
}

export interface Course extends CourseSummary {
    description?: string;
    leaderboardEnabled?: boolean;
    modules: CourseModule[];
    range: CourseRange;
}

export interface ModuleInput {
    title: string;
    position?: number;
    unlocksAt?: string | null;
    dueAt?: string | null;
}

export interface CourseModule {
    id: string;
    title: string;
    position: number;
    unlocksAt?: string | null;
    dueAt?: string | null;
    missions: CourseMission[];
}

export interface MissionInput {
    trainingDefinitionId: number;
    position?: number;
    points?: number;
    dueAt?: string | null;
    attemptsAllowed?: number;
    required?: boolean;
    hintPolicy?: HintPolicy;
}

export type MissionPatch = Partial<MissionInput>;

export interface CourseMission extends MissionInput {
    id: string;
    title: string;
    trainingInstanceId?: number | null;
    poolId?: number | null;
    sandboxDefinitionId?: number | null;
    provisioning?: 'pending' | 'ready' | 'failed';
}

export interface LabWindow {
    weekday: number;
    start: string;
    end: string;
    timezone?: string;
}

export interface CourseRange {
    mode: 'per_student' | 'shared_team';
    poolBuffer: number;
    maxConcurrent?: number | null;
    vmSizeProfile: 'small' | 'standard' | 'large';
    idleTimeoutMinutes: number;
    labWindows: LabWindow[];
    teardownAt?: string | null;
}

export type ChecklistKey =
    | 'has_missions'
    | 'dates_valid'
    | 'quota_fits'
    | 'missions_have_sandbox'
    | 'staff_present';

export interface PublishChecklist {
    ok: boolean;
    items: { key: ChecklistKey; ok: boolean; message?: string }[];
}

export interface RosterRowInput {
    email: string;
    firstName: string;
    lastName?: string;
    rollNumber: string;
    section?: string;
    role?: 'student' | 'ta';
}

export type RosterRowErrorCode =
    | 'missing_email'
    | 'invalid_email'
    | 'missing_first_name'
    | 'missing_roll_number'
    | 'duplicate_email_in_file'
    | 'duplicate_roll_in_file'
    | 'roll_belongs_to_other_member'
    | 'email_belongs_to_other_role'
    | 'too_long';

export interface RosterRowError {
    code: RosterRowErrorCode;
    field?: string;
    message?: string;
}

export type RosterOutcome = 'create' | 'update' | 'enroll' | 'unchanged' | 'error';

export interface RosterRowOutcome {
    rowNumber: number;
    normalized: Partial<RosterRowInput>;
    outcome: RosterOutcome;
    errors?: RosterRowError[];
}

export interface RosterPreview {
    importId: string;
    fileName: string;
    detectedColumns: Record<string, string>;
    counts: {
        total: number;
        create: number;
        update: number;
        enroll: number;
        unchanged: number;
        error: number;
        missingFromFile: number;
    };
    rows: RosterRowOutcome[];
    expiresAt: string;
}

export type RosterImportStatus =
    | 'previewed'
    | 'committing'
    | 'completed'
    | 'failed'
    | 'expired';

export interface RosterImport {
    id: string;
    courseId: string;
    fileName: string;
    status: RosterImportStatus;
    rowCount: number;
    /** Rows handled so far while committing. */
    processed?: number;
    created: number;
    updated: number;
    enrolled: number;
    dropped: number;
    skipped: number;
    failed: number;
    uploadedBy: string;
    createdAt: string;
    completedAt?: string | null;
}

export interface RosterImportDetail extends RosterImport {
    rows: RosterRowOutcome[];
}

export interface RosterCommitRequest {
    importId: string;
    dropMissing?: boolean;
    sendInvites?: boolean;
}

export interface Enrollment {
    id: string;
    status: EnrollmentStatus;
    section?: string | null;
    source: 'csv' | 'manual' | 'lti' | 'join_code';
    enrolledAt: string;
    member: Member;
}

/** Error body shape used by every academy endpoint. */
export interface AcademyError {
    statusCode: number;
    message: string;
    code?: string;
}
