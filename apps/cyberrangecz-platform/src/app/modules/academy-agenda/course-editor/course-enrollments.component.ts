import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    OnInit,
    output,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { Enrollment, EnrollmentStatus } from '../../../academy/academy.model';
import { formatDate, label } from '../shared/academy-format';
import { AddStudentDialogComponent } from './add-student-dialog.component';

/** Enrolled students and TAs with invite status (`GET /courses/{id}/enrollments`). */
@Component({
    selector: 'crczp-academy-course-enrollments',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
    template: `
        <div class="tab-body">
            <div class="academy-toolbar">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Search</mat-label>
                    <input matInput [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Name, email or roll number" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Status</mat-label>
                    <mat-select [ngModel]="status()" (ngModelChange)="status.set($event)">
                        <mat-option value="">All statuses</mat-option>
                        @for (s of statuses; track s) {
                            <mat-option [value]="s">{{ label(s) }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Section</mat-label>
                    <mat-select [ngModel]="section()" (ngModelChange)="section.set($event)">
                        <mat-option value="">All sections</mat-option>
                        @for (s of sections(); track s) {
                            <mat-option [value]="s">{{ s }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>
                <span class="spacer"></span>
                @if (!readonly()) {
                    <button mat-stroked-button type="button" (click)="addStudent()">
                        <mat-icon>person_add</mat-icon>
                        Add student
                    </button>
                    <a mat-flat-button color="primary" [routerLink]="['/academy', 'courses', courseId(), 'roster']">
                        <mat-icon>upload_file</mat-icon>
                        Upload roster
                    </a>
                }
            </div>

            <div class="academy-counts">
                <div class="count"><strong>{{ counts().enrolled }}</strong><span>Enrolled</span></div>
                <div class="count"><strong>{{ counts().active }}</strong><span>Signed in</span></div>
                <div class="count"><strong>{{ counts().invited }}</strong><span>Invite pending</span></div>
                <div class="count"><strong>{{ counts().dropped }}</strong><span>Dropped</span></div>
            </div>

            @if (error()) {
                <div class="academy-error">{{ error() }}</div>
            }

            @if (!loading() && enrollments().length === 0) {
                <div class="academy-empty">No one is enrolled yet. Upload a roster CSV or add students one at a time.</div>
            } @else {
                <div class="academy-table-wrap">
                    <table class="academy-table">
                        <thead>
                            <tr>
                                <th>Roll number</th>
                                <th>Name</th>
                                <th>Section</th>
                                <th>Enrollment</th>
                                <th>Account</th>
                                <th>Source</th>
                                <th>Added</th>
                                @if (!readonly()) {
                                    <th class="actions"><span class="cdk-visually-hidden">Actions</span></th>
                                }
                            </tr>
                        </thead>
                        <tbody>
                            @for (e of filtered(); track e.id) {
                                <tr>
                                    <td>{{ e.member.rollNumber }}</td>
                                    <td>
                                        {{ e.member.displayName }}
                                        @if (e.member.role === 'ta') {
                                            <span class="pill">TA</span>
                                        }
                                        <span class="secondary">{{ e.member.email }}</span>
                                    </td>
                                    <td>{{ e.section }}</td>
                                    <td><span [class]="'pill pill-' + e.status">{{ label(e.status) }}</span></td>
                                    <td>
                                        <span [class]="'pill pill-' + e.member.status">
                                            {{ e.member.status === 'invited' ? 'Invite pending' : label(e.member.status) }}
                                        </span>
                                    </td>
                                    <td>{{ e.source === 'csv' ? 'CSV' : label(e.source) }}</td>
                                    <td>{{ formatDate(e.enrolledAt) }}</td>
                                    @if (!readonly()) {
                                        <td class="actions">
                                            @if (e.status === 'dropped') {
                                                <button mat-button type="button" [disabled]="busy() === e.id" (click)="setStatus(e, e.member.status === 'active' ? 'active' : 'invited')">Restore</button>
                                            } @else {
                                                <button mat-button color="warn" type="button" [disabled]="busy() === e.id" (click)="setStatus(e, 'dropped')">Drop</button>
                                            }
                                        </td>
                                    }
                                </tr>
                            } @empty {
                                <tr><td colspan="8" class="academy-muted">No enrollments match these filters.</td></tr>
                            }
                        </tbody>
                    </table>
                </div>
            }
        </div>
    `,
    styles: `
        .tab-body {
            padding: 1.25rem 0;
            display: grid;
            gap: 1rem;
        }
        td .pill {
            margin-left: 0.375rem;
        }
        td:nth-child(4) .pill,
        td:nth-child(5) .pill {
            margin-left: 0;
        }
    `,
})
export class CourseEnrollmentsComponent implements OnInit {
    readonly courseId = input.required<string>();
    readonly readonly = input(false);
    readonly changed = output<void>();

    readonly label = label;
    readonly formatDate = formatDate;
    readonly statuses: EnrollmentStatus[] = ['invited', 'active', 'dropped', 'completed'];

    readonly enrollments = signal<Enrollment[]>([]);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly busy = signal<string | null>(null);
    readonly query = signal('');
    readonly status = signal<EnrollmentStatus | ''>('');
    readonly section = signal('');

    readonly sections = computed(() =>
        [...new Set(this.enrollments().map((e) => e.section).filter(Boolean))].sort(),
    );
    readonly filtered = computed(() => {
        const q = this.query().trim().toLowerCase();
        return this.enrollments().filter(
            (e) =>
                (!this.status() || e.status === this.status()) &&
                (!this.section() || e.section === this.section()) &&
                (!q ||
                    [e.member.displayName, e.member.email, e.member.rollNumber]
                        .filter(Boolean)
                        .some((v) => v.toLowerCase().includes(q))),
        );
    });
    readonly counts = computed(() => {
        const list = this.enrollments();
        const live = list.filter((e) => e.status !== 'dropped');
        return {
            enrolled: live.length,
            active: live.filter((e) => e.member.status === 'active').length,
            invited: live.filter((e) => e.member.status === 'invited').length,
            dropped: list.length - live.length,
        };
    });

    private readonly api = inject(AcademyApiService);
    private readonly dialog = inject(MatDialog);
    private readonly snack = inject(MatSnackBar);

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.api.listEnrollments(this.courseId()).subscribe({
            next: (list) => {
                this.enrollments.set(
                    [...list].sort((a, b) => (a.member.rollNumber ?? '').localeCompare(b.member.rollNumber ?? '')),
                );
                this.loading.set(false);
                this.error.set(null);
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(academyErrorMessage(err, 'Enrollments could not be loaded.'));
            },
        });
    }

    addStudent(): void {
        this.dialog
            .open(AddStudentDialogComponent, { data: this.courseId(), width: '560px', maxWidth: '95vw' })
            .afterClosed()
            .subscribe((enrollment?: Enrollment) => {
                if (enrollment) {
                    this.snack.open(`${enrollment.member.displayName} added`, undefined, { duration: 2500 });
                    this.load();
                    this.changed.emit();
                }
            });
    }

    setStatus(enrollment: Enrollment, status: EnrollmentStatus): void {
        this.busy.set(enrollment.id);
        this.api.updateEnrollment(this.courseId(), enrollment.id, { status }).subscribe({
            next: (updated) => {
                this.busy.set(null);
                this.enrollments.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
                this.changed.emit();
            },
            error: (err) => {
                this.busy.set(null);
                this.snack.open(academyErrorMessage(err, 'The change was not saved.'), 'Close');
            },
        });
    }
}
