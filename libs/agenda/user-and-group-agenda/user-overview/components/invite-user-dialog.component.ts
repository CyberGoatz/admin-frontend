import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface InviteUserDialogResult {
    email: string;
    givenName: string;
    familyName: string;
    fullName?: string;
}

@Component({
    selector: 'crczp-invite-user-dialog',
    templateUrl: './invite-user-dialog.component.html',
    styleUrls: ['./invite-user-dialog.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
    ],
})
export class InviteUserDialogComponent {
    private readonly dialogRef = inject<
        MatDialogRef<InviteUserDialogComponent, InviteUserDialogResult>
    >(MatDialogRef);
    private readonly formBuilder = inject(FormBuilder);

    readonly form = this.formBuilder.nonNullable.group({
        email: ['', [Validators.required, Validators.email]],
        givenName: ['', [Validators.required, Validators.maxLength(120)]],
        familyName: ['', [Validators.required, Validators.maxLength(120)]],
        fullName: ['', [Validators.maxLength(240)]],
    });

    cancel(): void {
        this.dialogRef.close();
    }

    invite(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const value = this.form.getRawValue();
        const fullName = value.fullName.trim();
        this.dialogRef.close({
            email: value.email.trim(),
            givenName: value.givenName.trim(),
            familyName: value.familyName.trim(),
            ...(fullName ? { fullName } : {}),
        });
    }
}
