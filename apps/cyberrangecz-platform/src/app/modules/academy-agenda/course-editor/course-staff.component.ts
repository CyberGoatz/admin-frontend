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
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { Course, CourseStaffInput, Member } from '../../../academy/academy.model';
import { STAFF_ROLE_LABELS } from '../shared/academy-format';
import { TenantContextService } from '../../../academy/tenant-context.service';

/** Course staff (`POST/DELETE /courses/{id}/staff`). The owner cannot be removed here. */
@Component({
    selector: 'crczp-academy-course-staff',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule],
    template: `
        <section class="staff">
            <h3>Course staff</h3>
            <div class="academy-table-wrap">
                <table class="academy-table">
                    <tbody>
                        @for (s of course().staff; track s.memberId) {
                            <tr>
                                <td>{{ s.displayName }}</td>
                                <td>{{ staffLabels[s.role] }}</td>
                                <td class="actions">
                                    @if (!readonly() && s.role !== 'owner') {
                                        <button mat-button color="warn" type="button" [disabled]="busy()" (click)="remove(s.memberId)">Remove</button>
                                    }
                                </td>
                            </tr>
                        }
                    </tbody>
                </table>
            </div>
            @if (!readonly()) {
                @if (candidates().length) {
                    <div class="academy-toolbar">
                        <mat-form-field subscriptSizing="dynamic">
                            <mat-label>Add person</mat-label>
                            <mat-select [ngModel]="memberId()" (ngModelChange)="memberId.set($event)">
                                @for (m of candidates(); track m.id) {
                                    <mat-option [value]="m.id">{{ m.displayName }} ({{ m.role === 'ta' ? 'TA' : 'Professor' }})</mat-option>
                                }
                            </mat-select>
                        </mat-form-field>
                        <mat-form-field subscriptSizing="dynamic">
                            <mat-label>Course role</mat-label>
                            <mat-select [ngModel]="role()" (ngModelChange)="role.set($event)">
                                <mat-option value="instructor">Instructor</mat-option>
                                <mat-option value="ta">TA</mat-option>
                            </mat-select>
                        </mat-form-field>
                        <button mat-stroked-button type="button" [disabled]="!memberId() || busy()" (click)="add()">Add to course</button>
                    </div>
                } @else if (listUnavailable()) {
                    <p class="academy-muted academy-small">A tenant admin can add instructors and TAs to this course.</p>
                }
            }
        </section>
    `,
    styles: `
        .staff {
            display: grid;
            gap: 0.5rem;
            max-width: 56rem;
            padding-bottom: 1.25rem;
        }
        h3 {
            margin: 0;
            font-size: 1rem;
        }
    `,
})
export class CourseStaffComponent implements OnInit {
    readonly course = input.required<Course>();
    readonly readonly = input(false);
    readonly changed = output<void>();

    readonly staffLabels = STAFF_ROLE_LABELS;
    readonly people = signal<Member[]>([]);
    readonly listUnavailable = signal(false);
    readonly memberId = signal<string | null>(null);
    readonly role = signal<CourseStaffInput['role']>('instructor');
    readonly busy = signal(false);
    readonly candidates = computed(() => {
        const taken = new Set(this.course().staff.map((s) => s.memberId));
        return this.people().filter((m) => !taken.has(m.id) && m.status !== 'suspended');
    });

    private readonly api = inject(AcademyApiService);
    private readonly snack = inject(MatSnackBar);
    private readonly member = inject(TenantContextService).member;

    ngOnInit(): void {
        if (this.readonly()) {
            return;
        }
        // Only tenant admins may list staff members (professors get 403).
        if (this.member()?.role !== 'tenant_admin') {
            this.listUnavailable.set(true);
            return;
        }
        forkJoin([
            this.api.listMembers({ role: 'professor', size: 200 }, true),
            this.api.listMembers({ role: 'ta', size: 200 }, true),
        ]).subscribe({
            next: ([professors, tas]) => this.people.set([...professors.items, ...tas.items]),
            error: () => this.listUnavailable.set(true),
        });
    }

    add(): void {
        const memberId = this.memberId();
        if (!memberId) {
            return;
        }
        this.busy.set(true);
        this.api.addStaff(this.course().id, { memberId, role: this.role() }).subscribe({
            next: () => {
                this.busy.set(false);
                this.memberId.set(null);
                this.changed.emit();
            },
            error: (err) => {
                this.busy.set(false);
                this.snack.open(academyErrorMessage(err, 'The person was not added.'), 'Close');
            },
        });
    }

    remove(memberId: string): void {
        this.busy.set(true);
        this.api.removeStaff(this.course().id, memberId).subscribe({
            next: () => {
                this.busy.set(false);
                this.changed.emit();
            },
            error: (err) => {
                this.busy.set(false);
                this.snack.open(academyErrorMessage(err, 'The person was not removed.'), 'Close');
            },
        });
    }
}
