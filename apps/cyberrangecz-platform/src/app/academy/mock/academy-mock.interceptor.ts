import { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { from, Observable, switchMap } from 'rxjs';
import { getAcademyRuntime } from '../academy-runtime';
import type { AcademyMockBackend } from './academy-mock-backend';

let backend: Promise<AcademyMockBackend> | null = null;

/**
 * Serves `/academy/*` requests from the in-browser mock backend when the dev
 * flag is on (`?academyMock=1`, development builds only). Every other request
 * passes through untouched. The mock is loaded lazily so production bundles
 * do not carry it.
 */
export function academyMockInterceptor(
    req: HttpRequest<unknown>,
    next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
    if (!getAcademyRuntime().mock || !req.url.includes('/academy/')) {
        return next(req);
    }
    backend ??= import('./academy-mock-backend').then(
        (m) => new m.AcademyMockBackend(),
    );
    return from(backend).pipe(switchMap((b) => b.handle(req)));
}
