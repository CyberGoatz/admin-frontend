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
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { createInfinitePaginationEvent } from '@crczp/api-common';
import {
    LinearTrainingInstanceApi,
    TrainingInstanceSort,
} from '@crczp/training-api';
import { TrainingInstance } from '@crczp/training-model';
import { forkJoin } from 'rxjs';
import { CyberGoatzTrackApiService } from './cybergoatz-track-api.service';
import { CyberGoatzTrack, CyberGoatzTrackItem } from './cybergoatz-track.model';

@Component({
    selector: 'crczp-cybergoatz-track-detail',
    templateUrl: './cybergoatz-track-detail.component.html',
    styleUrls: ['./cybergoatz-track-detail.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatCardModule,
        MatChipsModule,
        MatDividerModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
})
export class CyberGoatzTrackDetailComponent {
    readonly track = signal<CyberGoatzTrack | null>(null);
    readonly trainingInstances = signal<TrainingInstance[]>([]);
    readonly isLoading = signal(true);
    readonly error = signal<string | null>(null);

    readonly sortedItems = computed(() =>
        [...(this.track()?.items ?? [])].sort(
            (a, b) => a.displayOrder - b.displayOrder,
        ),
    );

    readonly totalEstimatedDuration = computed(() =>
        this.sortedItems().reduce(
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
        this.load();
    }

    load(): void {
        const trackId = this.route.snapshot.paramMap.get('trackId');
        if (!trackId) {
            this.error.set('Track id is missing.');
            this.isLoading.set(false);
            return;
        }

        this.isLoading.set(true);
        this.error.set(null);

        forkJoin({
            track: this.trackApi.get(trackId),
            instances: this.trainingInstanceApi.getAll(
                createInfinitePaginationEvent<TrainingInstanceSort>('title'),
            ),
        })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: ({ track, instances }) => {
                    this.track.set(track);
                    this.trainingInstances.set(instances.elements);
                    this.isLoading.set(false);
                },
                error: () => {
                    this.error.set('Unable to load track details.');
                    this.isLoading.set(false);
                },
            });
    }

    editTrack(): void {
        const track = this.track();
        if (!track) {
            return;
        }
        void this.router.navigate(['/tracks', track.id, 'edit']);
    }

    backToTracks(): void {
        void this.router.navigate(['/tracks']);
    }

    findTrainingInstance(trainingInstanceId: string): TrainingInstance | null {
        return (
            this.trainingInstances().find(
                (instance) => String(instance.id) === trainingInstanceId,
            ) ?? null
        );
    }

    getItemTitle(item: CyberGoatzTrackItem): string {
        const instance = this.findTrainingInstance(item.trainingInstanceId);
        return item.titleOverride || instance?.title || 'Training unavailable';
    }

    getBadgeAltText(track: CyberGoatzTrack): string {
        return `${track.badgeName || track.title} badge`;
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

    formatDate(value: string): string {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value));
    }
}
