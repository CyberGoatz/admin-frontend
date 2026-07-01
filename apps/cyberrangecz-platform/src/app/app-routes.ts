import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import {
    sentinelAuthGuardWithLogin,
    sentinelNegativeAuthGuard,
} from '@sentinel/auth';
import { AccessDeniedComponent } from './components/access-denied/access-denied.component';
import { ValidRouterConfig } from '@crczp/routing-commons';
import { RoleGuards } from './utils/guards';

export const APP_ROUTES: ValidRouterConfig<''> = [
    {
        path: 'linear-definition',
        loadChildren: () =>
            import('./modules/training-agenda/training-definition-routing.module').then(
                (m) => m.TrainingDefinitionRoutingModule,
            ),
        canActivate: [RoleGuards.trainingDesignerGuard],
        data: {
            breadcrumb: 'Linear Mission Definitions',
            title: 'Linear Mission Definition Overview',
            preloadRoleCondition: 'trainingDesigner',
        },
    },
    {
        path: 'adaptive-definition',
        loadChildren: () =>
            import('./modules/training-agenda/adaptive-definition-routing.module').then(
                (m) => m.AdaptiveDefinitionRoutingModule,
            ),
        canActivate: [RoleGuards.adaptiveTrainingDesignerGuard],
        data: {
            breadcrumb: 'Adaptive Mission Definitions',
            title: 'Adaptive Mission Definition Overview',
            preloadRoleCondition: 'adaptiveTrainingDesigner',
        },
    },
    {
        path: 'linear-instance',
        loadChildren: () =>
            import('./modules/training-agenda/training-instance-routing.module').then(
                (m) => m.TrainingInstanceRoutingModule,
            ),
        canActivate: [RoleGuards.trainingOrganizerGuard],
        data: {
            breadcrumb: 'Linear Mission Instances',
            title: 'Linear Mission Instance Overview',
            preloadRoleCondition: 'trainingOrganizer',
        },
    },
    {
        path: 'adaptive-instance',
        loadChildren: () =>
            import('./modules/training-agenda/adaptive-instance-routing.module').then(
                (m) => m.AdaptiveInstanceRoutingModule,
            ),
        canActivate: [RoleGuards.adaptiveTrainingOrganizerGuard],
        data: {
            breadcrumb: 'Adaptive Mission Instances',
            title: 'Adaptive Mission Instance Overview',
            preloadRoleCondition: 'adaptiveTrainingOrganizer',
        },
    },
    {
        path: 'sandbox-definition',
        loadChildren: () =>
            import('./modules/sandbox-agenda/sandbox-definition-routing.module').then(
                (m) => m.SandboxDefinitionRoutingModule,
            ),
        canActivate: [RoleGuards.sandboxDesignerGuard],
        data: {
            breadcrumb: 'Sandbox Definitions',
            title: 'Sandbox Definition Overview',
            preloadRoleCondition: 'sandboxDesigner',
        },
    },
    {
        path: 'pool',
        loadChildren: () =>
            import('./modules/sandbox-agenda/pool-routing.module').then(
                (m) => m.PoolRoutingModule,
            ),
        canActivate: [RoleGuards.sandboxOrganizerGuard],
        data: {
            breadcrumb: 'Pools',
            title: 'Pool Overview',
            preloadRoleCondition: 'sandboxOrganizer',
        },
    },
    {
        path: 'sandbox-image',
        loadChildren: () =>
            import('./modules/sandbox-agenda/sandbox-images-routing.module').then(
                (m) => m.SandboxImagesRoutingModule,
            ),
        canActivate: [RoleGuards.sandboxOrganizerGuard],
        data: {
            breadcrumb: 'Images',
            title: 'Images Overview',
            preloadRoleCondition: 'sandboxOrganizer',
        },
    },
    {
        path: 'run',
        loadChildren: () =>
            import('./modules/training-agenda/training-run-routing.module').then(
                (m) => m.TrainingRunRoutingModule,
            ),
        canActivate: [RoleGuards.adminPlatformAccessGuard],
        data: {
            breadcrumb: 'Mission Runs',
            title: 'Mission Run Overview',
            preloadRoleCondition: 'trainingTrainee',
        },
    },
    {
        // for trainees
        path: 'mitre-techniques',
        loadChildren: () =>
            import('./modules/training-agenda/mitre-routing.module').then(
                (m) => m.TrainingRunRoutingModule,
            ),
        canActivate: [RoleGuards.adminPlatformAccessGuard],
        data: {
            title: 'MITRE ATT&CK Techniques',
            breadcrumb: 'MITRE ATT&CK Techniques',
            showSwitch: false,
            preloadRoleCondition: 'trainingTrainee',
        },
    },
    {
        // for designers
        path: 'mitre-techniques',
        loadChildren: () =>
            import('./modules/training-agenda/mitre-routing.module').then(
                (m) => m.TrainingRunRoutingModule,
            ),
        canActivate: [RoleGuards.trainingDesignerGuard],
        data: {
            title: 'MITRE ATT&CK Techniques',
            breadcrumb: 'MITRE ATT&CK Techniques',
            showSwitch: false,
            preloadRoleCondition: 'trainingDesigner',
        },
    },
    {
        path: 'tracks',
        loadChildren: () =>
            import('./modules/cybergoatz-agenda/tracks-routing.module').then(
                (m) => m.CyberGoatzTracksRoutingModule,
            ),
        canActivate: [RoleGuards.trainingOrganizerGuard],
        data: {
            breadcrumb: 'CyberGoatz Tracks',
            title: 'CyberGoatz Tracks',
            preloadRoleCondition: 'trainingOrganizer',
        },
    },
    {
        path: 'user',
        loadChildren: () =>
            import('./modules/user-and-group-agenda/user-routing.module').then(
                (m) => m.UserRoutingModule,
            ),
        canActivate: [RoleGuards.uagAdminGuard],
        data: {
            breadcrumb: 'Users',
            title: 'User Overview',
            preloadRoleCondition: 'uagAdmin',
        },
    },
    {
        path: 'group',
        loadChildren: () =>
            import('./modules/user-and-group-agenda/group-routing.module').then(
                (m) => m.GroupRoutingModule,
            ),
        canActivate: [RoleGuards.uagAdminGuard],
        data: {
            breadcrumb: 'Groups',
            title: 'Group Overview',
            preloadRoleCondition: 'uagAdmin',
        },
    },
    {
        path: 'microservice',
        loadChildren: () =>
            import('./modules/user-and-group-agenda/microservice-routing.module').then(
                (m) => m.MicroserviceRoutingModule,
            ),
        canActivate: [RoleGuards.uagAdminGuard],
        data: {
            breadcrumb: 'Microservice',
            title: 'Microservice Overview',
            preloadRoleCondition: 'uagAdmin',
        },
    },
    {
        path: 'notifications',
        canActivate: [RoleGuards.adminPlatformAccessGuard],
        loadChildren: () =>
            import('./modules/notifications/notifications-routing.module').then(
                (m) => m.NotificationsRoutingModule,
            ),
        data: {
            breadcrumb: 'Notifications',
            title: 'Notifications',
        },
    },
    {
        path: 'console/sandbox-instance/:sandboxInstanceId/console/:nodeId',
        loadComponent: () =>
            import('@crczp/components').then(
                (m) => m.ConsoleFullscreenWrapperComponent,
            ),
        canActivate: [RoleGuards.adminPlatformAccessGuard],
    },
    {
        path: 'login',
        component: LoginComponent,
        canActivate: [sentinelNegativeAuthGuard],
    },
    {
        path: 'home',
        component: HomeComponent,
        canActivate: [RoleGuards.adminPlatformAccessGuard],
    },
    {
        path: 'access-denied',
        component: AccessDeniedComponent,
        canActivate: [sentinelAuthGuardWithLogin],
    },
    {
        path: 'logout',
        redirectTo: 'login',
        pathMatch: 'full',
    },
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
    },
];
