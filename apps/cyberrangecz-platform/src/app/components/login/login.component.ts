import {Component} from '@angular/core';
import {MatCard, MatCardContent, MatCardSubtitle, MatCardTitle} from "@angular/material/card";
import {SentinelAuthProviderListComponent} from "@sentinel/auth/components";
import {getAcademyRuntime} from '../../academy/academy-runtime';

@Component({
    selector: 'crczp-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    imports: [
        MatCardSubtitle,
        MatCardTitle,
        MatCard,
        SentinelAuthProviderListComponent,
        MatCardContent
    ]
})
export class LoginComponent {
    private readonly runtime = getAcademyRuntime();
    readonly title = this.runtime.title;
    /** Tenant hosts show the tenant's square mark instead of the CyberGoatz monogram. */
    readonly markUrl = this.runtime.tenant ? this.runtime.branding.markUrl : undefined;
    readonly subtitle = this.runtime.tenant
        ? 'Sign in to manage courses, rosters and missions.'
        : 'Sign in to manage missions, users, sandboxes, and platform operations.';
}
