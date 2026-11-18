import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    OnInit,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    SentinelConfirmationDialogComponent,
    SentinelConfirmationDialogConfig,
    SentinelDialogResultEnum,
} from '@sentinel/components/dialogs';
import { filter, switchMap } from 'rxjs';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import {
    GradebookPreset,
    ProgressCell,
    ProgressGrid,
    ProgressStudent,
} from '../../../academy/academy.model';
import { downloadBlob, fileNameFromDisposition, formatDate, formatDateTime } from '../shared/academy-format';

const PRESETS: { value: GradebookPreset; label: string }[] = [
    { value: 'default', label: 'Standard CSV' },
    { value: 'canvas', label: 'Canvas' },
    { value: 'blackboard', label: 'Blackboard' },
    { value: 'moodle', label: 'Moodle' },
];

/**
 * Students by missions grid read live from the engine
 * (`GET /courses/{id}/progress`), with grade freeze and gradebook export.
 */
@Component({
    selector: 'crczp-academy-course-progress',
    templateUrl: './course-progress.component.html',
    styleUrls: ['./course-progress.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
    ],
})
export class CourseProgressComponent implements OnInit {
    readonly courseId = input.required<string>();
    readonly courseCode = input('');
    /** Professors and tenant admins may freeze and export; TAs only view. */
    readonly canManageGrades = input(false);

    readonly presets = PRESETS;
    readonly formatDate = formatDate;

    readonly grid = signal<ProgressGrid | null>(null);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly query = signal('');
    readonly section = signal('');
    readonly preset = signal<GradebookPreset>('default');
    readonly exporting = signal(false);
    readonly freezing = signal(false);

    readonly sections = computed(() =>
        [...new Set((this.grid()?.students ?? []).map((s) => s.section).filter(Boolean))].sort(),
    );

    readonly students = computed(() => {
        const q = this.query().trim().toLowerCase();
        const section = this.section();
        return (this.grid()?.students ?? []).filter(
            (s) =>
                (!section || s.section === section) &&
                (!q || s.displayName.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q)),
        );
    });

    /** Per-mission share of the shown students who finished, and late count. */
    readonly missionStats = computed(() => {
        const grid = this.grid();
        const shown = this.students();
        return (grid?.missions ?? []).map((_, i) => {
            const cells = shown.map((s) => s.cells[i]).filter(Boolean);
            const finished = cells.filter((c) => c.state === 'finished').length;
            return {
                finishedPct: cells.length ? Math.round((finished / cells.length) * 100) : 0,
                late: shown.filter((s) => s.cells[i]?.late || this.isMissing(s.cells[i], i)).length,
            };
        });
    });

    readonly summary = computed(() => {
        const shown = this.students();
        const cells = shown.flatMap((s) => s.cells);
        const avg = shown.length ? shown.reduce((sum, s) => sum + s.completion, 0) / shown.length : 0;
        return {
            students: shown.length,
            completion: Math.round(avg * 100),
            inProgress: cells.filter((c) => c.state === 'in_progress').length,
            slots: cells.length,
            late: shown.reduce(
                (sum, s) => sum + s.cells.filter((c, i) => c.late || this.isMissing(c, i)).length,
                0,
            ),
        };
    });

    readonly pastDueMissions = computed(() => {
        const now = Date.now();
        return (this.grid()?.missions ?? []).filter((m) => m.dueAt && Date.parse(m.dueAt) < now);
    });

    private readonly api = inject(AcademyApiService);
    private readonly dialog = inject(MatDialog);
    private readonly snack = inject(MatSnackBar);

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.api.progress(this.courseId()).subscribe({
            next: (grid) => {
                this.grid.set(grid);
                this.loading.set(false);
                this.error.set(null);
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(academyErrorMessage(err, 'Progress could not be loaded.'));
            },
        });
    }

    /** Past-due missions never finished; the server only flags late on finished runs. */
    isMissing(cell: ProgressCell | undefined, index: number): boolean {
        if (!cell || cell.state === 'finished' || cell.state === 'locked') {
            return false;
        }
        if (cell.state === 'not_started' && cell.late) {
            return true;
        }
        const due = this.grid()?.missions[index]?.dueAt;
        return cell.state === 'not_started' && !!due && Date.parse(due) < Date.now();
    }

    cellClass(cell: ProgressCell, index: number): string {
        const missing = this.isMissing(cell, index);
        return `cell state-${cell.state}${cell.late || missing ? ' late' : ''}`;
    }

    cellLabel(cell: ProgressCell | undefined, index = -1): string {
        if (!cell) {
            return '';
        }
        switch (cell.state) {
            case 'finished':
                return cell.maxScore ? `${formatScore(cell.score)}/${formatScore(cell.maxScore)}` : formatScore(cell.score);
            case 'in_progress':
                return 'In progress';
            case 'locked':
                return 'Locked';
            default:
                return this.isMissing(cell, index) ? 'Missing' : 'Not started';
        }
    }

    cellTitle(student: ProgressStudent, index: number): string {
        const cell = student.cells[index];
        const mission = this.grid()?.missions[index];
        if (!cell || !mission) {
            return '';
        }
        const parts = [`${student.displayName}: ${mission.title}`, this.cellLabel(cell, index)];
        if (cell.late || this.isMissing(cell, index)) {
            parts.push(cell.state === 'finished' ? 'submitted late' : 'past due');
        }
        if (cell.finishedAt) {
            parts.push(`finished ${formatDateTime(cell.finishedAt)}`);
        }
        if (cell.hintsUsed) {
            parts.push(`${cell.hintsUsed} hints`);
        }
        if (cell.timeSpentSeconds) {
            parts.push(`${Math.round(cell.timeSpentSeconds / 60)} min`);
        }
        return parts.join(' · ');
    }

    freeze(): void {
        const count = this.pastDueMissions().length;
        if (!count) {
            this.snack.open('No mission is past its due date yet.', undefined, { duration: 3000 });
            return;
        }
        this.dialog
            .open(SentinelConfirmationDialogComponent, {
                data: new SentinelConfirmationDialogConfig(
                    'Freeze grades',
                    `Record the current grades for the ${count} ${count === 1 ? 'mission' : 'missions'} past due? ` +
                        'Frozen grades are what the gradebook exports; later runs do not change them.',
                    'Cancel',
                    'Freeze',
                ),
            })
            .afterClosed()
            .pipe(
                filter((r) => r === SentinelDialogResultEnum.CONFIRMED),
                switchMap(() => {
                    this.freezing.set(true);
                    return this.api.freezeGrades(this.courseId());
                }),
            )
            .subscribe({
                next: ({ frozen }) => {
                    this.freezing.set(false);
                    this.snack.open(`${frozen} grades frozen`, undefined, { duration: 3000 });
                },
                error: (err) => {
                    this.freezing.set(false);
                    this.snack.open(academyErrorMessage(err, 'Grades were not frozen.'), 'Close');
                },
            });
    }

    exportGrades(): void {
        const preset = this.preset();
        this.exporting.set(true);
        this.api.gradesCsv(this.courseId(), preset).subscribe({
            next: (response) => {
                this.exporting.set(false);
                const fallback = `${this.courseCode() || 'course'}-grades-${preset}.csv`;
                downloadBlob(
                    response.body ?? new Blob([], { type: 'text/csv' }),
                    fileNameFromDisposition(response.headers.get('Content-Disposition'), fallback),
                );
            },
            error: (err) => {
                this.exporting.set(false);
                this.snack.open(academyErrorMessage(err, 'The gradebook could not be exported.'), 'Close');
            },
        });
    }
}

function formatScore(value: number | null | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
