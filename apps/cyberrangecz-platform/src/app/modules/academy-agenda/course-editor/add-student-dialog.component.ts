import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { Enrollment } from '../../../academy/academy.model';

/** Adds one student or TA by hand (`POST /courses/{id}/enrollments`). */
@Component({
    selector: 'crczp-academy-add-student-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
    template: `
        <h2 mat-dialog-title>Add a student</h2>
        <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-dialog-content>
                <div class="academy-form-grid">
                    <mat-form-field>
                        <mat-label>First name</mat-label>
                        <input matInput formControlName="firstName" required />
                    </mat-form-field>
                    <mat-form-field>
                        <mat-label>Last name</mat-label>
                        <input matInput formControlName="lastName" />
                    </mat-form-field>
                    <mat-form-field class="full">
                        <mat-label>Email</mat-label>
                        <input matInput type="email" formControlName="email" required />
                    </mat-form-field>
                    <mat-form-field>
                        <mat-label>Student ID</mat-label>
                        <input matInput formControlName="rollNumber" required />
                    </mat-form-field>
                    <mat-form-field>
                        <mat-label>Section</mat-label>
                        <input matInput formControlName="section" />
                    </mat-form-field>
                    <mat-form-field>
                        <mat-label>Role</mat-label>
                        <mat-select formControlName="role">
                            <mat-option value="student">Student</mat-option>
                            <mat-option value="ta">Teaching assistant</mat-option>
                        </mat-select>
                    </mat-form-field>
                </div>
                <p class="academy-muted academy-small">New people get an invite email with a link to set their password.</p>
                @if (error()) {
                    <div class="academy-error">{{ error() }}</div>
                }
            </mat-dialog-content>
            <mat-dialog-actions align="end">
                <button mat-button type="button" mat-dialog-close>Cancel</button>
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">Add</button>
            </mat-dialog-actions>
        </form>
    `,
})
export class AddStudentDialogComponent {
    private readonly courseId = inject<string>(MAT_DIALOG_DATA);
    private readonly api = inject(AcademyApiService);
    private readonly dialogRef = inject(MatDialogRef<AddStudentDialogComponent, Enrollment>);
    readonly saving = signal(false);
    readonly error = signal<string | null>(null);

    readonly form = inject(FormBuilder).nonNullable.group({
        firstName: ['', [Validators.required, Validators.maxLength(80)]],
        lastName: ['', Validators.maxLength(80)],
        email: ['', [Validators.required, Validators.email]],
        rollNumber: ['', [Validators.required, Validators.maxLength(32)]],
        section: ['', Validators.maxLength(40)],
        role: ['student' as 'student' | 'ta'],
    });

    submit(): void {
        const v = this.form.getRawValue();
        this.saving.set(true);
        this.error.set(null);
        this.api
            .addEnrollment(this.courseId, {
                ...v,
                email: v.email.trim().toLowerCase(),
                rollNumber: v.rollNumber.trim().toUpperCase(),
                section: v.section.trim() || undefined,
            })
            .subscribe({
                next: (enrollment) => this.dialogRef.close(enrollment),
                error: (err) => {
                    this.saving.set(false);
                    this.error.set(academyErrorMessage(err, 'The student was not added.'));
                },
            });
    }
}
