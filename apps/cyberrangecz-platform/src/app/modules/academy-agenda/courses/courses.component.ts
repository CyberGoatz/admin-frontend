import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
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
    imports: [MatButtonModule, MatIconModule],
    template: `
        <div class="academy-page">
            <header class="academy-header">
                <div class="academy-header-text">
                    <h1 class="academy-title">Courses</h1>
                    <p class="academy-description">
                        @if (isAdmin()) {
                            Every course in {{ tenantName }}. Open one to edit modules, rosters and grades.
                        } @else {
                            Courses you teach. Open one to edit modules, rosters and grades.
                        }
                    </p>
                </div>
                @if (canCreate()) {
                    <div class="academy-header-actions">
                        <button mat-flat-button color="primary" type="button" (click)="create()">
                            <mat-icon>add</mat-icon>
                            New course
                        </button>
                    </div>
                }
            </header>

            <div class="academy-toolbar">
                <div class="academy-segmented" role="group" aria-label="Course status">
                    @for (f of filters; track f.value) {
                        <button type="button" [attr.aria-pressed]="status() === f.value" (click)="status.set(f.value)">
                            {{ f.label }}
                            <span class="count">{{ counts()[f.value || 'all'] }}</span>
                        </button>
                    }
                </div>
            </div>

            @if (error()) {
                <div class="academy-error">{{ error() }}</div>
            }

            @if (loading()) {
                <div class="academy-table-wrap academy-loading" aria-busy="true">
                    <div class="academy-skeleton" style="padding: 20px"><span></span><span></span><span></span><span></span></div>
                </div>
            } @else if (courses().length === 0) {
                <div class="academy-empty">
                    @if (status()) {
                        <span class="empty-title">No {{ status() }} courses</span>
                        Courses move here when their status changes.
                    } @else {
                        <span class="empty-title">No courses yet</span>
                        Create a course to add modules, missions and a roster.
                        @if (canCreate()) {
                            <div>
                                <button mat-flat-button color="primary" type="button" (click)="create()">New course</button>
                            </div>
                        }
                    }
                </div>
            } @else {
                <div class="academy-table-wrap">
                    <table class="academy-table academy-table-stack">
                        <thead>
                            <tr>
                                <th>Course</th>
                                <th>Term</th>
                                <th>Status</th>
                                <th>Staff</th>
                                <th class="num">Missions</th>
                                <th class="num">Enrolled</th>
                                <th>Dates</th>
                                <th class="chevron"><span class="cdk-visually-hidden">Open</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            @for (course of courses(); track course.id) {
                                <tr class="clickable" tabindex="0" (click)="open(course)" (keydown.enter)="open(course)">
                                    <td class="primary">
                                        <span class="code">{{ course.code }}</span>
                                        <span class="secondary">{{ course.title }}</span>
                                    </td>
                                    <td data-label="Term">
                                        {{ course.term }}
                                        @if (course.section) {
                                            <span class="secondary">Section {{ course.section }}</span>
                                        }
                                    </td>
                                    <td data-label="Status"><span [class]="'pill pill-' + course.status">{{ label(course.status) }}</span></td>
                                    <td data-label="Staff">
                                        @for (s of course.staff; track s.memberId; let first = $first) {
                                            <span [class.secondary]="!first">{{ s.displayName }}@if (!first) { ({{ staffLabels[s.role] }})}</span>
                                        }
                                    </td>
                                    <td class="num" data-label="Missions">{{ course.missionCount }}</td>
                                    <td class="num" data-label="Enrolled">{{ course.enrolledCount }}</td>
                                    <td data-label="Dates">
                                        @if (course.startsAt) {
                                            {{ formatDate(course.startsAt) }}
                                            <span class="secondary">to {{ formatDate(course.endsAt) }}</span>
                                        } @else {
                                            <span class="academy-subtle">Not set</span>
                                        }
                                    </td>
                                    <td class="chevron"><mat-icon aria-hidden="true">chevron_right</mat-icon></td>
                                </tr>
                            }
                        </tbody>
                    </table>
                </div>
            }
        </div>
    `,
    styles: `
        td.chevron .mat-icon {
            width: 20px;
            height: 20px;
            font-size: 20px;
            vertical-align: middle;
        }
    `,
})
export class CoursesComponent {
    readonly label = label;
    readonly formatDate = formatDate;
    readonly staffLabels = STAFF_ROLE_LABELS;
    readonly filters: { value: CourseStatus | ''; label: string }[] = [
        { value: '', label: 'All' },
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'archived', label: 'Archived' },
    ];
    /** Every course the caller can see; the status filter applies client-side so counts stay visible. */
    readonly all = signal<CourseSummary[]>([]);
    readonly status = signal<CourseStatus | ''>('');
    readonly courses = computed(() => {
        const status = this.status();
        return status ? this.all().filter((c) => c.status === status) : this.all();
    });
    readonly counts = computed(() => {
        const counts: Record<string, number> = { all: this.all().length, draft: 0, published: 0, archived: 0 };
        this.all().forEach((c) => (counts[c.status] = (counts[c.status] ?? 0) + 1));
        return counts;
    });
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);

    private readonly tenant = inject(TenantContextService);
    private readonly member = this.tenant.member;
    readonly tenantName = this.tenant.runtime.branding.legalName || this.tenant.runtime.branding.productName;
    readonly isAdmin = computed(() => this.member()?.role === 'tenant_admin');
    readonly canCreate = computed(() => ['professor', 'tenant_admin'].includes(this.member()?.role ?? ''));

    private readonly api = inject(AcademyApiService);
    private readonly dialog = inject(MatDialog);
    private readonly router = inject(Router);

    constructor() {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.api.listCourses().subscribe({
            next: (courses) => {
                this.all.set(courses);
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
