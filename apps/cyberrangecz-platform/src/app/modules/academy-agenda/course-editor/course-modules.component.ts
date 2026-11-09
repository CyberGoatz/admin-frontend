import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    SentinelConfirmationDialogComponent,
    SentinelConfirmationDialogConfig,
    SentinelDialogResultEnum,
} from '@sentinel/components/dialogs';
import { concat, filter, Observable, toArray } from 'rxjs';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import {
    Course,
    CourseMission,
    CourseModule,
    HintPolicy,
    LibraryMission,
    MissionPatch,
    ModuleInput,
} from '../../../academy/academy.model';
import {
    fromDateTimeInput,
    HINT_POLICY_LABELS,
    label,
    toDateTimeInput,
} from '../shared/academy-format';
import { MissionPickerData, MissionPickerDialogComponent } from './mission-picker-dialog.component';

/** Modules and their library missions, with points, due dates, attempts and hint policy. */
@Component({
    selector: 'crczp-academy-course-modules',
    templateUrl: './course-modules.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTooltipModule],
    styles: `
        .tab-body {
            padding: 1.25rem 0;
            display: grid;
            gap: 1rem;
        }
        .module-head {
            display: grid;
            grid-template-columns: 2rem minmax(12rem, 1fr) 14rem 14rem auto;
            gap: 0.75rem;
            align-items: end;
            margin-bottom: 0.75rem;
        }
        .module-index {
            font-weight: 700;
            font-size: 1.125rem;
            padding-bottom: 0.375rem;
            color: var(--on-surface-variant);
        }
        .field-label {
            display: block;
            font-size: 0.75rem;
            color: var(--on-surface-variant);
            margin-bottom: 0.125rem;
        }
        .module-head input,
        .add-module input {
            font: inherit;
            width: 100%;
            box-sizing: border-box;
            padding: 0.375rem 0.5rem;
            border: 1px solid var(--outline-variant);
            border-radius: 4px;
            background: var(--surface-container-lowest);
            color: var(--on-surface);
        }
        .module-title {
            font-weight: 600;
        }
        .module-foot {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-top: 0.5rem;
        }
        .add-module {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            max-width: 32rem;
        }
        table.missions {
            table-layout: fixed;
        }
        .w-points,
        .w-attempts,
        .w-required {
            width: 72px;
        }
        .w-due {
            width: 190px;
        }
        .w-hints,
        .w-range,
        .w-actions {
            width: 120px;
        }
    `,
})
export class CourseModulesComponent {
    readonly course = input.required<Course>();
    readonly readonly = input(false);
    readonly changed = output<void>();

    readonly hintPolicies: HintPolicy[] = ['allowed', 'penalized', 'disabled'];
    readonly hintLabels = HINT_POLICY_LABELS;
    readonly label = label;
    readonly toDateTimeInput = toDateTimeInput;

    readonly busy = signal(false);
    readonly newModuleTitle = signal('');
    readonly isDraft = computed(() => this.course().status === 'draft');
    readonly totalPoints = computed(() =>
        this.course()
            .modules.flatMap((m) => m.missions)
            .reduce((sum, m) => sum + (m.points ?? 0), 0),
    );

    private readonly api = inject(AcademyApiService);
    private readonly dialog = inject(MatDialog);
    private readonly snack = inject(MatSnackBar);

    modulePoints(module: CourseModule): number {
        return module.missions.reduce((sum, m) => sum + (m.points ?? 0), 0);
    }

    addModule(): void {
        const title = this.newModuleTitle().trim();
        if (!title) {
            return;
        }
        this.run(
            this.api.addModule(this.course().id, { title, position: this.course().modules.length }),
            'Module added',
        );
        this.newModuleTitle.set('');
    }

    saveModule(module: CourseModule, patch: Partial<ModuleInput>): void {
        const key = Object.keys(patch)[0] as keyof ModuleInput;
        if (patch[key] === module[key as keyof CourseModule]) {
            return;
        }
        if (key === 'title' && !patch.title?.trim()) {
            this.changed.emit();
            return;
        }
        this.run(this.api.updateModule(this.course().id, module.id, patch));
    }

    saveModuleDate(module: CourseModule, field: 'unlocksAt' | 'dueAt', value: string): void {
        const iso = fromDateTimeInput(value);
        if (toDateTimeInput(iso) !== toDateTimeInput(module[field])) {
            this.run(this.api.updateModule(this.course().id, module.id, { [field]: iso }));
        }
    }

    moveModule(module: CourseModule, delta: number): void {
        this.run(this.api.updateModule(this.course().id, module.id, { position: module.position + delta }));
    }

    deleteModule(module: CourseModule): void {
        const message = module.missions.length
            ? `Delete module "${module.title}" and its ${module.missions.length} missions?`
            : `Delete module "${module.title}"?`;
        this.confirm('Delete module', message).subscribe(() =>
            this.run(this.api.deleteModule(this.course().id, module.id), 'Module deleted'),
        );
    }

    addMissions(module: CourseModule): void {
        const data: MissionPickerData = {
            moduleTitle: module.title,
            existing: this.course()
                .modules.flatMap((m) => m.missions)
                .map((m) => m.trainingDefinitionId),
        };
        this.dialog
            .open(MissionPickerDialogComponent, { data, width: '920px', maxWidth: '95vw', maxHeight: '90vh' })
            .afterClosed()
            .pipe(filter((picked?: LibraryMission[]) => !!picked?.length))
            .subscribe((picked: LibraryMission[]) => {
                const start = module.missions.length;
                const requests = picked.map((m, i) =>
                    this.api.addMission(this.course().id, module.id, {
                        trainingDefinitionId: m.trainingDefinitionId,
                        position: start + i,
                        points: 100,
                        attemptsAllowed: 1,
                        required: true,
                        hintPolicy: 'penalized',
                    }),
                );
                this.run(
                    concat(...requests).pipe(toArray()),
                    `${picked.length} ${picked.length === 1 ? 'mission' : 'missions'} added`,
                );
            });
    }

    saveMission(mission: CourseMission, patch: MissionPatch): void {
        this.run(this.api.updateMission(this.course().id, mission.id, patch));
    }

    saveMissionNumber(mission: CourseMission, field: 'points' | 'attemptsAllowed', raw: string): void {
        const min = field === 'points' ? 0 : 1;
        const value = Math.max(min, Math.round(Number(raw)));
        if (!Number.isFinite(value) || value === mission[field]) {
            return;
        }
        this.saveMission(mission, { [field]: value });
    }

    saveMissionDue(mission: CourseMission, raw: string): void {
        const iso = fromDateTimeInput(raw);
        if (toDateTimeInput(iso) !== toDateTimeInput(mission.dueAt)) {
            this.saveMission(mission, { dueAt: iso });
        }
    }

    moveMission(mission: CourseMission, delta: number): void {
        this.saveMission(mission, { position: (mission.position ?? 0) + delta });
    }

    removeMission(mission: CourseMission): void {
        const extra = this.isDraft() ? '' : ' Students lose access to it; existing runs keep their results.';
        this.confirm('Remove mission', `Remove "${mission.title}" from this course?${extra}`).subscribe(() =>
            this.run(this.api.deleteMission(this.course().id, mission.id), 'Mission removed'),
        );
    }

    private confirm(title: string, message: string): Observable<unknown> {
        return this.dialog
            .open(SentinelConfirmationDialogComponent, {
                data: new SentinelConfirmationDialogConfig(title, message, 'Cancel', 'Delete'),
            })
            .afterClosed()
            .pipe(filter((r) => r === SentinelDialogResultEnum.CONFIRMED));
    }

    private run(request: Observable<unknown>, message?: string): void {
        this.busy.set(true);
        request.subscribe({
            next: () => undefined,
            complete: () => {
                this.busy.set(false);
                if (message) {
                    this.snack.open(message, undefined, { duration: 2500 });
                }
                this.changed.emit();
            },
            error: (err) => {
                this.busy.set(false);
                this.snack.open(academyErrorMessage(err, 'The change was not saved.'), 'Close');
                this.changed.emit();
            },
        });
    }
}
