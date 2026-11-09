import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { Member, MemberRole } from '../../../academy/academy.model';
import { ROLE_LABELS } from '../shared/academy-format';

/** Invites a professor, TA or tenant admin (`POST /members`). */
@Component({
    selector: 'crczp-academy-invite-member-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
    ],
    template: `
        <h2 mat-dialog-title>Invite staff</h2>
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
                        <mat-hint>Leave blank for a single name</mat-hint>
                    </mat-form-field>
                    <mat-form-field class="full">
                        <mat-label>Email</mat-label>
                        <input matInput type="email" formControlName="email" required />
                        @if (form.controls.email.hasError('email')) {
                            <mat-error>Enter a valid email</mat-error>
                        }
                    </mat-form-field>
                    <mat-form-field>
                        <mat-label>Role</mat-label>
                        <mat-select formControlName="role">
                            @for (role of roles; track role) {
                                <mat-option [value]="role">{{ roleLabels[role] }}</mat-option>
                            }
                        </mat-select>
                    </mat-form-field>
                    <mat-form-field>
                        <mat-label>Department</mat-label>
                        <input matInput formControlName="department" />
                    </mat-form-field>
                    <mat-checkbox class="full" formControlName="sendInvite">
                        Send the invite email now
                    </mat-checkbox>
                </div>
                @if (error()) {
                    <div class="academy-error">{{ error() }}</div>
                }
            </mat-dialog-content>
            <mat-dialog-actions align="end">
                <button mat-button type="button" mat-dialog-close>Cancel</button>
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                    Invite
                </button>
            </mat-dialog-actions>
        </form>
    `,
})
export class InviteMemberDialogComponent {
    readonly roles: MemberRole[] = ['professor', 'ta', 'tenant_admin'];
    readonly roleLabels = ROLE_LABELS;
    readonly saving = signal(false);
    readonly error = signal<string | null>(null);

    private readonly api = inject(AcademyApiService);
    private readonly dialogRef = inject(MatDialogRef<InviteMemberDialogComponent, Member>);

    readonly form = inject(FormBuilder).nonNullable.group({
        firstName: ['', [Validators.required, Validators.maxLength(80)]],
        lastName: ['', Validators.maxLength(80)],
        email: ['', [Validators.required, Validators.email]],
        role: ['professor' as MemberRole, Validators.required],
        department: ['School of Computer Science and Engineering', Validators.maxLength(120)],
        sendInvite: [true],
    });

    submit(): void {
        if (this.form.invalid) {
            return;
        }
        this.saving.set(true);
        this.error.set(null);
        const value = this.form.getRawValue();
        this.api
            .inviteMember({
                ...value,
                email: value.email.trim().toLowerCase(),
                lastName: value.lastName.trim(),
            })
            .subscribe({
                next: (member) => this.dialogRef.close(member),
                error: (err) => {
                    this.saving.set(false);
                    this.error.set(
                        err?.status === 409
                            ? 'Someone in this university already uses that email.'
                            : academyErrorMessage(err, 'The invite could not be sent.'),
                    );
                },
            });
    }
}
