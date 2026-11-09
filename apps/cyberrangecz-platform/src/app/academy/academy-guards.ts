import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { sentinelAuthGuardWithLogin } from '@sentinel/auth';
import { from, isObservable, Observable, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { MemberRole } from './academy.model';
import { TenantContextService } from './tenant-context.service';

export const ACADEMY_STAFF_ROLES: MemberRole[] = ['tenant_admin', 'professor', 'ta'];

function loggedIn$(): Observable<boolean> {
    const result = sentinelAuthGuardWithLogin() as
        | boolean
        | Promise<boolean>
        | Observable<boolean>;
    if (isObservable(result)) {
        return result;
    }
    return typeof result === 'boolean' ? of(result) : from(result);
}

/**
 * Allows the route when the caller is an active member of this host's tenant
 * with one of the given tenant roles (from `GET /academy/tenants/{t}/me`).
 * Signed-out callers go to login; non-members go to access-denied; members
 * without the role go to the academy landing page.
 */
export function academyRoleGuard(roles: MemberRole[]): CanActivateFn {
    return () => {
        const router = inject(Router);
        const tenant = inject(TenantContextService);
        if (!tenant.isCampus) {
            return router.createUrlTree(['home']);
        }
        const session$ = tenant.runtime.mock ? of(true) : loggedIn$();
        return session$.pipe(
            take(1),
            switchMap((ok) => {
                if (!ok) {
                    return of(router.createUrlTree(['login']));
                }
                return tenant.member$.pipe(
                    take(1),
                    map((member) => {
                        if (!member || member.status !== 'active') {
                            return router.createUrlTree(['access-denied']);
                        }
                        if (roles.includes(member.role)) {
                            return true;
                        }
                        // Staff without this role land on their own start page;
                        // students do not use the admin front end.
                        return ACADEMY_STAFF_ROLES.includes(member.role)
                            ? router.createUrlTree(['academy'])
                            : router.createUrlTree(['access-denied']);
                    }),
                );
            }),
        );
    };
}
