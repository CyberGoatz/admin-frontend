import { User } from '@sentinel/auth';
import { RoleResolver } from './role-resolver';
import { NavAgendaContainerConfig } from '@crczp/utils';
import { ValidPathPrefix } from '@crczp/routing-commons';
import { Member } from '../academy/academy.model';

export class NavConfigFactory {
    /**
     * @param user signed-in engine user (null in the academy mock without a session)
     * @param member the caller's tenant membership on a campus host, otherwise null
     */
    static buildNavConfig(
        user: User | null,
        member: Member | null = null,
    ): NavAgendaContainerConfig[] {
        if (member) {
            return NavConfigFactory.buildAcademyNavConfig(user, member);
        }
        if (!user) {
            return [];
        }
        return NavConfigFactory.buildPlatformNavConfig(user);
    }

    /**
     * Tenant staff see the academy menu. Native Pool, Sandbox, Images,
     * User/Group/Microservice, Tracks and adaptive menus stay hidden: those
     * objects are global and are managed by backend-cybergoatz for tenants.
     * Professors build courses from the mission catalog, so the native
     * mission authoring (linear definitions) and instance menus are hidden too.
     */
    static buildAcademyNavConfig(
        user: User | null,
        member: Member,
    ): NavAgendaContainerConfig[] {
        const isAdmin = member.role === 'tenant_admin';
        const isProfessor = member.role === 'professor';
        return [
            {
                label: 'Teaching',
                agendas: [
                    {
                        label: 'Members',
                        path: 'academy/members' satisfies ValidPathPrefix,
                        canActivate: () => isAdmin,
                    },
                    {
                        label: 'Courses',
                        path: 'academy/courses' satisfies ValidPathPrefix,
                    },
                    {
                        label: 'Mission library',
                        path: 'academy/library' satisfies ValidPathPrefix,
                        canActivate: () => isAdmin || isProfessor,
                    },
                ],
            },
        ];
    }

    static buildPlatformNavConfig(user: User): NavAgendaContainerConfig[] {
        return [
            {
                label: 'Missions',
                agendas: [
                    {
                        label: 'Definition',
                        agendas: [
                            {
                                label: 'Adaptive',
                                path: 'adaptive-definition' satisfies ValidPathPrefix,
                                canActivate: () =>
                                    RoleResolver.isAdaptiveTrainingDesigner(
                                        user.roles,
                                    ),
                            },
                            {
                                label: 'Linear',
                                path: 'linear-definition' satisfies ValidPathPrefix,
                                canActivate: () =>
                                    RoleResolver.isTrainingDesigner(user.roles),
                            },
                        ],
                    },
                    {
                        label: 'Instance',
                        agendas: [
                            {
                                label: 'Adaptive',
                                path: 'adaptive-instance' satisfies ValidPathPrefix,
                                canActivate: () =>
                                    RoleResolver.isAdaptiveTrainingOrganizer(
                                        user.roles,
                                    ),
                            },
                            {
                                label: 'Linear',
                                path: 'linear-instance' satisfies ValidPathPrefix,
                                canActivate: () =>
                                    RoleResolver.isTrainingOrganizer(
                                        user.roles,
                                    ),
                            },
                        ],
                    },
                    {
                        label: 'Run',
                        path: 'run' satisfies ValidPathPrefix,
                    },
                    {
                        label: 'Tracks',
                        path: 'tracks' satisfies ValidPathPrefix,
                        canActivate: () =>
                            RoleResolver.isTrainingOrganizer(user.roles),
                    },
                ],
            },
            {
                label: 'Sandboxes',
                agendas: [
                    {
                        label: 'Definition',
                        path: 'sandbox-definition' satisfies ValidPathPrefix,
                        canActivate: () =>
                            RoleResolver.isSandboxDesigner(user.roles),
                    },
                    {
                        label: 'Pool',
                        path: 'pool' satisfies ValidPathPrefix,
                        canActivate: () =>
                            RoleResolver.isSandboxOrganizer(user.roles),
                    },
                    {
                        label: 'Images',
                        path: 'sandbox-image' satisfies ValidPathPrefix,
                        canActivate: () =>
                            RoleResolver.isSandboxOrganizer(user.roles),
                    },
                ],
            },
            {
                label: 'Administration',
                agendas: [
                    {
                        label: 'User',
                        path: 'user' satisfies ValidPathPrefix,
                        canActivate: () =>
                            RoleResolver.isUserAndGroupAdmin(user.roles),
                    },
                    {
                        label: 'Group',
                        path: 'group' satisfies ValidPathPrefix,
                        canActivate: () =>
                            RoleResolver.isUserAndGroupAdmin(user.roles),
                    },
                    {
                        label: 'Microservice',
                        path: 'microservice' satisfies ValidPathPrefix,
                        canActivate: () =>
                            RoleResolver.isUserAndGroupAdmin(user.roles),
                    },
                ],
            },
        ];
    }
}
