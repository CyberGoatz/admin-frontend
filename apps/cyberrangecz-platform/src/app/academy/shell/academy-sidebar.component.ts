import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { User } from '@sentinel/auth';
import { NavBarStateService } from '@sentinel/layout';
import { NavConfigFactory } from '../../utils/nav-config-factory';
import { ROLE_LABELS } from '../../modules/academy-agenda/shared/academy-format';
import { Member } from '../academy.model';
import { TenantContextService } from '../tenant-context.service';

interface SidebarItem {
    label: string;
    route: string;
    icon: string;
}

interface SidebarSection {
    label: string;
    items: SidebarItem[];
}

/** Icons by route; anything unlisted gets a neutral dot. */
const ICONS: Record<string, string> = {
    'academy/members': 'group',
    'academy/courses': 'menu_book',
    'academy/library': 'library_books',
    'linear-definition': 'edit_note',
    'linear-instance': 'dns',
};

/**
 * Tenant-branded navigation for campus staff hosts, rendered in the
 * Sentinel layout's custom nav slot. Solid tenant primary, white text.
 */
@Component({
    selector: 'crczp-academy-sidebar',
    templateUrl: './academy-sidebar.component.html',
    styleUrls: ['./academy-sidebar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIconModule, MatTooltipModule, RouterLink, RouterLinkActive],
    host: {
        '[class.compact]': 'compact()',
    },
})
export class AcademySidebarComponent {
    /** `undefined` while `/me` loads; the brand still shows. */
    readonly member = input<Member | null | undefined>(undefined);
    readonly user = input<User | null | undefined>(null);
    readonly logout = output<void>();

    private readonly navState = inject(NavBarStateService);
    private readonly runtime = inject(TenantContextService).runtime;

    readonly brand = this.runtime.branding;
    readonly logoSrc = this.brand.logoDarkUrl || null;
    readonly markSrc = this.brand.markUrl || null;

    private readonly state = toSignal(this.navState.state$, { initialValue: 'expanded' });
    readonly small = toSignal(this.navState.isSmallView$, { initialValue: false });
    /** Icon-only rail on wide screens when the person collapses it. */
    readonly compact = computed(() => !this.small() && this.state() === 'semi-collapsed');

    readonly sections = computed<SidebarSection[]>(() => {
        const member = this.member();
        if (!member) {
            return [];
        }
        return NavConfigFactory.buildAcademyNavConfig(this.user() ?? null, member)
            .map((section) => ({
                label: section.label,
                items: section.agendas
                    .filter((a) => 'path' in a && (!a.canActivate || a.canActivate()))
                    .map((a) => {
                        const path = (a as { path: string }).path;
                        return { label: a.label, route: `/${path}`, icon: ICONS[path] ?? 'circle' };
                    }),
            }))
            .filter((section) => section.items.length > 0);
    });

    readonly personName = computed(() => {
        const member = this.member();
        const user = this.user();
        const fromMember =
            member?.displayName ||
            [member?.givenName, member?.familyName].filter(Boolean).join(' ');
        return fromMember || user?.name || member?.email || user?.mail || '';
    });

    readonly roleLabel = computed(() => {
        const role = this.member()?.role;
        return role ? ROLE_LABELS[role] : '';
    });

    readonly initials = computed(() =>
        this.personName()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join(''),
    );

    /** On phones the drawer covers the page, so close it after a pick. */
    onNavigate(): void {
        if (this.small()) {
            this.navState.toggleState();
        }
    }

    toggleCompact(): void {
        this.navState.toggleState();
    }
}
