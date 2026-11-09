import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { Course, CourseStatus, CourseSummary } from '../../../academy/academy.model';
import { TenantContextService } from '../../../academy/tenant-context.service';
import { formatDate, label, STAFF_ROLE_LABELS } from '../shared/academy-format';
import { CreateCourseDialogComponent } from './create-course-dialog.component';

/** Courses the caller teaches (tenant admins see every course). */
@Component({
    selector: 'crczp-academy-courses',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, MatButtonModule, MatButtonToggleModule, MatIconModule],
    template: `
        <div class="academy-page">
            <div class="academy-toolbar">
                <mat-button-toggle-group
                    [value]="status()"
                    (change)="setStatus($event.value)"
                    hideSingleSelectionIndicator
                    aria-label="Course status"
                >
                    <mat-button-toggle value="">All</mat-button-toggle>
                    <mat-button-toggle value="draft">Draft</mat-button-toggle>
                    <mat-button-toggle value="published">Published</mat-button-toggle>
                    <mat-button-toggle value="archived">Archived</mat-button-toggle>
                </mat-button-toggle-group>
                <span class="spacer"></span>
                @if (canCreate()) {
                    <button mat-flat-button color="primary" type="button" (click)="create()">
                        <mat-icon>add</mat-icon>
                        New course
                    </button>
                }
            </div>

            @if (error()) {
                <div class="academy-error">{{ error() }}</div>
            }

            @if (!loading() && courses().length === 0) {
                <div class="academy-empty">
                    @if (status()) {
                        No {{ status() }} courses.
                    } @else {
                        No courses yet. Create one to add modules, missions and a roster.
                    }
                </div>
            } @else {
                <div class="academy-table-wrap">
                    <table class="academy-table">
                        <thead>
                            <tr>
                                <th>Course</th>
                                <th>Term</th>
                                <th>Status</th>
                                <th>Staff</th>
                                <th class="num">Missions</th>
                                <th class="num">Enrolled</th>
                                <th>Dates</th>
                            </tr>
                        </thead>
                        <tbody>
                            @for (course of courses(); track course.id) {
                                <tr class="clickable" tabindex="0" (click)="open(course)" (keydown.enter)="open(course)">
                                    <td>
                                        <strong>{{ course.code }}</strong>
                                        <span class="secondary">{{ course.title }}</span>
                                    </td>
                                    <td>
                                        {{ course.term }}
                                        @if (course.section) {
                                            <span class="secondary">Section {{ course.section }}</span>
                                        }
                                    </td>
                                    <td><span [class]="'pill pill-' + course.status">{{ label(course.status) }}</span></td>
                                    <td>
                                        @for (s of course.staff; track s.memberId) {
                                            <span class="secondary">{{ s.displayName }} ({{ staffLabels[s.role] }})</span>
                                        }
                                    </td>
                                    <td class="num">{{ course.missionCount }}</td>
                                    <td class="num">{{ course.enrolledCount }}</td>
                                    <td>
                                        @if (course.startsAt) {
                                            {{ formatDate(course.startsAt) }} to {{ formatDate(course.endsAt) }}
                                        } @else {
                                            <span class="academy-muted">Not set</span>
                                        }
                                    </td>
                                </tr>
                            }
                        </tbody>
                    </table>
                </div>
            }
        </div>
    `,
})
export class CoursesComponent {
    readonly label = label;
    readonly formatDate = formatDate;
    readonly staffLabels = STAFF_ROLE_LABELS;
    readonly courses = signal<CourseSummary[]>([]);
    readonly status = signal<CourseStatus | ''>('');
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);

    private readonly member = inject(TenantContextService).member;
    readonly canCreate = computed(() => ['professor', 'tenant_admin'].includes(this.member()?.role ?? ''));

    private readonly api = inject(AcademyApiService);
    private readonly dialog = inject(MatDialog);
    private readonly router = inject(Router);

    constructor() {
        this.load();
    }

    setStatus(status: CourseStatus | ''): void {
        this.status.set(status);
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.api.listCourses(this.status() || undefined).subscribe({
            next: (courses) => {
                this.courses.set(courses);
                this.loading.set(false);
                this.error.set(null);
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(academyErrorMessage(err, 'Courses could not be loaded.'));
            },
        });
    }

    open(course: CourseSummary): void {
        void this.router.navigate(['academy', 'courses', course.id]);
    }

    create(): void {
        this.dialog
            .open(CreateCourseDialogComponent, { width: '560px', maxWidth: '95vw' })
            .afterClosed()
            .subscribe((course?: Course) => {
                if (course) {
                    void this.router.navigate(['academy', 'courses', course.id]);
                }
            });
    }
}
