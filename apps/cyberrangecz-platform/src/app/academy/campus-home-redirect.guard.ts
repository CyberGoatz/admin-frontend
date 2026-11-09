import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantContextService } from './tenant-context.service';

/**
 * On a campus tenant's staff host the native portal is replaced by the
 * academy start page.
 */
export const campusHomeRedirectGuard: CanActivateFn = () =>
    inject(TenantContextService).isCampus
        ? inject(Router).createUrlTree(['academy'])
        : true;
