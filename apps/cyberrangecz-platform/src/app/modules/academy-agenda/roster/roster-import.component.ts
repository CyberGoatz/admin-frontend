import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subscription, switchMap, takeWhile, timer } from 'rxjs';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import {
    CourseSummary,
    RosterImport,
    RosterImportDetail,
    RosterPreview,
    RosterRowInput,
    RosterRowOutcome,
} from '../../../academy/academy.model';
import { downloadText, formatDateTime, label } from '../shared/academy-format';

type Step = 'upload' | 'preview' | 'committing' | 'done';

const POLL_MS = 1000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FIELD_LABELS: Record<string, string> = {
    email: 'email',
    first_name: 'first name',
    last_name: 'last name',
    name: 'full name (split on the last space)',
    roll_number: 'roll number',
    section: 'section',
    role: 'role',
};

/**
 * Roster CSV import: upload, a preview with per-row outcomes and inline
 * errors (`POST /roster/preview`), commit (`POST /roster/commit`) and a
 * progress view that polls `GET /roster-imports/{id}`.
 */
@Component({
    selector: 'crczp-academy-roster-import',
    templateUrl: './roster-import.component.html',
    styleUrls: ['./roster-import.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        RouterLink,
        MatButtonModule,
        MatCheckboxModule,
        MatIconModule,
        MatProgressBarModule,
        MatSlideToggleModule,
    ],
})
export class RosterImportComponent {
    readonly label = label;
    readonly formatDateTime = formatDateTime;
    readonly fieldLabels = FIELD_LABELS;

    readonly courseId: string;
    readonly course = signal<CourseSummary | null>(null);
    readonly step = signal<Step>('upload');
    readonly uploading = signal(false);
    readonly dragOver = signal(false);
    readonly error = signal<string | null>(null);
    readonly preview = signal<RosterPreview | null>(null);
    readonly onlyErrors = signal(false);
    readonly sendInvites = signal(true);
    readonly dropMissing = signal(false);
    readonly importState = signal<RosterImportDetail | RosterImport | null>(null);
    readonly history = signal<RosterImport[]>([]);

    readonly rows = computed(() => {
        const rows = this.preview()?.rows ?? [];
        return this.onlyErrors() ? rows.filter((r) => r.outcome === 'error') : rows;
    });
    readonly applicable = computed(() => {
        const c = this.preview()?.counts;
        return c ? c.total - c.error : 0;
    });
    readonly mapping = computed(() => Object.entries(this.preview()?.detectedColumns ?? {}));
    readonly processed = computed(() => {
        const s = this.importState();
        // enrolled counts new and newly enrolled rows; updated rows were already enrolled
        return s ? s.enrolled + s.updated + s.skipped + s.failed : 0;
    });
    readonly percent = computed(() => {
        const s = this.importState();
        return s?.rowCount ? Math.min(100, Math.round((this.processed() / s.rowCount) * 100)) : 0;
    });

    private readonly api = inject(AcademyApiService);
    private readonly destroyRef = inject(DestroyRef);
    private poll?: Subscription;

    constructor() {
        this.courseId = inject(ActivatedRoute).snapshot.paramMap.get('courseId') ?? '';
        this.api.getCourse(this.courseId).subscribe((course) => this.course.set(course));
        this.loadHistory();
    }

    // upload

    onFileInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (file) {
            this.upload(file);
        }
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(false);
        const file = event.dataTransfer?.files?.[0];
        if (file) {
            this.upload(file);
        }
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dragOver.set(true);
    }

    upload(file: File): void {
        this.error.set(null);
        if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
            this.error.set('Choose a .csv file. Export spreadsheets as CSV (UTF-8) first.');
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            this.error.set('The file is larger than 5 MB. A roster holds at most 2,000 rows.');
            return;
        }
        this.uploading.set(true);
        this.api.previewRoster(this.courseId, file).subscribe({
            next: (preview) => {
                this.uploading.set(false);
                this.preview.set(preview);
                this.onlyErrors.set(false);
                this.dropMissing.set(false);
                this.step.set('preview');
            },
            error: (err) => {
                this.uploading.set(false);
                this.error.set(academyErrorMessage(err, 'The file could not be read.'));
            },
        });
    }

    downloadTemplate(): void {
        this.api.rosterTemplate(this.courseId).subscribe({
            next: (csv) => downloadText(csv, `${this.course()?.code ?? 'roster'}-template.csv`),
            error: (err) => this.error.set(academyErrorMessage(err, 'The template could not be downloaded.')),
        });
    }

    // preview

    errorFor(row: RosterRowOutcome, field: keyof RosterRowInput): string | null {
        const messages = (row.errors ?? []).filter((e) => e.field === field).map((e) => e.message || label(e.code));
        return messages.length ? messages.join('; ') : null;
    }

    rowErrors(row: RosterRowOutcome): string[] {
        return (row.errors ?? [])
            .filter((e) => !e.field || !['email', 'firstName', 'lastName', 'rollNumber', 'section', 'role'].includes(e.field))
            .map((e) => e.message || label(e.code));
    }

    outcomeLabel(outcome: RosterRowOutcome['outcome']): string {
        return {
            create: 'New account',
            update: 'Update',
            enroll: 'Enroll',
            unchanged: 'No change',
            error: 'Skipped',
        }[outcome];
    }

    restart(): void {
        this.stopPolling();
        this.preview.set(null);
        this.importState.set(null);
        this.error.set(null);
        this.step.set('upload');
    }

    commit(): void {
        const preview = this.preview();
        if (!preview) {
            return;
        }
        this.uploading.set(true);
        this.error.set(null);
        this.api
            .commitRoster(this.courseId, {
                importId: preview.importId,
                sendInvites: this.sendInvites(),
                dropMissing: this.dropMissing(),
            })
            .subscribe({
                next: (state) => {
                    this.uploading.set(false);
                    this.importState.set(state);
                    this.step.set('committing');
                    this.startPolling(state.id);
                },
                error: (err) => {
                    this.uploading.set(false);
                    this.error.set(
                        err?.status === 409
                            ? 'This preview has expired or was already committed. Upload the file again.'
                            : academyErrorMessage(err, 'The roster was not committed.'),
                    );
                },
            });
    }

    downloadErrors(): void {
        const id = this.importState()?.id;
        if (id) {
            this.api.importErrorsCsv(id).subscribe((csv) => downloadText(csv, `roster-errors-${id.slice(0, 8)}.csv`));
        }
    }

    // progress

    private startPolling(importId: string): void {
        this.stopPolling();
        this.poll = timer(POLL_MS, POLL_MS)
            .pipe(
                switchMap(() => this.api.getImport(importId)),
                takeWhile((state) => state.status === 'committing' || state.status === 'previewed', true),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: (state) => {
                    this.importState.set(state);
                    if (state.status === 'completed' || state.status === 'failed' || state.status === 'expired') {
                        this.step.set('done');
                        this.loadHistory();
                        this.api.getCourse(this.courseId).subscribe((course) => this.course.set(course));
                    }
                },
                error: (err) => this.error.set(academyErrorMessage(err, 'Import progress is unavailable.')),
            });
    }

    private stopPolling(): void {
        this.poll?.unsubscribe();
        this.poll = undefined;
    }

    private loadHistory(): void {
        this.api.listImports(this.courseId).subscribe({
            next: (list) => this.history.set(list),
            error: () => this.history.set([]),
        });
    }
}
