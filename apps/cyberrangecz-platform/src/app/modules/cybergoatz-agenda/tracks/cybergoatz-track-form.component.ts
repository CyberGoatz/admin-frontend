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
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { createInfinitePaginationEvent } from '@crczp/api-common';
import {
    LinearTrainingInstanceApi,
    TrainingInstanceSort,
} from '@crczp/training-api';
import { TrainingInstance } from '@crczp/training-model';
import { forkJoin, of, switchMap } from 'rxjs';
import { CyberGoatzTrackApiService } from './cybergoatz-track-api.service';
import {
    CyberGoatzTrack,
    CyberGoatzTrackItem,
    CyberGoatzTrackItemsPayload,
    CyberGoatzTrackPayload,
} from './cybergoatz-track.model';

interface EditableTrackItem {
    published: boolean;
    titleOverride: string | null;
    trainingInstanceId: string;
}

@Component({
    selector: 'crczp-cybergoatz-track-form',
    templateUrl: './cybergoatz-track-form.component.html',
    styleUrls: ['./cybergoatz-track-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSelectModule,
    ],
})
export class CyberGoatzTrackFormComponent {
    readonly trainingInstances = signal<TrainingInstance[]>([]);
    readonly selectedItems = signal<EditableTrackItem[]>([]);
    readonly isLoading = signal(true);
    readonly isSaving = signal(false);
    readonly error = signal<string | null>(null);
    readonly trackId = signal<string | null>(null);

    readonly form = inject(FormBuilder).nonNullable.group({
        slug: ['', [Validators.required, Validators.maxLength(80)]],
        title: ['', [Validators.required, Validators.maxLength(160)]],
        description: ['', [Validators.maxLength(2000)]],
        bannerImageUrl: ['', [Validators.maxLength(2048)]],
        displayOrder: [0, [Validators.min(0)]],
        published: [false],
        trainingInstanceIds: [[] as string[]],
    });

    readonly title = computed(() =>
        this.trackId() ? 'Edit track' : 'Create track',
    );

    readonly totalEstimatedDuration = computed(() =>
        this.selectedItems().reduce(
            (total, item) =>
                total +
                (this.findTrainingInstance(item.trainingInstanceId)
                    ?.trainingDefinition?.estimatedDuration ?? 0),
            0,
        ),
    );

    private readonly trackApi = inject(CyberGoatzTrackApiService);
    private readonly trainingInstanceApi = inject(LinearTrainingInstanceApi);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    constructor() {
        this.trackId.set(this.route.snapshot.paramMap.get('trackId'));
        this.load();
    }

    load(): void {
        this.isLoading.set(true);
        this.error.set(null);

        const trackId = this.trackId();
        forkJoin({
            track: trackId ? this.trackApi.get(trackId) : of(null),
            instances: this.trainingInstanceApi.getAll(
                createInfinitePaginationEvent<TrainingInstanceSort>('title'),
            ),
        })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: ({ track, instances }) => {
                    this.trainingInstances.set(instances.elements);
                    if (track) {
                        this.setTrack(track);
                    }
                    this.isLoading.set(false);
                },
                error: () => {
                    this.error.set('Unable to load track details.');
                    this.isLoading.set(false);
                },
            });
    }

    syncSelectedTrainingInstances(trainingInstanceIds: string[]): void {
        const currentItems = new Map(
            this.selectedItems().map((item) => [item.trainingInstanceId, item]),
        );
        this.selectedItems.set(
            trainingInstanceIds.map(
                (trainingInstanceId) =>
                    currentItems.get(trainingInstanceId) ?? {
                        trainingInstanceId,
                        published: true,
                        titleOverride: null,
                    },
            ),
        );
    }

    updateTitleOverride(trainingInstanceId: string, value: string): void {
        this.selectedItems.update((items) =>
            items.map((item) =>
                item.trainingInstanceId === trainingInstanceId
                    ? { ...item, titleOverride: value.trim() || null }
                    : item,
            ),
        );
    }

    updateItemPublished(trainingInstanceId: string, published: boolean): void {
        this.selectedItems.update((items) =>
            items.map((item) =>
                item.trainingInstanceId === trainingInstanceId
                    ? { ...item, published }
                    : item,
            ),
        );
    }

    moveItem(trainingInstanceId: string, direction: -1 | 1): void {
        const items = [...this.selectedItems()];
        const index = items.findIndex(
            (item) => item.trainingInstanceId === trainingInstanceId,
        );
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
            return;
        }
        [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
        this.selectedItems.set(items);
        this.form.controls.trainingInstanceIds.setValue(
            items.map((item) => item.trainingInstanceId),
        );
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.isSaving.set(true);
        this.error.set(null);

        const trackId = this.trackId();
        const saveTrack$ = trackId
            ? this.trackApi.update(trackId, this.toTrackPayload())
            : this.trackApi.create(this.toTrackPayload());

        saveTrack$
            .pipe(
                switchMap((track) =>
                    this.trackApi.replaceItems(
                        track.id,
                        this.toTrackItemsPayload(),
                    ),
                ),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: () => {
                    this.isSaving.set(false);
                    void this.router.navigate(['/tracks']);
                },
                error: () => {
                    this.error.set('Unable to save track.');
                    this.isSaving.set(false);
                },
            });
    }

    cancel(): void {
        void this.router.navigate(['/tracks']);
    }

    findTrainingInstance(trainingInstanceId: string): TrainingInstance | null {
        return (
            this.trainingInstances().find(
                (instance) => String(instance.id) === trainingInstanceId,
            ) ?? null
        );
    }

    formatDuration(minutes: number): string {
        if (minutes <= 0) {
            return '0 min';
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (hours === 0) {
            return `${remainingMinutes} min`;
        }
        return remainingMinutes === 0
            ? `${hours} h`
            : `${hours} h ${remainingMinutes} min`;
    }

    private setTrack(track: CyberGoatzTrack): void {
        const items = [...track.items].sort(
            (a, b) => a.displayOrder - b.displayOrder,
        );
        this.form.reset({
            slug: track.slug,
            title: track.title,
            description: track.description ?? '',
            bannerImageUrl: track.bannerImageUrl ?? '',
            displayOrder: track.displayOrder,
            published: track.published,
            trainingInstanceIds: items.map((item) => item.trainingInstanceId),
        });
        this.selectedItems.set(items.map((item) => this.toEditableItem(item)));
    }

    private toTrackPayload(): CyberGoatzTrackPayload {
        const value = this.form.getRawValue();
        return {
            slug: value.slug.trim(),
            title: value.title.trim(),
            description: value.description.trim() || null,
            bannerImageUrl: value.bannerImageUrl.trim() || null,
            displayOrder: value.displayOrder ?? 0,
            published: value.published,
        };
    }

    private toTrackItemsPayload(): CyberGoatzTrackItemsPayload {
        return {
            items: this.selectedItems().map((item, displayOrder) => ({
                trainingInstanceId: item.trainingInstanceId,
                displayOrder,
                published: item.published,
                titleOverride: item.titleOverride,
            })),
        };
    }

    private toEditableItem(item: CyberGoatzTrackItem): EditableTrackItem {
        return {
            trainingInstanceId: item.trainingInstanceId,
            published: item.published,
            titleOverride: item.titleOverride,
        };
    }
}
