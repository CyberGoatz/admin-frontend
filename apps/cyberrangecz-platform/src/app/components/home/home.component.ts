import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SentinelAuthService, UserRole } from '@sentinel/auth';
import { AgendaPortalLink } from '../../model/agenda-portal-link';
import { PortalAgendaContainer } from '../../model/portal-agenda-container';
import { RoleResolver } from '../../utils/role-resolver';
import { AgendaMenuItem } from '../../model/agenda-menu-item';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PortalAgendaContainerComponent } from './portal-agenda-container/portal-agenda-container.component';
import { ValidPath } from '@crczp/routing-commons';

/**
 * Main component of homepage (portal) page. Portal page is a main crossroad of possible sub pages. Only those matching with user
 * role are accessible.
 */
@Component({
    selector: 'crczp-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    imports: [PortalAgendaContainerComponent],
})
export class HomeComponent implements OnInit {
    elevated: string;
    roles: UserRole[];
    portalAgendaContainers: PortalAgendaContainer[] = [];

    destroyRef = inject(DestroyRef);

    private authService = inject(SentinelAuthService);
    private router = inject(Router);

    static createExpandedControlButtons(path: ValidPath[]): AgendaMenuItem[] {
        return [
            new AgendaMenuItem('timeline', 'Adaptive', path[0]),
            new AgendaMenuItem('videogame_asset', 'Linear', path[1]),
        ];
    }

    ngOnInit(): void {
        this.roles = this.authService.getRoles();
        this.initRoutes();
        this.subscribeUserChange();
    }

    /**
     * Navigates to specified route
     * @param route route to which should router navigate
     */
    navigateToRoute(route: ValidPath): void {
        this.router.navigate([route]);
    }

    setElevation(buttonName: string): void {
        this.elevated = buttonName;
    }

    private initRoutes() {
        this.portalAgendaContainers = [
            {
                agendas: this.createParticipateButtons(),
                label: 'Participate',
                displayed: RoleResolver.isTrainingTrainee(this.roles),
                children: [],
                icon: 'play_circle',
            },
            {
                agendas: this.createDesignButtons(),
                label: 'Design',
                displayed:
                    RoleResolver.isTrainingDesigner(this.roles) ||
                    RoleResolver.isSandboxDesigner(this.roles),
                children: [],
                icon: 'design_services',
            },
            {
                agendas: this.createOrganizeButtons(),
                label: 'Organize',
                displayed:
                    RoleResolver.isTrainingOrganizer(this.roles) ||
                    RoleResolver.isSandboxOrganizer(this.roles),
                children: [],
                icon: 'event',
            },
            {
                agendas: this.createManageButtons(),
                label: 'Manage',
                displayed: RoleResolver.isUserAndGroupAdmin(this.roles),
                children: [],
                icon: 'manage_accounts',
            },
        ];
    }

    private createParticipateButtons() {
        return [
            new AgendaPortalLink(
                'Mission Run',
                !RoleResolver.isTrainingTrainee(this.roles),
                'run',
                'Mission Run lets you start or resume a mission session or view the results of a completed mission.',
                'games',
            ),
        ];
    }

    private createDesignButtons(): AgendaPortalLink[] {
        return [
            new AgendaPortalLink(
                'Sandbox Definition',
                !RoleResolver.isSandboxDesigner(this.roles),
                'sandbox-definition',
                'In the Sandbox Definition agenda, you can manage sandbox definitions—descriptions of virtual networks and computers that can be instantiated in isolated sandboxes.',
                'event_note',
            ),
            new AgendaPortalLink(
                'Mission Definition',
                !RoleResolver.isTrainingDesigner(this.roles),
                'linear-definition',
                'Mission Definition is the blueprint for missions. You can manage existing missions and design new ones.',
                'assignment',
                HomeComponent.createExpandedControlButtons([
                    'adaptive-definition',
                    'linear-definition',
                ]),
            ),
        ];
    }

    private createOrganizeButtons() {
        return [
            new AgendaPortalLink(
                'Pool',
                !RoleResolver.isSandboxOrganizer(this.roles),
                'pool',
                'As an instructor, you can create pools of sandboxes—the basic organizational units for instantiating sandbox definitions.',
                'subscriptions',
            ),
            new AgendaPortalLink(
                'Images',
                !RoleResolver.isSandboxOrganizer(this.roles),
                'sandbox-image',
                'In the Images agenda, you can view available cloud images.',
                'donut_large',
            ),
            new AgendaPortalLink(
                'Mission Instance',
                !RoleResolver.isTrainingOrganizer(this.roles),
                'linear-instance',
                'You can create mission instances required for organizing hands-on mission sessions.',
                'event',
                HomeComponent.createExpandedControlButtons([
                    'adaptive-instance',
                    'linear-instance',
                ]),
            ),
        ];
    }

    private createManageButtons() {
        const disabled = !RoleResolver.isUserAndGroupAdmin(this.roles);
        return [
            new AgendaPortalLink(
                'Groups',
                disabled,
                'group',
                'In Groups, you can manage groups and grant access rights to their members.',
                'group',
            ),
            new AgendaPortalLink(
                'Users',
                disabled,
                'user',
                'The Users agenda lets you assign users to existing groups.',
                'person',
            ),
            new AgendaPortalLink(
                'Microservices',
                disabled,
                'microservice',
                'You can manage the microservices that provide CyberGoatz Admin functionality. Make sure you understand the implications before making any changes.',
                'account_tree',
            ),
        ];
    }

    private subscribeUserChange() {
        this.authService.activeUser$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.initRoutes();
            });
    }
}
