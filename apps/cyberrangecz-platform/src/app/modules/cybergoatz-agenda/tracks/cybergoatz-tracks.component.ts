import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
    SentinelConfirmationDialogComponent,
    SentinelConfirmationDialogConfig,
    SentinelDialogResultEnum,
} from '@sentinel/components/dialogs';
import { EMPTY, switchMap } from 'rxjs';
import { CyberGoatzTrackApiService } from './cybergoatz-track-api.service';
import { CyberGoatzTrack } from './cybergoatz-track.model';

@Component({
    selector: 'crczp-cybergoatz-tracks',
    templateUrl: './cybergoatz-tracks.component.html',
    styleUrls: ['./cybergoatz-tracks.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatCardModule,
        MatProgressSpinnerModule,
    ],
})
export class CyberGoatzTracksComponent {
    readonly tracks = signal<CyberGoatzTrack[]>([]);
    readonly isLoading = signal(true);
    readonly error = signal<string | null>(null);

    private readonly trackApi = inject(CyberGoatzTrackApiService);
    private readonly dialog = inject(MatDialog);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    constructor() {
        this.load();
    }

    load(): void {
        this.isLoading.set(true);
        this.error.set(null);

        this.trackApi
            .getAll()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (tracks) => {
                    this.tracks.set(tracks);
                    this.isLoading.set(false);
                },
                error: () => {
                    this.error.set('Unable to load tracks.');
                    this.isLoading.set(false);
                },
            });
    }

    createTrack(): void {
        void this.router.navigate(['/tracks', 'create']);
    }

    editTrack(track: CyberGoatzTrack): void {
        void this.router.navigate(['/tracks', track.id, 'edit']);
    }

    deleteTrack(track: CyberGoatzTrack): void {
        this.dialog
            .open(SentinelConfirmationDialogComponent, {
                data: new SentinelConfirmationDialogConfig(
                    'Delete Track',
                    `Do you want to delete track "${track.title}"?`,
                    'Cancel',
                    'Delete',
                ),
            })
            .afterClosed()
            .pipe(
                switchMap((result) =>
                    result === SentinelDialogResultEnum.CONFIRMED
                        ? this.trackApi.delete(track.id)
                        : EMPTY,
                ),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
                next: () => this.load(),
                error: () => this.error.set('Unable to delete track.'),
            });
    }
}
