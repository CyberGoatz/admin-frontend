import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { toSignal } from '@angular/core/rxjs-interop';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { CourseRange, LabWindow } from '../../../academy/academy.model';
import { fromDateTimeInput, toDateTimeInput, WEEKDAYS } from '../shared/academy-format';

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

/** Range settings (`PUT /courses/{id}/range`): pool size, VM profile, idle timeout, lab windows. */
@Component({
    selector: 'crczp-academy-course-range-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
    template: `
        <form class="tab-body" [formGroup]="form" (ngSubmit)="save()">
            <div class="academy-form-grid">
                <mat-form-field>
                    <mat-label>Sandbox mode</mat-label>
                    <mat-select formControlName="mode">
                        <mat-option value="per_student">One sandbox per student</mat-option>
                        <mat-option value="shared_team">Shared by a team</mat-option>
                    </mat-select>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>VM size</mat-label>
                    <mat-select formControlName="vmSizeProfile">
                        <mat-option value="small">Small</mat-option>
                        <mat-option value="standard">Standard</mat-option>
                        <mat-option value="large">Large</mat-option>
                    </mat-select>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Idle timeout (minutes)</mat-label>
                    <input matInput type="number" min="10" formControlName="idleTimeoutMinutes" />
                    <mat-hint>Sandboxes idle this long are reclaimed</mat-hint>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Max concurrent sandboxes</mat-label>
                    <input matInput type="number" min="1" formControlName="maxConcurrent" placeholder="All enrolled" />
                    <mat-hint>Blank: one for each enrolled student</mat-hint>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Spare sandboxes</mat-label>
                    <input matInput type="number" min="0" formControlName="poolBuffer" />
                    <mat-hint>Kept ready on top of the demand</mat-hint>
                </mat-form-field>
                <mat-form-field>
                    <mat-label>Tear down after</mat-label>
                    <input matInput type="datetime-local" formControlName="teardownAt" />
                    <mat-hint>Blank: at the course end</mat-hint>
                </mat-form-field>
            </div>

            <div class="academy-note academy-small">
                Pool size per mission at publish: {{ poolSize() }} sandboxes
                ({{ demandLabel() }} plus {{ form.controls.poolBuffer.value || 0 }} spare).
            </div>

            <section>
                <h3>Lab windows</h3>
                <p class="academy-muted academy-small">
                    Pools are prepared before each window and scaled down after it. Leave empty to keep pools running for the whole course.
                </p>
                <div formArrayName="labWindows" class="windows">
                    @for (row of windows.controls; track row; let i = $index) {
                        <div class="window-row" [formGroupName]="i">
                            <mat-form-field subscriptSizing="dynamic">
                                <mat-label>Day</mat-label>
                                <mat-select formControlName="weekday">
                                    @for (day of weekdays; track day; let d = $index) {
                                        <mat-option [value]="d">{{ day }}</mat-option>
                                    }
                                </mat-select>
                            </mat-form-field>
                            <mat-form-field subscriptSizing="dynamic">
                                <mat-label>From</mat-label>
                                <input matInput type="time" formControlName="start" />
                            </mat-form-field>
                            <mat-form-field subscriptSizing="dynamic">
                                <mat-label>To</mat-label>
                                <input matInput type="time" formControlName="end" />
                            </mat-form-field>
                            <mat-form-field subscriptSizing="dynamic">
                                <mat-label>Time zone</mat-label>
                                <input matInput formControlName="timezone" />
                            </mat-form-field>
                            @if (!readonly()) {
                                <button mat-icon-button type="button" (click)="removeWindow(i)" aria-label="Remove lab window">
                                    <mat-icon>close</mat-icon>
                                </button>
                            }
                        </div>
                    }
                </div>
                @if (!readonly()) {
                    <button mat-stroked-button type="button" (click)="addWindow()">
                        <mat-icon>add</mat-icon>
                        Add lab window
                    </button>
                }
            </section>

            @if (error()) {
                <div class="academy-error">{{ error() }}</div>
            }
            @if (!readonly()) {
                <div class="form-actions">
                    <button mat-button type="button" [disabled]="form.pristine" (click)="reset()">Discard changes</button>
                    <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || form.pristine || saving()">
                        Save range settings
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
        h3 {
            margin: 0 0 0.25rem;
            font-size: 1rem;
        }
        .windows {
            display: grid;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
        }
        .window-row {
            display: grid;
            grid-template-columns: 10rem 8rem 8rem 1fr auto;
            gap: 0.5rem;
            align-items: center;
        }
        .form-actions {
            display: flex;
            gap: 0.5rem;
            justify-content: flex-end;
        }
    `,
})
export class CourseRangeFormComponent {
    readonly courseId = input.required<string>();
    readonly range = input.required<CourseRange>();
    readonly enrolledCount = input(0);
    readonly readonly = input(false);
    readonly saved = output<CourseRange>();

    readonly weekdays = WEEKDAYS;
    readonly saving = signal(false);
    readonly error = signal<string | null>(null);

    private readonly fb = inject(FormBuilder).nonNullable;
    private readonly api = inject(AcademyApiService);
    private readonly snack = inject(MatSnackBar);

    readonly form = this.fb.group({
        mode: ['per_student' as CourseRange['mode']],
        vmSizeProfile: ['standard' as CourseRange['vmSizeProfile']],
        idleTimeoutMinutes: [60, [Validators.required, Validators.min(10)]],
        maxConcurrent: [null as number | null, Validators.min(1)],
        poolBuffer: [3, [Validators.required, Validators.min(0)]],
        teardownAt: [''],
        labWindows: new FormArray<FormGroup>([]),
    });

    get windows(): FormArray<FormGroup> {
        return this.form.controls.labWindows;
    }

    private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
    readonly poolSize = computed(() => {
        const v = this.value();
        return (v.maxConcurrent || this.enrolledCount()) + (Number(v.poolBuffer) || 0);
    });
    readonly demandLabel = computed(() =>
        this.value().maxConcurrent
            ? `${this.value().maxConcurrent} concurrent`
            : `${this.enrolledCount()} enrolled`,
    );

    constructor() {
        effect(() => {
            this.range();
            this.reset();
            if (this.readonly()) {
                this.form.disable({ emitEvent: false });
            } else {
                this.form.enable({ emitEvent: false });
            }
        });
    }

    reset(): void {
        const r = this.range();
        this.windows.clear({ emitEvent: false });
        (r.labWindows ?? []).forEach((w) => this.windows.push(this.windowGroup(w), { emitEvent: false }));
        this.form.reset({
            mode: r.mode,
            vmSizeProfile: r.vmSizeProfile,
            idleTimeoutMinutes: r.idleTimeoutMinutes,
            maxConcurrent: r.maxConcurrent ?? null,
            poolBuffer: r.poolBuffer,
            teardownAt: toDateTimeInput(r.teardownAt),
        });
        this.error.set(null);
    }

    addWindow(): void {
        this.windows.push(this.windowGroup({ weekday: 1, start: '14:00', end: '16:00', timezone: DEFAULT_TIMEZONE }));
        this.form.markAsDirty();
    }

    removeWindow(index: number): void {
        this.windows.removeAt(index);
        this.form.markAsDirty();
    }

    save(): void {
        const v = this.form.getRawValue();
        const range: CourseRange = {
            mode: v.mode,
            vmSizeProfile: v.vmSizeProfile,
            idleTimeoutMinutes: Number(v.idleTimeoutMinutes),
            maxConcurrent: v.maxConcurrent ? Number(v.maxConcurrent) : null,
            poolBuffer: Number(v.poolBuffer),
            teardownAt: fromDateTimeInput(v.teardownAt),
            labWindows: (v.labWindows as LabWindow[]).map((w) => ({
                weekday: Number(w.weekday),
                start: w.start,
                end: w.end,
                timezone: w.timezone || undefined,
            })),
        };
        this.saving.set(true);
        this.api.updateRange(this.courseId(), range).subscribe({
            next: (saved) => {
                this.saving.set(false);
                this.form.markAsPristine();
                this.snack.open('Range settings saved', undefined, { duration: 2500 });
                this.saved.emit(saved);
            },
            error: (err) => {
                this.saving.set(false);
                this.error.set(academyErrorMessage(err, 'The range settings were not saved.'));
            },
        });
    }

    private windowGroup(w: LabWindow): FormGroup {
        return this.fb.group(
            {
                weekday: [w.weekday, Validators.required],
                start: [w.start, [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)]],
                end: [w.end, [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)]],
                timezone: [w.timezone ?? DEFAULT_TIMEZONE],
            },
            {
                validators: (g) => (g.get('end')?.value <= g.get('start')?.value ? { order: true } : null),
            },
        );
    }
}
