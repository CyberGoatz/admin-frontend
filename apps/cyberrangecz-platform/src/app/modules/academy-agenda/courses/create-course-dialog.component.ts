import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { Course } from '../../../academy/academy.model';

function currentTerm(now = new Date()): string {
    const month = now.getMonth();
    const year = now.getFullYear();
    if (month >= 6) {
        return `Fall ${year}`;
    }
    return month >= 0 && month < 5 ? `Winter ${year}` : `Summer ${year}`;
}

/** Creates a draft course (`POST /courses`); the caller becomes its owner. */
@Component({
    selector: 'crczp-academy-create-course-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
    template: `
        <h2 mat-dialog-title>New course</h2>
        <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-dialog-content>
                <div class="academy-form-grid">
                    <mat-form-field>
                        <mat-label>Course code</mat-label>
                        <input matInput formControlName="code" placeholder="CSE3501" required />
                    </mat-form-field>
                    <mat-form-field>
                        <mat-label>Term</mat-label>
                        <input matInput formControlName="term" required />
                    </mat-form-field>
                    <mat-form-field class="full">
                        <mat-label>Title</mat-label>
                        <input matInput formControlName="title" required />
                    </mat-form-field>
                    <mat-form-field>
                        <mat-label>Section</mat-label>
                        <input matInput formControlName="section" placeholder="Optional" />
                    </mat-form-field>
                </div>
                <p class="academy-muted academy-small">
                    The course starts as a draft. Students see it only after you publish.
                </p>
                @if (error()) {
                    <div class="academy-error">{{ error() }}</div>
                }
            </mat-dialog-content>
            <mat-dialog-actions align="end">
                <button mat-button type="button" mat-dialog-close>Cancel</button>
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                    Create course
                </button>
            </mat-dialog-actions>
        </form>
    `,
})
export class CreateCourseDialogComponent {
    readonly saving = signal(false);
    readonly error = signal<string | null>(null);

    private readonly api = inject(AcademyApiService);
    private readonly dialogRef = inject(MatDialogRef<CreateCourseDialogComponent, Course>);

    readonly form = inject(FormBuilder).nonNullable.group({
        code: ['', [Validators.required, Validators.maxLength(20)]],
        title: ['', [Validators.required, Validators.maxLength(160)]],
        term: [currentTerm(), [Validators.required, Validators.maxLength(40)]],
        section: ['', Validators.maxLength(40)],
    });

    submit(): void {
        if (this.form.invalid) {
            return;
        }
        const value = this.form.getRawValue();
        this.saving.set(true);
        this.error.set(null);
        this.api
            .createCourse({
                code: value.code.trim().toUpperCase(),
                title: value.title.trim(),
                term: value.term.trim(),
                section: value.section.trim() || null,
            })
            .subscribe({
                next: (course) => this.dialogRef.close(course),
                error: (err) => {
                    this.saving.set(false);
                    this.error.set(
                        err?.status === 409
                            ? 'A course with this code, term and section already exists.'
                            : academyErrorMessage(err, 'The course was not created.'),
                    );
                },
            });
    }
}
