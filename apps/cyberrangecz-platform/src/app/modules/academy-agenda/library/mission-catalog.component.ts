import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    model,
    signal,
    untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
    academyErrorMessage,
    AcademyApiService,
} from '../../../academy/academy-api.service';
import {
    LibraryMission,
    MissionDifficulty,
    MissionSource,
    MissionWork,
} from '../../../academy/academy.model';
import {
    CatalogFilters,
    COURSE_TYPES,
    DIFFICULTY_LABELS,
    filterCount,
    hasFilters,
    matchesFilters,
    matchesQuery,
    NO_FILTERS,
    SOURCE_LABELS,
    suggest,
    usageLine,
    WORK_LABELS,
} from './mission-catalog';
import { MissionCoverComponent } from './mission-cover.component';
import { stackIcon } from './mission-stack';

interface FacetOption<T extends string> {
    value: T;
    label: string;
    count: number;
}

interface FacetGroup {
    key: keyof CatalogFilters;
    legend: string;
    options: FacetOption<string>[];
}

/**
 * The mission catalog: search, filters, a result list with lab covers, and a
 * detail pane. In pick mode each row has an Add toggle and suggestions are
 * ranked from the course and module titles.
 */
@Component({
    selector: 'crczp-academy-mission-catalog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgTemplateOutlet,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MissionCoverComponent,
    ],
    template: `
        <div
            class="catalog"
            [class.with-detail]="!!active()"
        >
            <div class="catalog-top">
                <mat-form-field
                    appearance="outline"
                    class="search"
                    subscriptSizing="dynamic"
                >
                    <mat-icon matPrefix>search</mat-icon>
                    <input
                        matInput
                        [ngModel]="query()"
                        (ngModelChange)="query.set($event)"
                        placeholder="Search by topic, tool or ATT&CK ID"
                        aria-label="Search the mission catalog"
                    />
                    @if (query()) {
                        <button
                            mat-icon-button
                            matSuffix
                            type="button"
                            aria-label="Clear search"
                            (click)="query.set('')"
                        >
                            <mat-icon>close</mat-icon>
                        </button>
                    }
                </mat-form-field>
                <button
                    mat-stroked-button
                    type="button"
                    class="filters-toggle"
                    (click)="showFilters.set(!showFilters())"
                    [attr.aria-expanded]="showFilters()"
                >
                    <mat-icon>tune</mat-icon>
                    Filters{{
                        activeFilters() ? ' (' + activeFilters() + ')' : ''
                    }}
                </button>
                <span class="count">
                    {{ results().length }} of {{ missions().length }} missions
                </span>
                <button
                    mat-stroked-button
                    type="button"
                    class="request"
                    (click)="requestMission()"
                >
                    <mat-icon>add_comment</mat-icon>
                    Request a mission
                </button>
            </div>

            <div class="catalog-body">
                <aside
                    class="facets"
                    [class.open]="showFilters()"
                    aria-label="Filter missions"
                >
                    @for (group of facetGroups(); track group.key) {
                        <fieldset>
                            <legend>{{ group.legend }}</legend>
                            @for (o of group.options; track o.value) {
                                <label
                                    class="facet"
                                    [class.off]="
                                        !o.count &&
                                        !isFiltered(group.key, o.value)
                                    "
                                >
                                    <input
                                        type="checkbox"
                                        [checked]="
                                            isFiltered(group.key, o.value)
                                        "
                                        (change)="
                                            toggleFilter(group.key, o.value)
                                        "
                                        [disabled]="
                                            !o.count &&
                                            !isFiltered(group.key, o.value)
                                        "
                                    />
                                    <span class="facet-label">
                                        {{ o.label }}
                                    </span>
                                    <span class="facet-count">
                                        {{ o.count }}
                                    </span>
                                </label>
                            }
                        </fieldset>
                    }
                    @if (activeFilters()) {
                        <button
                            mat-button
                            type="button"
                            class="clear"
                            (click)="filters.set(noFilters)"
                        >
                            Clear filters
                        </button>
                    }
                </aside>

                <div class="results">
                    @if (error()) {
                        <div class="academy-error">{{ error() }}</div>
                    }
                    @if (loading()) {
                        <div class="academy-skeleton">
                            <span></span>
                            <span></span>
                            <span></span>
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    } @else {
                        @if (suggestions().length) {
                            <h3 class="group">
                                Suggested for {{ suggestedFor() }}
                            </h3>
                            <div role="list">
                                @for (
                                    s of suggestions();
                                    track s.mission.trainingDefinitionId
                                ) {
                                    <ng-container
                                        *ngTemplateOutlet="
                                            row;
                                            context: {
                                                $implicit: s.mission,
                                                matched: s.matched,
                                            }
                                        "
                                    />
                                }
                            </div>
                            <h3 class="group">All missions</h3>
                        }
                        <div role="list">
                            @for (m of rest(); track m.trainingDefinitionId) {
                                <ng-container
                                    *ngTemplateOutlet="
                                        row;
                                        context: { $implicit: m, matched: [] }
                                    "
                                />
                            }
                        </div>
                        @if (!results().length) {
                            <div class="no-results">
                                <span class="empty-title">
                                    No missions match{{
                                        query()
                                            ? ' “' + query() + '”'
                                            : ' these filters'
                                    }}
                                </span>
                                <span>
                                    Try a broader word, clear the filters, or
                                    tell us what your course needs.
                                </span>
                                <div class="no-results-actions">
                                    @if (activeFilters()) {
                                        <button
                                            mat-stroked-button
                                            type="button"
                                            (click)="filters.set(noFilters)"
                                        >
                                            Clear filters
                                        </button>
                                    }
                                    <button
                                        mat-flat-button
                                        color="primary"
                                        type="button"
                                        (click)="requestMission()"
                                    >
                                        Request a mission
                                    </button>
                                </div>
                            </div>
                        } @else {
                            <p class="request-note">
                                Can't find a mission your course needs?
                                <button
                                    type="button"
                                    class="link"
                                    (click)="requestMission()"
                                >
                                    Request a mission
                                </button>
                            </p>
                        }
                    }
                </div>

                <section
                    class="detail"
                    aria-label="Mission details"
                >
                    @if (active(); as m) {
                        <button
                            mat-icon-button
                            type="button"
                            class="detail-close"
                            aria-label="Close details"
                            (click)="active.set(null)"
                        >
                            <mat-icon>close</mat-icon>
                        </button>
                        @if (m.lab?.length) {
                            <crczp-academy-mission-cover
                                class="detail-cover"
                                [mission]="m"
                            />
                        }
                        <span class="detail-source">{{ sourceLabel(m) }}</span>
                        <h3 class="detail-title">{{ m.title }}</h3>
                        <p class="detail-desc">{{ m.description }}</p>
                        @if (m.credit) {
                            <p class="credit">
                                {{ m.credit.text }}.
                                <a
                                    [href]="m.credit.url"
                                    target="_blank"
                                    rel="noopener"
                                >
                                    {{ m.credit.license }}
                                </a>
                            </p>
                        }
                        <dl class="facts">
                            @if (m.difficulty) {
                                <div>
                                    <dt>Difficulty</dt>
                                    <dd>{{ difficultyLabel(m.difficulty) }}</dd>
                                </div>
                            }
                            @if (m.work) {
                                <div>
                                    <dt>Students</dt>
                                    <dd>{{ workLabel(m.work) }}</dd>
                                </div>
                            }
                            <div>
                                <dt>Time</dt>
                                <dd>{{ m.estimatedDurationMinutes }} min</dd>
                            </div>
                            <div>
                                <dt>Levels</dt>
                                <dd>{{ m.levels }}</dd>
                            </div>
                        </dl>
                        @if (mode() === 'pick') {
                            @if (inCourse(m)) {
                                <button
                                    mat-stroked-button
                                    type="button"
                                    class="detail-add"
                                    disabled
                                >
                                    Already in this course
                                </button>
                            } @else {
                                <button
                                    mat-flat-button
                                    color="primary"
                                    type="button"
                                    class="detail-add"
                                    (click)="toggle(m)"
                                >
                                    <mat-icon>
                                        {{ isSelected(m) ? 'check' : 'add' }}
                                    </mat-icon>
                                    {{
                                        isSelected(m)
                                            ? 'Added to ' + moduleTitle()
                                            : 'Add to ' + moduleTitle()
                                    }}
                                </button>
                            }
                        }
                        @if (m.levelTitles?.length) {
                            <h4>Levels</h4>
                            <ol class="tasks">
                                @for (t of m.levelTitles; track $index) {
                                    <li>{{ t }}</li>
                                }
                            </ol>
                        }
                        @if (m.outcomes?.length) {
                            <h4>Students learn to</h4>
                            <ul class="bullets">
                                @for (t of m.outcomes; track $index) {
                                    <li>{{ t }}</li>
                                }
                            </ul>
                        }
                        @if (m.stack?.length) {
                            <h4>Tech stack</h4>
                            <ul class="stack">
                                @for (s of m.stack; track s) {
                                    <li>
                                        @if (icon(s); as src) {
                                            <span
                                                class="stack-icon"
                                                [style.mask-image]="
                                                    'url(' + src + ')'
                                                "
                                                [style.-webkit-mask-image]="
                                                    'url(' + src + ')'
                                                "
                                            ></span>
                                        }
                                        {{ s }}
                                    </li>
                                }
                            </ul>
                        }
                        @if (m.tools?.length) {
                            <h4>Commands students run</h4>
                            <p class="mono">{{ m.tools!.join('  ') }}</p>
                        }
                        <h4>Used at</h4>
                        @if (m.usage?.listedUniversities?.length) {
                            <ul class="unis">
                                @for (
                                    u of m.usage!.listedUniversities;
                                    track u.name
                                ) {
                                    <li>
                                        @if (u.markUrl) {
                                            <img
                                                [src]="u.markUrl"
                                                alt=""
                                            />
                                        }
                                        <span>{{ u.name }}</span>
                                    </li>
                                }
                            </ul>
                        }
                        <p class="academy-muted">{{ usage(m) }}</p>
                        @if (m.usage?.yourCourses?.length) {
                            <ul class="plain your-courses">
                                @for (c of m.usage!.yourCourses; track c.id) {
                                    <li>
                                        <span class="mono">{{ c.code }}</span>
                                        {{ c.title }}, {{ c.term }}
                                    </li>
                                }
                            </ul>
                        }
                        @if (m.courseTypes?.length) {
                            <h4>Fits courses in</h4>
                            <ul class="plain">
                                @for (t of m.courseTypes; track t) {
                                    <li>{{ t }}</li>
                                }
                            </ul>
                        }
                        @if (m.lab?.length) {
                            <h4>Lab range</h4>
                            <ul class="plain">
                                @for (h of hosts(m); track h.name) {
                                    <li>
                                        <span class="mono">{{ h.name }}</span>
                                        {{ h.os
                                        }}{{
                                            h.hidden
                                                ? ', hidden until found'
                                                : ''
                                        }}
                                    </li>
                                }
                            </ul>
                        }
                        @if (m.mitreTechniques?.length) {
                            <h4>ATT&amp;CK techniques</h4>
                            <ul class="plain">
                                @for (t of m.mitreTechniques; track t) {
                                    <li>
                                        <span class="mono">
                                            {{ t.split(' ')[0] }}
                                        </span>
                                        {{ t.slice(t.indexOf(' ') + 1) }}
                                    </li>
                                }
                            </ul>
                        }
                        <h4>Before this mission</h4>
                        <p>
                            {{
                                m.prerequisites?.length
                                    ? m.prerequisites!.join('. ') + '.'
                                    : 'No prerequisites listed.'
                            }}
                        </p>
                        @if (m.adaptiveVersion) {
                            <p class="academy-note note">
                                CyberRangeCZ also publishes an adaptive version
                                of this training. Courses use the linear
                                version.
                            </p>
                        }
                        @if (m.sourceUrl) {
                            <p class="source-link">
                                <a
                                    [href]="m.sourceUrl"
                                    target="_blank"
                                    rel="noopener"
                                >
                                    View the source repository
                                </a>
                            </p>
                        }
                    } @else {
                        <p class="detail-empty">
                            Select a mission to see its lab, levels, tech stack
                            and the courses it fits.
                        </p>
                    }
                </section>
            </div>
        </div>

        <ng-template
            #row
            let-m
            let-matched="matched"
        >
            <div
                class="row"
                role="listitem"
                [class.active]="active() === m"
                [class.picked]="isSelected(m)"
            >
                <button
                    type="button"
                    class="row-main"
                    (click)="active.set(m)"
                    [attr.aria-current]="active() === m"
                >
                    @if (m.lab?.length) {
                        <crczp-academy-mission-cover
                            class="row-cover"
                            [mission]="m"
                            [compact]="true"
                        />
                    }
                    <span class="row-text">
                        <span class="row-title">
                            {{ m.title }}
                            @if (inCourse(m)) {
                                <span class="pill pill-unchanged">
                                    In this course
                                </span>
                            }
                            @if (m.source === 'tenant') {
                                <span class="pill">Your university</span>
                            }
                        </span>
                        <span class="row-desc">{{ m.description }}</span>
                        <span class="row-meta">
                            @if (m.difficulty) {
                                {{ difficultyLabel(m.difficulty) }} ·
                            }
                            @if (m.work) {
                                {{ workLabel(m.work) }} ·
                            }
                            {{ m.estimatedDurationMinutes }} min ·
                            {{ m.levels }} levels
                            @if (m.catalogSource === 'cyberrangecz') {
                                · CyberRangeCZ library
                            }
                        </span>
                        @if (m.stack?.length) {
                            <span class="row-stack">
                                @for (s of m.stack!.slice(0, 5); track s) {
                                    <span class="stack-item">
                                        @if (icon(s); as src) {
                                            <span
                                                class="stack-icon"
                                                [style.mask-image]="
                                                    'url(' + src + ')'
                                                "
                                                [style.-webkit-mask-image]="
                                                    'url(' + src + ')'
                                                "
                                            ></span>
                                        }
                                        {{ s }}
                                    </span>
                                }
                            </span>
                        }
                        <span class="row-usage">
                            @for (
                                u of (m.usage?.listedUniversities ?? []).slice(
                                    0,
                                    4
                                );
                                track u.name
                            ) {
                                @if (u.markUrl) {
                                    <img
                                        [src]="u.markUrl"
                                        [alt]="u.name"
                                        [title]="u.name"
                                    />
                                }
                            }
                            {{ usage(m) }}
                        </span>
                        @if (matched.length) {
                            <span class="row-match">
                                {{
                                    suggestedBasis() === 'course'
                                        ? 'Fits'
                                        : 'Matches'
                                }}
                                {{ matched.join(', ') }}
                            </span>
                        }
                    </span>
                </button>
                @if (mode() === 'pick' && !inCourse(m)) {
                    <button
                        mat-stroked-button
                        type="button"
                        class="row-add"
                        [class.on]="isSelected(m)"
                        [attr.aria-pressed]="isSelected(m)"
                        [attr.aria-label]="
                            (isSelected(m) ? 'Remove ' : 'Add ') + m.title
                        "
                        (click)="toggle(m)"
                    >
                        <mat-icon>
                            {{ isSelected(m) ? 'check' : 'add' }}
                        </mat-icon>
                        {{ isSelected(m) ? 'Added' : 'Add' }}
                    </button>
                }
            </div>
        </ng-template>
    `,
    styleUrl: './mission-catalog.component.scss',
})
export class MissionCatalogComponent {
    readonly mode = input<'pick' | 'browse'>('browse');
    readonly moduleTitle = input('');
    readonly courseTitle = input('');
    /** Training definitions already in the course. */
    readonly existing = input<number[]>([]);
    readonly selected = model<LibraryMission[]>([]);

    readonly missions = signal<LibraryMission[]>([]);
    readonly query = signal('');
    readonly filters = signal<CatalogFilters>(NO_FILTERS);
    readonly active = signal<LibraryMission | null>(null);
    readonly showFilters = signal(false);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly noFilters = NO_FILTERS;

    readonly activeFilters = computed(() => filterCount(this.filters()));

    private readonly searched = computed(() =>
        this.missions().filter((m) => matchesQuery(m, this.query())),
    );

    readonly results = computed(() =>
        this.searched().filter((m) => matchesFilters(m, this.filters())),
    );

    /** Shown above the list only while nothing is searched or filtered. */
    private readonly suggested = computed(() => {
        if (
            this.mode() !== 'pick' ||
            this.query().trim() ||
            hasFilters(this.filters())
        ) {
            return { basis: 'module' as const, items: [] };
        }
        const open = this.missions().filter(
            (m) => !this.existing().includes(m.trainingDefinitionId),
        );
        return suggest(open, this.moduleTitle(), this.courseTitle());
    });
    readonly suggestions = computed(() => this.suggested().items);
    readonly suggestedBasis = computed(() => this.suggested().basis);
    /** The module title, or the course title when nothing matched the module. */
    readonly suggestedFor = computed(() =>
        this.suggested().basis === 'module'
            ? this.moduleTitle()
            : this.courseTitle(),
    );

    readonly rest = computed(() => {
        const shown = new Set(this.suggestions().map((s) => s.mission));
        return this.results().filter((m) => !shown.has(m));
    });

    readonly facetGroups = computed<FacetGroup[]>(() => [
        {
            key: 'courseTypes',
            legend: 'Course type',
            options: this.options(
                'courseTypes',
                COURSE_TYPES.map((t) => [t, t] as const),
                (m, v) => (m.courseTypes ?? []).includes(v),
            ),
        },
        {
            key: 'work',
            legend: 'Students',
            options: this.options(
                'work',
                Object.entries(WORK_LABELS) as [MissionWork, string][],
                (m, v) => m.work === v,
            ),
        },
        {
            key: 'difficulty',
            legend: 'Difficulty',
            options: this.options(
                'difficulty',
                Object.entries(DIFFICULTY_LABELS) as [
                    MissionDifficulty,
                    string,
                ][],
                (m, v) => m.difficulty === v,
            ),
        },
        {
            key: 'source',
            legend: 'Source',
            options: this.options(
                'source',
                Object.entries(SOURCE_LABELS) as [MissionSource, string][],
                (m, v) => m.catalogSource === v,
            ),
        },
    ]);

    private readonly snackBar = inject(MatSnackBar);

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
                    this.error.set(
                        academyErrorMessage(
                            err,
                            'The mission catalog could not be loaded.',
                        ),
                    );
                },
            });
        // On wide screens keep a mission open: the first suggestion or result,
        // and a new one when a search or filter hides the open mission.
        effect(() => {
            if (this.loading() || window.innerWidth < 1100) {
                return;
            }
            const active = untracked(this.active);
            if (active && this.results().includes(active)) {
                return;
            }
            this.active.set(
                this.suggestions()[0]?.mission ?? this.results()[0] ?? null,
            );
        });
    }

    difficultyLabel(d: MissionDifficulty): string {
        return DIFFICULTY_LABELS[d];
    }

    workLabel(w: MissionWork): string {
        return WORK_LABELS[w];
    }

    sourceLabel(m: LibraryMission): string {
        if (m.source === 'tenant') {
            return 'Your university';
        }
        return m.catalogSource
            ? SOURCE_LABELS[m.catalogSource]
            : 'Mission library';
    }

    usage(m: LibraryMission): string {
        return usageLine(m);
    }

    icon(name: string): string | null {
        return stackIcon(name);
    }

    hosts(m: LibraryMission) {
        return (m.lab ?? []).flatMap((n) => n.hosts);
    }

    inCourse(m: LibraryMission): boolean {
        return this.existing().includes(m.trainingDefinitionId);
    }

    isSelected(m: LibraryMission): boolean {
        return this.selected().includes(m);
    }

    toggle(m: LibraryMission): void {
        this.selected.update((list) =>
            list.includes(m) ? list.filter((x) => x !== m) : [...list, m],
        );
    }

    isFiltered(key: keyof CatalogFilters, value: string): boolean {
        return (this.filters()[key] as string[]).includes(value);
    }

    toggleFilter(key: keyof CatalogFilters, value: string): void {
        this.filters.update((f) => {
            const list = f[key] as string[];
            const next = list.includes(value)
                ? list.filter((v) => v !== value)
                : [...list, value];
            return { ...f, [key]: next };
        });
    }

    requestMission(): void {
        this.snackBar.open('Mission requests open in a coming release.', 'OK', {
            duration: 4000,
        });
    }

    /** Facet options with counts that respect the search and every other filter. */
    private options<T extends string>(
        key: keyof CatalogFilters,
        entries: readonly (readonly [T, string])[],
        has: (m: LibraryMission, value: T) => boolean,
    ): FacetOption<string>[] {
        const pool = this.searched().filter((m) =>
            matchesFilters(m, this.filters(), key),
        );
        return entries.map(([value, label]) => ({
            value,
            label,
            count: pool.filter((m) => has(m, value)).length,
        }));
    }
}
