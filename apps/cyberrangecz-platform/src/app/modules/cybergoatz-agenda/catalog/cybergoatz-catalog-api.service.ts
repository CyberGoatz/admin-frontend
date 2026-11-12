import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PortalConfig } from '@crczp/utils';
import { Observable } from 'rxjs';
import {
    CatalogItem,
    CatalogItemsQuery,
    CatalogSource,
    CatalogSyncSummary,
    CreateCatalogSourcePayload,
    UpdateCatalogSourcePayload,
} from './cybergoatz-catalog.model';

@Injectable({
    providedIn: 'root',
})
export class CyberGoatzCatalogApiService {
    private readonly http = inject(HttpClient);
    private readonly endpoint = `${inject(PortalConfig).basePaths.cybergoatz}/admin/catalog/sources`;

    getSources(): Observable<CatalogSource[]> {
        return this.http.get<CatalogSource[]>(this.endpoint);
    }

    getSource(sourceId: string): Observable<CatalogSource> {
        return this.http.get<CatalogSource>(`${this.endpoint}/${sourceId}`);
    }

    createSource(
        payload: CreateCatalogSourcePayload,
    ): Observable<CatalogSource> {
        return this.http.post<CatalogSource>(this.endpoint, payload);
    }

    updateSource(
        sourceId: string,
        payload: UpdateCatalogSourcePayload,
    ): Observable<CatalogSource> {
        return this.http.patch<CatalogSource>(
            `${this.endpoint}/${sourceId}`,
            payload,
        );
    }

    /**
     * Starts a sync. This can take a long time; no client-side timeout is
     * applied, the request only ends when the server answers.
     */
    refresh(sourceId: string): Observable<CatalogSyncSummary> {
        return this.http.post<CatalogSyncSummary>(
            `${this.endpoint}/${sourceId}/refresh`,
            null,
        );
    }

    getItems(
        sourceId: string,
        query: CatalogItemsQuery = {},
    ): Observable<CatalogItem[]> {
        let params = new HttpParams();
        if (query.state) {
            params = params.set('state', query.state);
        }
        if (query.course) {
            params = params.set('course', query.course);
        }
        return this.http.get<CatalogItem[]>(
            `${this.endpoint}/${sourceId}/items`,
            { params },
        );
    }
}
