import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { LibraryMission } from '../../../academy/academy.model';
import { MissionCatalogComponent } from '../library/mission-catalog.component';

export interface MissionPickerData {
    moduleTitle: string;
    courseCode: string;
    courseTitle: string;
    /** Definitions already in the course, shown as added. */
    existing: number[];
}

/** Adds catalog missions to one module. */
@Component({
    selector: 'crczp-academy-mission-picker-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatDialogModule, MissionCatalogComponent],
    template: `
        <div class="picker">
            <header class="picker-head">
                <span class="picker-context">
                    {{ data.courseCode }} · {{ data.courseTitle }}
                </span>
                <h2 class="picker-title">
                    Add missions to {{ data.moduleTitle }}
                </h2>
            </header>
            <crczp-academy-mission-catalog
                class="picker-catalog"
                mode="pick"
                [moduleTitle]="data.moduleTitle"
                [courseTitle]="data.courseTitle"
                [existing]="data.existing"
                [(selected)]="selected"
            />
            <footer class="picker-foot">
                <span class="picker-summary">
                    @if (selected().length) {
                        <strong>{{ selected().length }} selected</strong>
                        · {{ minutes() }} min of lab work
                    } @else {
                        Pick missions with Add. You can set points, dates and
                        attempts after adding.
                    }
                </span>
                <button
                    mat-button
                    type="button"
                    mat-dialog-close
                >
                    Cancel
                </button>
                <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    [disabled]="selected().length === 0"
                    (click)="confirm()"
                >
                    {{
                        selected().length
                            ? 'Add ' +
                              selected().length +
                              (selected().length === 1
                                  ? ' mission'
                                  : ' missions')
                            : 'Add missions'
                    }}
                </button>
            </footer>
        </div>
    `,
    styles: `
        .picker {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr) auto;
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
            height: 100%;
            padding: 20px 24px 16px;
            box-sizing: border-box;
        }
        .picker-context {
            font-size: 12px;
            line-height: 16px;
            color: var(--text-subtle);
        }
        .picker-title {
            margin: 2px 0 0;
            font-size: 20px;
            line-height: 28px;
            font-weight: 600;
            letter-spacing: -0.01em;
            color: var(--text);
        }
        .picker-catalog {
            min-height: 0;
            min-width: 0;
        }
        @media (max-width: 600px) {
            .picker {
                padding: 16px 12px 12px;
            }
            .picker-title {
                font-size: 18px;
                line-height: 24px;
            }
        }
        .picker-foot {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
        }
        .picker-summary {
            margin-right: auto;
            font-size: 13px;
            color: var(--text-muted);
        }
        .picker-summary strong {
            color: var(--text);
            font-weight: 600;
        }
    `,
})
export class MissionPickerDialogComponent {
    readonly data = inject<MissionPickerData>(MAT_DIALOG_DATA);
    readonly selected = signal<LibraryMission[]>([]);
    readonly minutes = computed(() =>
        this.selected().reduce(
            (sum, m) => sum + (m.estimatedDurationMinutes ?? 0),
            0,
        ),
    );

    private readonly dialogRef = inject(
        MatDialogRef<MissionPickerDialogComponent, LibraryMission[]>,
    );

    confirm(): void {
        this.dialogRef.close(this.selected());
    }
}
