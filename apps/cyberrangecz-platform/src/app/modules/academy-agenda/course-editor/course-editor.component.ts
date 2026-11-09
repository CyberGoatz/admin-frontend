import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import {
    SentinelConfirmationDialogComponent,
    SentinelConfirmationDialogConfig,
    SentinelDialogResultEnum,
} from '@sentinel/components/dialogs';
import { filter, switchMap } from 'rxjs';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { ChecklistKey, Course, PublishChecklist } from '../../../academy/academy.model';
import { TenantContextService } from '../../../academy/tenant-context.service';
import { formatDate, label } from '../shared/academy-format';
import { CourseDetailsFormComponent } from './course-details-form.component';
import { CourseEnrollmentsComponent } from './course-enrollments.component';
import { CourseModulesComponent } from './course-modules.component';
import { CourseRangeFormComponent } from './course-range-form.component';
import { CourseStaffComponent } from './course-staff.component';
import { CourseProgressComponent } from './course-progress.component';

const TABS = ['details', 'modules', 'range', 'enrollments', 'progress'] as const;
const PROVISIONING_POLL_MS = 3000;

export const CHECKLIST_LABELS: Record<ChecklistKey, string> = {
    has_missions: 'Missions',
    dates_valid: 'Dates',
    quota_fits: 'Sandbox quota',
    missions_have_sandbox: 'Sandbox definitions',
    staff_present: 'Course staff',
};

/**
 * Professor's course editor: details, modules and missions, range settings,
 * enrollments, and publishing with the server's checklist.
 */
@Component({
    selector: 'crczp-academy-course-editor',
    templateUrl: './course-editor.component.html',
    styles: `
        .course-heading {
            flex: 1 1 18rem;
            min-width: 0;
        }
        .course-title {
            margin: 0;
            overflow-wrap: anywhere;
            font-size: 1.375rem;
            font-weight: 600;
        }
        .course-title .academy-muted {
            font-weight: 400;
            margin-left: 0.5rem;
        }
        mat-tab-group {
            margin-top: -0.5rem;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        CourseDetailsFormComponent,
        CourseModulesComponent,
        CourseRangeFormComponent,
        CourseEnrollmentsComponent,
        CourseStaffComponent,
        CourseProgressComponent,
    ],
})
export class CourseEditorComponent {
    readonly label = label;
    readonly formatDate = formatDate;
    readonly checklistLabels = CHECKLIST_LABELS;

    readonly course = signal<Course | null>(null);
    readonly checklist = signal<PublishChecklist | null>(null);
    /** True when the checklist came from a refused publish rather than the read-only check. */
    readonly publishRefused = signal(false);
    readonly checklistDismissed = signal(false);
    readonly error = signal<string | null>(null);
    readonly publishing = signal(false);
    readonly tabIndex = signal(0);

    private readonly member = inject(TenantContextService).member;
    /** Professors and tenant admins edit; TAs read. Archived courses are read-only. */
    readonly canEdit = computed(
        () =>
            ['professor', 'tenant_admin'].includes(this.member()?.role ?? '') &&
            this.course()?.status !== 'archived',
    );
    readonly isDraft = computed(() => this.course()?.status === 'draft');
    readonly canManageGrades = computed(() =>
        ['professor', 'tenant_admin'].includes(this.member()?.role ?? ''),
    );
    /** Pools are only provisioned after publish; drafts report `pending` too. */
    readonly provisioning = computed(
        () =>
            this.course()?.status === 'published' &&
            this.course()
                .modules.flatMap((m) => m.missions)
                .some((m) => m.provisioning === 'pending'),
    );

    private readonly api = inject(AcademyApiService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly dialog = inject(MatDialog);
    private readonly snack = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);
    private pollTimer: ReturnType<typeof setTimeout> | null = null;
    courseId = '';

    constructor() {
        this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
            this.courseId = params.get('courseId') ?? '';
            this.reload();
        });
        this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
            const index = TABS.indexOf(params.get('tab') as (typeof TABS)[number]);
            this.tabIndex.set(Math.max(0, index));
        });
        this.destroyRef.onDestroy(() => this.clearPoll());
    }

    reload(): void {
        this.api.getCourse(this.courseId).subscribe({
            next: (course) => {
                this.course.set(course);
                this.error.set(null);
                this.schedulePoll();
                this.loadChecklist();
            },
            error: (err) => this.error.set(academyErrorMessage(err, 'The course could not be loaded.')),
        });
    }

    onCourseSaved(course: Course): void {
        this.course.set(course);
        this.loadChecklist();
    }

    dismissChecklist(): void {
        this.checklistDismissed.set(true);
        this.publishRefused.set(false);
    }

    /** Read-only readiness check for drafts; silently absent on older backends. */
    private loadChecklist(): void {
        if (this.course()?.status !== 'draft') {
            this.checklist.set(null);
            return;
        }
        this.api.publishChecklist(this.courseId).subscribe({
            next: (list) => {
                this.checklist.set(list);
                this.publishRefused.set(false);
            },
            error: () => {
                if (!this.publishRefused()) {
                    this.checklist.set(null);
                }
            },
        });
    }

    onTabChange(index: number): void {
        this.tabIndex.set(index);
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { tab: TABS[index] === 'details' ? null : TABS[index] },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }

    publish(): void {
        this.publishing.set(true);
        this.api.publishCourse(this.courseId).subscribe({
            next: (course) => {
                this.publishing.set(false);
                this.checklist.set(null);
                this.course.set(course);
                this.schedulePoll();
                this.snack.open('Course published. Sandbox pools are being prepared.', undefined, {
                    duration: 4000,
                });
            },
            error: (err) => {
                this.publishing.set(false);
                if (err?.status === 422 && err.error?.items) {
                    this.checklist.set(err.error as PublishChecklist);
                    this.publishRefused.set(true);
                    this.checklistDismissed.set(false);
                } else {
                    this.snack.open(academyErrorMessage(err, 'The course was not published.'), 'Close');
                }
            },
        });
    }

    archive(): void {
        this.confirm(
            'Archive course',
            'Archiving ends the course: students lose access to new runs and sandbox pools are released. Continue?',
            'Archive',
        )
            .pipe(switchMap(() => this.api.archiveCourse(this.courseId)))
            .subscribe({
                next: (course) => this.course.set(course),
                error: (err) => this.snack.open(academyErrorMessage(err, 'The course was not archived.'), 'Close'),
            });
    }

    remove(): void {
        const course = this.course();
        this.confirm('Delete course', `Delete the draft course ${course?.code}? This cannot be undone.`, 'Delete')
            .pipe(switchMap(() => this.api.deleteCourse(this.courseId)))
            .subscribe({
                next: () => void this.router.navigate(['academy', 'courses']),
                error: (err) => this.snack.open(academyErrorMessage(err, 'The course was not deleted.'), 'Close'),
            });
    }

    private confirm(title: string, message: string, action: string) {
        return this.dialog
            .open(SentinelConfirmationDialogComponent, {
                data: new SentinelConfirmationDialogConfig(title, message, 'Cancel', action),
            })
            .afterClosed()
            .pipe(filter((result) => result === SentinelDialogResultEnum.CONFIRMED));
    }

    /** Re-reads the course while published missions are still provisioning. */
    private schedulePoll(): void {
        this.clearPoll();
        if (this.provisioning()) {
            this.pollTimer = setTimeout(() => this.reload(), PROVISIONING_POLL_MS);
        }
    }

    private clearPoll(): void {
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }
}
