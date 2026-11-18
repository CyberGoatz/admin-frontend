import { inject, NgModule } from '@angular/core';
import { CanActivateFn, Router, RouterModule } from '@angular/router';
import { ValidRouterConfig } from '@crczp/routing-commons';
import { map } from 'rxjs/operators';
import { academyRoleGuard } from '../../academy/academy-guards';
import { TenantContextService } from '../../academy/tenant-context.service';
import { MembersComponent } from './members/members.component';
import { CoursesComponent } from './courses/courses.component';
import { CourseEditorComponent } from './course-editor/course-editor.component';
import { RosterImportComponent } from './roster/roster-import.component';
import { MissionLibraryComponent } from './library/mission-library.component';

/** Tenant admins start on Members, everyone else on Courses. */
const academyLandingGuard: CanActivateFn = () => {
    const router = inject(Router);
    return inject(TenantContextService).sessionMember$().pipe(
        map((member) =>
            router.createUrlTree([
                'academy',
                member?.role === 'tenant_admin' ? 'members' : 'courses',
            ]),
        ),
    );
};

const authors = academyRoleGuard(['tenant_admin', 'professor']);

const routes: ValidRouterConfig<'academy'> = [
    {
        path: '',
        pathMatch: 'full',
        canActivate: [academyLandingGuard],
        component: CoursesComponent,
    },
    {
        path: 'members',
        component: MembersComponent,
        canActivate: [academyRoleGuard(['tenant_admin'])],
        data: { breadcrumb: 'Members' },
    },
    {
        path: 'library',
        component: MissionLibraryComponent,
        canActivate: [authors],
        data: { breadcrumb: 'Mission library' },
    },
    {
        path: 'courses',
        component: CoursesComponent,
        data: { breadcrumb: 'Courses' },
    },
    {
        path: 'courses/:courseId',
        component: CourseEditorComponent,
        data: { breadcrumb: 'Course' },
    },
    {
        path: 'courses/:courseId/roster',
        component: RosterImportComponent,
        canActivate: [authors],
        data: { breadcrumb: 'Roster upload' },
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class AcademyRoutingModule {}
