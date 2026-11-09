import {
    ChangeDetectionStrategy,
    Component,
    effect,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { Course } from '../../../academy/academy.model';
import { fromDateInput, toDateInput } from '../shared/academy-format';

/** Course details (`PATCH /courses/{id}`). */
@Component({
    selector: 'crczp-academy-course-details-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule],
    template: `
        <form class="tab-body" [formGroup]="form" (ngSubmit)="save()">
            <div class="academy-form-grid">
                <mat-form-field>
                    <mat-label>Course code</mat-label>
                    <input matInput formControlName="code" />
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Term</mat-label>
                    <input matInput formControlName="term" />
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Section</mat-label>
                    <input matInput formControlName="section" />
                </mat-form-field>
                <mat-form-field class="full">
                    <mat-label>Title</mat-label>
                    <input matInput formControlName="title" />
                </mat-form-field>
                <mat-form-field class="full">
                    <mat-label>Description</mat-label>
                    <textarea matInput formControlName="description" rows="4"></textarea>
                    <mat-hint>Students see this on the course page.</mat-hint>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Starts</mat-label>
                    <input matInput type="date" formControlName="startsAt" />
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Ends</mat-label>
                    <input matInput type="date" formControlName="endsAt" />
                    @if (form.hasError('order')) {
                        <mat-hint class="hint-error">Ends before it starts</mat-hint>
                    }
                </mat-form-field>
                <mat-slide-toggle class="full" formControlName="leaderboardEnabled">
                    Show a course leaderboard to students
                </mat-slide-toggle>
            </div>
            @if (error()) {
                <div class="academy-error">{{ error() }}</div>
            }
            @if (!readonly()) {
                <div class="form-actions">
                    <button mat-button type="button" [disabled]="form.pristine" (click)="reset()">Discard changes</button>
                    <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || form.pristine || saving()">
                        Save details
                    </button>
                </div>
            }
        </form>
    `,
    styles: `
        .tab-body {
            padding: 1.25rem 0;
            display: grid;
            gap: 1rem;
            max-width: 56rem;
        }
        .form-actions {
            display: flex;
            gap: 0.5rem;
            justify-content: flex-end;
        }
        .hint-error {
            color: var(--mat-sys-error);
        }
    `,
})
export class CourseDetailsFormComponent {
    readonly course = input.required<Course>();
    readonly readonly = input(false);
    readonly saved = output<Course>();

    readonly saving = signal(false);
    readonly error = signal<string | null>(null);

    private readonly api = inject(AcademyApiService);
    private readonly snack = inject(MatSnackBar);

    readonly form = inject(FormBuilder).nonNullable.group(
        {
            code: ['', [Validators.required, Validators.maxLength(20)]],
            title: ['', [Validators.required, Validators.maxLength(160)]],
            term: ['', [Validators.required, Validators.maxLength(40)]],
            section: ['', Validators.maxLength(40)],
            description: ['', Validators.maxLength(4000)],
            startsAt: [''],
            endsAt: [''],
            leaderboardEnabled: [false],
        },
        {
            validators: (group) => {
                const start = group.get('startsAt')?.value;
                const end = group.get('endsAt')?.value;
                return start && end && end < start ? { order: true } : null;
            },
        },
    );

    constructor() {
        effect(() => {
            this.course();
            this.reset();
            if (this.readonly()) {
                this.form.disable({ emitEvent: false });
            } else {
                this.form.enable({ emitEvent: false });
            }
        });
    }

    reset(): void {
        const c = this.course();
        this.form.reset({
            code: c.code,
            title: c.title,
            term: c.term,
            section: c.section ?? '',
            description: c.description ?? '',
            startsAt: toDateInput(c.startsAt),
            endsAt: toDateInput(c.endsAt),
            leaderboardEnabled: !!c.leaderboardEnabled,
        });
        this.error.set(null);
    }

    save(): void {
        const v = this.form.getRawValue();
        this.saving.set(true);
        this.api
            .updateCourse(this.course().id, {
                code: v.code.trim().toUpperCase(),
                title: v.title.trim(),
                term: v.term.trim(),
                section: v.section.trim() || null,
                description: v.description,
                startsAt: fromDateInput(v.startsAt),
                endsAt: fromDateInput(v.endsAt),
                leaderboardEnabled: v.leaderboardEnabled,
            })
            .subscribe({
                next: (course) => {
                    this.saving.set(false);
                    this.snack.open('Details saved', undefined, { duration: 2500 });
                    this.saved.emit(course);
                },
                error: (err) => {
                    this.saving.set(false);
                    this.error.set(
                        err?.status === 409
                            ? 'Another course already uses this code, term and section.'
                            : academyErrorMessage(err, 'The details were not saved.'),
                    );
                },
            });
    }
}
