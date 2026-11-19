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
import { RouterLink } from '@angular/router';
import { Routing } from '@crczp/routing-commons';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CyberGoatzCatalogApiService } from './cybergoatz-catalog-api.service';
import {
    CatalogItem,
    CatalogSource,
    CatalogSyncSummary,
} from './cybergoatz-catalog.model';
import {
    CatalogErrorView,
    CatalogStatusFilter,
    CatalogTypeFilter,
    REV_PATTERN,
    distinctCourses,
    filterCatalogItems,
    hasOlderVersions,
    isGithubHttpsUrl,
    isListed,
    levelLabel,
    libraryName,
    previousVersionsText,
    shortCommit,
    sortCatalogItems,
    sourceStatusLabel,
    statusLabel,
    summaryCounts,
    summarySentence,
    toCatalogError,
    truncate,
    typeLabel,
    usedCertifications,
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
        RouterLink,
        MatButtonModule,
        MatButtonToggleModule,
        MatIconModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatTableModule,
        MatTooltipModule,
    ],
})
export class CyberGoatzCatalogComponent {
    readonly columns = ['title', 'course', 'level', 'type', 'status', 'open'];

    readonly source = signal<CatalogSource | null>(null);
    readonly items = signal<CatalogItem[]>([]);
    /** Courses are taken from the unfiltered list so the filter keeps its options. */
    readonly courses = signal<{ id: string; title: string }[]>([]);
    readonly search = signal('');
    readonly courseFilter = signal('');
    readonly typeFilter = signal<CatalogTypeFilter>('');
    readonly statusFilter = signal<CatalogStatusFilter>('');
    readonly certificationFilter = signal('');
    /** Library details (repository, commits, run counts) under the library name. */
    readonly technical = signal(false);
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
    readonly summaryText = computed(() => {
        const summary = this.displayedSummary();
        return summary ? summarySentence(summary) : '';
    });
    readonly sourceStatus = computed(() =>
        sourceStatusLabel(this.source()?.lastSyncStatus ?? 'never'),
    );
    /** Certifications that at least one listed training is tagged with. */
    readonly certificationOptions = computed(() =>
        usedCertifications(
            this.source()?.certifications ?? [],
            this.listedItems(),
        ),
    );
    private readonly certificationsById = computed(
        () =>
            new Map(
                (this.source()?.certifications ?? []).map((c) => [c.id, c]),
            ),
    );
    readonly listedItems = computed(() =>
        this.items().filter((item) => isListed(item, false)),
    );
    readonly visibleItems = computed(() =>
        filterCatalogItems(
            this.items(),
            {
                search: this.search(),
                course: this.courseFilter(),
                type: this.typeFilter(),
                status: this.statusFilter(),
                certification: this.certificationFilter(),
            },
            false,
        ),
    );
    /** Same page sizes as the platform's other tables. */
    readonly pageSizeOptions = [5, 10, 25, 100];
    readonly pageSize = signal(10);
    readonly pageIndex = signal(0);
    readonly pagedItems = computed(() => {
        const items = this.visibleItems();
        const size = this.pageSize();
        const lastPage = Math.max(0, Math.ceil(items.length / size) - 1);
        const page = Math.min(this.pageIndex(), lastPage);
        return items.slice(page * size, page * size + size);
    });
    readonly stats = computed(() => {
        const listed = this.listedItems();
        return {
            total: listed.length,
            labs: listed.filter((item) => item.type === 'hands-on').length,
            quizzes: listed.filter((item) => item.type === 'mcq').length,
            attention: listed.filter((item) => item.state === 'failed').length,
        };
    });
    readonly hasFilters = computed(
        () =>
            !!this.search() ||
            !!this.courseFilter() ||
            !!this.typeFilter() ||
            !!this.statusFilter() ||
            !!this.certificationFilter(),
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
    protected readonly hasOlderVersions = hasOlderVersions;
    protected readonly previousVersionsText = previousVersionsText;
    protected readonly statusLabel = statusLabel;
    protected readonly typeLabel = typeLabel;
    protected readonly levelLabel = levelLabel;
    protected readonly libraryName = libraryName;

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
                        this.loadItems(source.id);
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
                    this.loadItems(saved.id);
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

    onSearch(value: string): void {
        this.search.set(value);
        this.pageIndex.set(0);
    }

    setCourseFilter(course: string): void {
        this.courseFilter.set(course);
        this.pageIndex.set(0);
    }

    setTypeFilter(type: CatalogTypeFilter): void {
        this.typeFilter.set(type);
        this.pageIndex.set(0);
    }

    setCertificationFilter(certification: string): void {
        this.certificationFilter.set(certification);
        this.pageIndex.set(0);
    }

    setStatusFilter(status: CatalogStatusFilter): void {
        this.statusFilter.set(status);
        this.pageIndex.set(0);
    }

    onPage(event: PageEvent): void {
        this.pageSize.set(event.pageSize);
        this.pageIndex.set(event.pageIndex);
    }

    clearFilters(): void {
        this.pageIndex.set(0);
        this.search.set('');
        this.courseFilter.set('');
        this.typeFilter.set('');
        this.statusFilter.set('');
        this.certificationFilter.set('');
    }

    setTechnical(on: boolean): void {
        this.technical.set(on);
    }

    instanceLink(item: CatalogItem): string | null {
        return item.trainingInstanceId
            ? Routing.RouteBuilder.linear_instance
                  .instanceId(Number(item.trainingInstanceId))
                  .detail.build()
            : null;
    }

    poolLink(item: CatalogItem): string | null {
        return item.type === 'hands-on' && item.poolId
            ? Routing.RouteBuilder.pool.poolId(Number(item.poolId)).build()
            : null;
    }

    isFailed(item: CatalogItem): boolean {
        return item.state === 'failed';
    }

    private reloadSourceAndItems(sourceId: string): void {
        this.api
            .getSource(sourceId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (source) => this.source.set(source),
                error: () => undefined,
            });
        this.loadItems(sourceId);
    }

    private loadItems(sourceId: string): void {
        this.api
            .getItems(sourceId, {})
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (items) => {
                    const sorted = sortCatalogItems(items);
                    this.items.set(sorted);
                    this.courses.set(
                        distinctCourses(
                            sorted.filter((item) => item.state !== 'not_built'),
                        ),
                    );
                },
                error: (error: unknown) =>
                    this.loadError.set(toCatalogError(error, 'load')),
            });
    }
}
