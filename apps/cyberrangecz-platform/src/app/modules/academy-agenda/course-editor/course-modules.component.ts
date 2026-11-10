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
            min-width: 0;
        }
        .module-card {
            container-type: inline-size;
            min-width: 0;
        }
        .module-head {
            display: grid;
            grid-template-columns: 2rem minmax(10rem, 1fr) 14.5rem 14.5rem auto;
            gap: 0.75rem;
            align-items: end;
            margin-bottom: 0.75rem;
        }
        .module-index {
            font-family: var(--font-mono);
            font-weight: 500;
            font-size: 16px;
            padding-bottom: 10px;
            color: var(--text-muted);
        }
        .field-label {
            display: block;
            font-size: 13px;
            line-height: 18px;
            font-weight: 500;
            color: var(--text);
            margin-bottom: 4px;
        }
        .module-head input,
        .add-module input {
            font: inherit;
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            height: 40px;
            padding: 0 12px;
            border: 1px solid var(--border);
            border-radius: var(--radius-control);
            background: var(--surface);
            color: var(--text);
        }
        .module-head input:focus,
        .add-module input:focus {
            outline: 2px solid var(--brand-accent);
            outline-offset: 2px;
            border-color: var(--brand);
        }
        .module-title {
            font-weight: 600;
        }
        .module-foot {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.5rem 1rem;
            margin-top: 0.5rem;
        }
        .add-module {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            max-width: 32rem;
        }
        .range-state {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.375rem;
            margin-top: 0.25rem;
        }
        table.missions {
            table-layout: fixed;
        }
        /* Cells are border-box, so these widths include 12px side padding. */
        table.missions th,
        table.missions td {
            padding-left: 12px;
            padding-right: 12px;
        }
        .w-points,
        .w-attempts,
        .w-required {
            width: 96px;
        }
        .w-due {
            width: 220px;
        }
        .w-hints {
            width: 150px;
        }
        .w-actions {
            width: 136px;
        }
        /* Narrow cards: dates under the title, and each mission as a block of labeled fields. */
        @container (max-width: 860px) {
            .module-head {
                grid-template-columns: 2rem minmax(0, 1fr) minmax(0, 1fr);
            }
            .module-head > label:first-of-type {
                grid-column: 2 / -1;
            }
            .module-head > label:nth-of-type(2) {
                grid-column: 2;
            }
            .module-head > span:last-child {
                grid-column: 1 / -1;
                justify-self: end;
            }
            table.missions,
            table.missions tbody,
            table.missions tr,
            table.missions td {
                display: block;
                width: auto;
            }
            table.missions thead {
                display: none;
            }
            table.missions tr {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
                gap: 0.5rem 0.75rem;
                padding: 0.75rem;
                border-bottom: 1px solid var(--border);
            }
            table.missions tr:last-child {
                border-bottom: none;
            }
            table.missions td {
                border: none;
                padding: 0;
                text-align: left;
            }
            table.missions td[data-label]::before {
                content: attr(data-label);
                display: block;
                font-size: 0.75rem;
                color: var(--text-muted);
                margin-bottom: 0.125rem;
            }
            table.missions input.inline-input,
            table.missions select.inline-input {
                min-width: 0;
            }
            table.missions td.mission-cell,
            table.missions td.actions {
                grid-column: 1 / -1;
            }
            table.missions td.actions {
                text-align: right;
            }
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

    /**
     * Swaps a module with its neighbour. The server does not shift siblings,
     * so both modules get an explicit position.
     */
    moveModule(module: CourseModule, delta: number): void {
        const list = this.course().modules;
        const from = list.indexOf(module);
        const other = list[from + delta];
        if (!other) {
            return;
        }
        const courseId = this.course().id;
        this.run(
            concat(
                this.api.updateModule(courseId, module.id, { position: from + delta }),
                this.api.updateModule(courseId, other.id, { position: from }),
            ).pipe(toArray()),
        );
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

    /** Swaps a mission with its neighbour, sending both positions explicitly. */
    moveMission(module: CourseModule, mission: CourseMission, delta: number): void {
        const from = module.missions.indexOf(mission);
        const other = module.missions[from + delta];
        if (!other) {
            return;
        }
        const courseId = this.course().id;
        this.run(
            concat(
                this.api.updateMission(courseId, mission.id, { position: from + delta }),
                this.api.updateMission(courseId, other.id, { position: from }),
            ).pipe(toArray()),
        );
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
