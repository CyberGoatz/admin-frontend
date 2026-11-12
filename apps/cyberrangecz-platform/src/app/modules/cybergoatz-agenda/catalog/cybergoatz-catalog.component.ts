import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    computed,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    FormBuilder,
    ReactiveFormsModule,
    ValidatorFn,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CyberGoatzCatalogApiService } from './cybergoatz-catalog-api.service';
import {
    CATALOG_ITEM_STATES,
    CatalogItem,
    CatalogItemState,
    CatalogSource,
    CatalogSyncSummary,
} from './cybergoatz-catalog.model';
import {
    CatalogErrorView,
    REV_PATTERN,
    distinctCourses,
    isGithubHttpsUrl,
    shortCommit,
    sortCatalogItems,
    summaryCounts,
    toCatalogError,
    tracksCreated,
    truncate,
} from './cybergoatz-catalog.utils';

const githubUrlValidator: ValidatorFn = (control) =>
    !control.value || isGithubHttpsUrl(String(control.value))
        ? null
        : { githubUrl: true };

@Component({
    selector: 'crczp-cybergoatz-catalog',
    templateUrl: './cybergoatz-catalog.component.html',
    styleUrls: ['./cybergoatz-catalog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatTableModule,
        MatTooltipModule,
    ],
})
export class CyberGoatzCatalogComponent {
    readonly states = CATALOG_ITEM_STATES;
    readonly columns = [
        'catalogId',
        'title',
        'course',
        'unit',
        'difficulty',
        'type',
        'state',
        'trainingDefinitionId',
        'sandboxDefinitionId',
        'path',
        'lastError',
    ];

    readonly source = signal<CatalogSource | null>(null);
    readonly items = signal<CatalogItem[]>([]);
    /** Courses are taken from the unfiltered list so the filter keeps its options. */
    readonly courses = signal<{ id: string; title: string }[]>([]);
    readonly stateFilter = signal<CatalogItemState | ''>('');
    readonly courseFilter = signal('');
    readonly isLoading = signal(true);
    readonly isSaving = signal(false);
    readonly isRefreshing = signal(false);
    readonly isEditing = signal(false);
    readonly loadError = signal<CatalogErrorView | null>(null);
    readonly saveError = signal<CatalogErrorView | null>(null);
    readonly refreshError = signal<CatalogErrorView | null>(null);
    /** Summary of the refresh just performed in this session, if any. */
    readonly refreshResult = signal<CatalogSyncSummary | null>(null);

    readonly showForm = computed(() => !this.source() || this.isEditing());
    readonly displayedSummary = computed(
        () => this.refreshResult() ?? this.source()?.lastSyncSummary ?? null,
    );
    readonly summaryCounts = computed(() => {
        const summary = this.displayedSummary();
        return summary ? summaryCounts(summary) : [];
    });
    readonly createdTracks = computed(() => {
        const summary = this.displayedSummary();
        return summary ? tracksCreated(summary) : [];
    });
    readonly createdTrackSlugs = computed(() =>
        this.createdTracks()
            .map((track) => track.slug)
            .join(', '),
    );
    readonly failedTracks = computed(
        () =>
            this.displayedSummary()?.tracks.filter(
                (track) => track.outcome === 'failed',
            ) ?? [],
    );

    readonly form = inject(FormBuilder).nonNullable.group({
        repoUrl: [
            '',
            [
                Validators.required,
                Validators.maxLength(512),
                githubUrlValidator,
            ],
        ],
        rev: [
            'main',
            [
                Validators.required,
                Validators.maxLength(255),
                Validators.pattern(REV_PATTERN),
            ],
        ],
    });

    protected readonly shortCommit = shortCommit;
    protected readonly truncate = truncate;

    private readonly api = inject(CyberGoatzCatalogApiService);
    private readonly destroyRef = inject(DestroyRef);

    constructor() {
        this.load();
    }

    load(): void {
        this.isLoading.set(true);
        this.loadError.set(null);
        this.api
            .getSources()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (sources) => {
                    const source = sources[0] ?? null;
                    this.source.set(source);
                    this.isLoading.set(false);
                    if (source) {
                        this.loadItems(source.id, true);
                    }
                },
                error: (error: unknown) => {
                    this.loadError.set(toCatalogError(error, 'load'));
                    this.isLoading.set(false);
                },
            });
    }

    startEdit(): void {
        const source = this.source();
        if (!source) {
            return;
        }
        this.form.reset({ repoUrl: source.repoUrl, rev: source.rev });
        this.saveError.set(null);
        this.isEditing.set(true);
    }

    cancelEdit(): void {
        this.isEditing.set(false);
        this.saveError.set(null);
    }

    saveSource(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const value = this.form.getRawValue();
        const payload = {
            repoUrl: value.repoUrl.trim(),
            rev: value.rev.trim(),
        };
        const source = this.source();
        this.isSaving.set(true);
        this.saveError.set(null);
        (source
            ? this.api.updateSource(source.id, payload)
            : this.api.createSource(payload)
        )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (saved) => {
                    this.source.set(saved);
                    this.isSaving.set(false);
                    this.isEditing.set(false);
                    this.loadItems(saved.id, true);
                },
                error: (error: unknown) => {
                    this.saveError.set(toCatalogError(error, 'save'));
                    this.isSaving.set(false);
                },
            });
    }

    refresh(): void {
        const source = this.source();
        if (!source || this.isRefreshing()) {
            return;
        }
        this.isRefreshing.set(true);
        this.refreshError.set(null);
        this.refreshResult.set(null);
        this.api
            .refresh(source.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (summary) => {
                    this.refreshResult.set(summary);
                    this.isRefreshing.set(false);
                    this.reloadSourceAndItems(source.id);
                },
                error: (error: unknown) => {
                    this.refreshError.set(toCatalogError(error, 'refresh'));
                    this.isRefreshing.set(false);
                    // A failed run still records its status on the source.
                    this.reloadSourceAndItems(source.id);
                },
            });
    }

    onStateFilter(state: CatalogItemState | ''): void {
        this.stateFilter.set(state);
        this.reloadItems();
    }

    onCourseFilter(course: string): void {
        this.courseFilter.set(course);
        this.reloadItems();
    }

    isFailed(item: CatalogItem): boolean {
        return item.state === 'failed';
    }

    private reloadItems(): void {
        const source = this.source();
        if (source) {
            this.loadItems(source.id, false);
        }
    }

    private reloadSourceAndItems(sourceId: string): void {
        this.api
            .getSource(sourceId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (source) => this.source.set(source),
                error: () => undefined,
            });
        this.loadItems(sourceId, true);
    }

    private loadItems(sourceId: string, updateCourses: boolean): void {
        const state = this.stateFilter();
        const course = this.courseFilter();
        this.api
            .getItems(sourceId, {
                state: state || undefined,
                course: course || undefined,
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (items) => {
                    this.items.set(sortCatalogItems(items));
                    if (updateCourses && !state && !course) {
                        this.courses.set(distinctCourses(items));
                    }
                },
                error: (error: unknown) =>
                    this.loadError.set(toCatalogError(error, 'load')),
            });
    }
}
