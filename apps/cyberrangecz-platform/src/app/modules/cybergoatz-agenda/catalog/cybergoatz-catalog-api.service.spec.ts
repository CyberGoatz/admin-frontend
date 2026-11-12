import { provideHttpClient } from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PortalConfig } from '@crczp/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CyberGoatzCatalogApiService } from './cybergoatz-catalog-api.service';
import { CatalogSource } from './cybergoatz-catalog.model';

const BASE = 'https://host/cybergoatz/api/v1/admin/catalog/sources';
const ID = '11111111-1111-1111-1111-111111111111';

describe('CyberGoatzCatalogApiService', () => {
    let service: CyberGoatzCatalogApiService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                {
                    provide: PortalConfig,
                    useValue: {
                        basePaths: {
                            cybergoatz: 'https://host/cybergoatz/api/v1',
                        },
                    },
                },
            ],
        });
        service = TestBed.inject(CyberGoatzCatalogApiService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('lists sources', () => {
        const sources: CatalogSource[] = [];
        service.getSources().subscribe((r) => expect(r).toBe(sources));
        const req = http.expectOne(BASE);
        expect(req.request.method).toBe('GET');
        req.flush(sources);
    });

    it('gets one source', () => {
        service.getSource(ID).subscribe();
        const req = http.expectOne(`${BASE}/${ID}`);
        expect(req.request.method).toBe('GET');
        req.flush({});
    });

    it('creates a source with repoUrl and rev', () => {
        service
            .createSource({ repoUrl: 'https://github.com/o/r', rev: 'main' })
            .subscribe();
        const req = http.expectOne(BASE);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({
            repoUrl: 'https://github.com/o/r',
            rev: 'main',
        });
        req.flush({});
    });

    it('patches a source', () => {
        service.updateSource(ID, { rev: 'v2' }).subscribe();
        const req = http.expectOne(`${BASE}/${ID}`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ rev: 'v2' });
        req.flush({});
    });

    it('refreshes with POST and no body and returns the summary', () => {
        let count = -1;
        service.refresh(ID).subscribe((s) => (count = s.created));
        const req = http.expectOne(`${BASE}/${ID}/refresh`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toBeNull();
        req.flush({
            commit: 'abc',
            startedAt: 'a',
            finishedAt: 'b',
            created: 3,
            updated: 0,
            skipped: 0,
            metadataUpdated: 0,
            failed: 0,
            notBuilt: 0,
            removed: 0,
            items: [],
            tracks: [],
        });
        expect(count).toBe(3);
    });

    it('sends only the filters that are set when listing items', () => {
        service.getItems(ID, { state: 'failed', course: 'web' }).subscribe();
        const req = http.expectOne((r) => r.url === `${BASE}/${ID}/items`);
        expect(req.request.params.get('state')).toBe('failed');
        expect(req.request.params.get('course')).toBe('web');
        req.flush([]);

        service.getItems(ID).subscribe();
        const bare = http.expectOne((r) => r.url === `${BASE}/${ID}/items`);
        expect(bare.request.params.keys()).toEqual([]);
        bare.flush([]);
    });
});
