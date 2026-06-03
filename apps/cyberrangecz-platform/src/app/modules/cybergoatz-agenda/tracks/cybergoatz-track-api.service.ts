import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PortalConfig } from '@crczp/utils';
import { Observable } from 'rxjs';
import {
    CyberGoatzTrack,
    CyberGoatzTrackItemsPayload,
    CyberGoatzTrackPayload,
} from './cybergoatz-track.model';

@Injectable({
    providedIn: 'root',
})
export class CyberGoatzTrackApiService {
    private readonly http = inject(HttpClient);
    private readonly endpoint = `${inject(PortalConfig).basePaths.cybergoatz}/admin/tracks`;

    getAll(): Observable<CyberGoatzTrack[]> {
        return this.http.get<CyberGoatzTrack[]>(this.endpoint);
    }

    get(trackId: string): Observable<CyberGoatzTrack> {
        return this.http.get<CyberGoatzTrack>(`${this.endpoint}/${trackId}`);
    }

    create(payload: CyberGoatzTrackPayload): Observable<CyberGoatzTrack> {
        return this.http.post<CyberGoatzTrack>(this.endpoint, payload);
    }

    update(
        trackId: string,
        payload: CyberGoatzTrackPayload,
    ): Observable<CyberGoatzTrack> {
        return this.http.patch<CyberGoatzTrack>(
            `${this.endpoint}/${trackId}`,
            payload,
        );
    }

    replaceItems(
        trackId: string,
        payload: CyberGoatzTrackItemsPayload,
    ): Observable<CyberGoatzTrack> {
        return this.http.put<CyberGoatzTrack>(
            `${this.endpoint}/${trackId}/items`,
            payload,
        );
    }

    delete(trackId: string): Observable<void> {
        return this.http.delete<void>(`${this.endpoint}/${trackId}`);
    }
}
