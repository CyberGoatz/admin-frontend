import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { LibraryMission } from '../../../academy/academy.model';

export interface MissionPickerData {
    moduleTitle: string;
    /** Definitions already in the course, shown as added. */
    existing: number[];
}

/** Picks missions from `GET /library/missions` for one module. */
@Component({
    selector: 'crczp-academy-mission-picker-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule],
    template: `
        <h2 mat-dialog-title>Add missions to {{ data.moduleTitle }}</h2>
        <mat-dialog-content>
            <mat-form-field class="search" subscriptSizing="dynamic">
                <mat-label>Search the library</mat-label>
                <input matInput [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Title or topic" />
            </mat-form-field>
            @if (error()) {
                <div class="academy-error">{{ error() }}</div>
            }
            <div class="academy-table-wrap">
                <table class="academy-table">
                    <thead>
                        <tr>
                            <th><span class="cdk-visually-hidden">Select</span></th>
                            <th>Mission</th>
                            <th>Topics</th>
                            <th class="num">Minutes</th>
                            <th class="num">Levels</th>
                        </tr>
                    </thead>
                    <tbody>
                        @for (mission of filtered(); track mission.trainingDefinitionId) {
                            <tr class="clickable" (click)="toggle(mission)">
                                <td>
                                    <mat-checkbox
                                        [checked]="isSelected(mission)"
                                        (click)="$event.stopPropagation()"
                                        (change)="toggle(mission)"
                                        [aria-label]="'Select ' + mission.title"
                                    />
                                </td>
                                <td>
                                    <strong>{{ mission.title }}</strong>
                                    @if (data.existing.includes(mission.trainingDefinitionId)) {
                                        <span class="pill pill-unchanged">In this course</span>
                                    }
                                    @if (mission.source === 'tenant') {
                                        <span class="pill">Your university</span>
                                    }
                                    <span class="secondary">{{ mission.description }}</span>
                                    @if (!mission.sandboxDefinitionId) {
                                        <span class="cell-error">No sandbox definition: cannot be published</span>
                                    }
                                </td>
                                <td>{{ mission.topics?.join(', ') }}</td>
                                <td class="num">{{ mission.estimatedDurationMinutes }}</td>
                                <td class="num">{{ mission.levels }}</td>
                            </tr>
                        } @empty {
                            <tr>
                                <td colspan="5" class="academy-muted">
                                    {{ loading() ? 'Loading the library' : 'No missions match.' }}
                                </td>
                            </tr>
                        }
                    </tbody>
                </table>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <span class="academy-muted academy-small">{{ selected().length }} selected</span>
            <button mat-button type="button" mat-dialog-close>Cancel</button>
            <button mat-flat-button color="primary" type="button" [disabled]="selected().length === 0" (click)="confirm()">
                Add {{ selected().length || '' }} {{ selected().length === 1 ? 'mission' : 'missions' }}
            </button>
        </mat-dialog-actions>
    `,
    styles: `
        .search {
            width: 100%;
            margin-bottom: 0.75rem;
        }
        .pill {
            margin-left: 0.5rem;
        }
        mat-dialog-actions span {
            margin-right: auto;
        }
    `,
})
export class MissionPickerDialogComponent {
    readonly data = inject<MissionPickerData>(MAT_DIALOG_DATA);
    readonly missions = signal<LibraryMission[]>([]);
    readonly selected = signal<LibraryMission[]>([]);
    readonly query = signal('');
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);

    readonly filtered = computed(() => {
        const q = this.query().trim().toLowerCase();
        return this.missions().filter(
            (m) =>
                !q ||
                m.title.toLowerCase().includes(q) ||
                (m.topics ?? []).some((t) => t.toLowerCase().includes(q)) ||
                (m.mitreTechniques ?? []).some((t) => t.toLowerCase().includes(q)),
        );
    });

    private readonly dialogRef = inject(MatDialogRef<MissionPickerDialogComponent, LibraryMission[]>);

    constructor() {
        inject(AcademyApiService)
            .libraryMissions()
            .subscribe({
                next: (missions) => {
                    this.missions.set(missions);
                    this.loading.set(false);
                },
                error: (err) => {
                    this.loading.set(false);
                    this.error.set(academyErrorMessage(err, 'The mission library could not be loaded.'));
                },
            });
    }

    isSelected(mission: LibraryMission): boolean {
        return this.selected().includes(mission);
    }

    toggle(mission: LibraryMission): void {
        this.selected.update((list) =>
            list.includes(mission) ? list.filter((m) => m !== mission) : [...list, mission],
        );
    }

    confirm(): void {
        this.dialogRef.close(this.selected());
    }
}
