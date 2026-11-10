import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { LibraryMission } from '../../../academy/academy.model';

/** Missions a professor can place in a course (`GET /library/missions`). */
@Component({
    selector: 'crczp-academy-mission-library',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, MatFormFieldModule, MatInputModule],
    template: `
        <div class="academy-page">
            <header class="academy-header">
                <div class="academy-header-text">
                    <h1 class="academy-title">Mission library</h1>
                    <p class="academy-description">Hands-on missions you can place in a course. Each runs in its own sandbox.</p>
                </div>
            </header>
            <div class="academy-toolbar">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Search</mat-label>
                    <input matInput [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Title, topic or ATT&CK technique" />
                </mat-form-field>
                <span class="academy-subtle academy-small">{{ filtered().length }} of {{ missions().length }} missions</span>
            </div>
            @if (error()) {
                <div class="academy-error">{{ error() }}</div>
            }
            <div class="academy-table-wrap">
                <table class="academy-table academy-table-stack">
                    <thead>
                        <tr>
                            <th>Mission</th>
                            <th>Topics</th>
                            <th>ATT&amp;CK</th>
                            <th class="num">Minutes</th>
                            <th class="num">Levels</th>
                            <th class="num">Max score</th>
                            <th>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        @for (m of filtered(); track m.trainingDefinitionId) {
                            <tr>
                                <td class="primary">
                                    <span class="title">{{ m.title }}</span>
                                    <span class="secondary">{{ m.description }}</span>
                                </td>
                                <td data-label="Topics">{{ m.topics?.join(', ') || '—' }}</td>
                                <td class="mono academy-small" data-label="ATT&CK">{{ m.mitreTechniques?.join(', ') || '—' }}</td>
                                <td class="num" data-label="Minutes">{{ m.estimatedDurationMinutes }}</td>
                                <td class="num" data-label="Levels">{{ m.levels }}</td>
                                <td class="num mono" data-label="Max score">{{ m.maxScore }}</td>
                                <td data-label="Source">{{ m.source === 'tenant' ? 'Your university' : 'CyberGoatz library' }}</td>
                            </tr>
                        } @empty {
                            <tr>
                                <td colspan="7">
                                    @if (loading()) {
                                        <div class="academy-skeleton"><span></span><span></span><span></span></div>
                                    } @else {
                                        <span class="academy-muted">No missions match this search.</span>
                                    }
                                </td>
                            </tr>
                        }
                    </tbody>
                </table>
            </div>
        </div>
    `,
    styles: `
        .title {
            display: block;
            font-weight: 500;
        }
    `,
})
export class MissionLibraryComponent {
    readonly missions = signal<LibraryMission[]>([]);
    readonly query = signal('');
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly filtered = computed(() => {
        const q = this.query().trim().toLowerCase();
        return this.missions().filter(
            (m) =>
                !q ||
                [m.title, ...(m.topics ?? []), ...(m.mitreTechniques ?? [])].some((v) =>
                    v.toLowerCase().includes(q),
                ),
        );
    });

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
}
