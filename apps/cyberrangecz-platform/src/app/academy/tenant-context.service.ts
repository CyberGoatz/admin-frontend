import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SentinelAuthService } from '@sentinel/auth';
import { Observable, of } from 'rxjs';
import {
    catchError,
    distinctUntilChanged,
    map,
    shareReplay,
    switchMap,
} from 'rxjs/operators';
import { AcademyApiService } from './academy-api.service';
import { ACADEMY_RUNTIME } from './academy-runtime';
import { Member, MemberRole } from './academy.model';

/**
 * The signed-in person's membership in this host's tenant.
 *
 * Tenant roles live in backend-cybergoatz (`GET /academy/tenants/{t}/me`),
 * not in token claims, so they are fetched after login and re-fetched when
 * the signed-in user changes.
 */
@Injectable({ providedIn: 'root' })
export class TenantContextService {
    readonly runtime = inject(ACADEMY_RUNTIME);
    private readonly api = inject(AcademyApiService);
    private readonly auth = inject(SentinelAuthService);

    /** True on a campus tenant's staff host. */
    readonly isCampus = this.runtime.tenant !== null;

    /** Emits the caller's membership, or null when signed out or not a member. */
    readonly member$: Observable<Member | null> = this.signedInKey$().pipe(
        switchMap((key) =>
            key && this.isCampus
                ? this.api.me().pipe(catchError(() => of(null)))
                : of(null),
        ),
        shareReplay({ bufferSize: 1, refCount: false }),
    );

    readonly member = toSignal(this.member$, { initialValue: null });

    hasRole$(roles: MemberRole[]): Observable<boolean> {
        return this.member$.pipe(
            map((m) => !!m && m.status === 'active' && roles.includes(m.role)),
        );
    }

    /** The mock serves `/me` without a session; real hosts need a user. */
    private signedInKey$(): Observable<string | null> {
        if (this.runtime.mock) {
            return of('mock');
        }
        return this.auth.activeUser$.pipe(
            map((user) => (user ? user.login || user.mail || 'user' : null)),
            distinctUntilChanged(),
        );
    }
}
