import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PortalConfig } from '@crczp/utils';
import { SKIPPED_ERROR_CODES } from '@crczp/api-common';
import { Observable } from 'rxjs';
import { ACADEMY_RUNTIME } from './academy-runtime';
import {
    Course,
    CourseInput,
    CourseMission,
    CourseModule,
    CoursePatch,
    CourseRange,
    CourseStaff,
    CourseStaffInput,
    CourseStatus,
    CourseSummary,
    Enrollment,
    EnrollmentStatus,
    LibraryMission,
    Member,
    MemberInvite,
    MemberPage,
    MemberPatch,
    MemberQuery,
    MissionInput,
    MissionPatch,
    ModuleInput,
    PublishChecklist,
    RosterCommitRequest,
    RosterImport,
    RosterImportDetail,
    RosterPreview,
    RosterRowInput,
} from './academy.model';

/**
 * Client for the tenant-scoped academy API (backend-cybergoatz,
 * openapi/academy.yaml). Every path is under `/academy/tenants/{tenant}`.
 *
 * Calls whose errors the screens render themselves (409, 422, 400) skip the
 * global error notification.
 */
@Injectable({ providedIn: 'root' })
export class AcademyApiService {
    private readonly http = inject(HttpClient);
    private readonly runtime = inject(ACADEMY_RUNTIME);
    private readonly apiBase = inject(PortalConfig).basePaths.cybergoatz;

    get tenant(): string | null {
        return this.runtime.tenant;
    }

    private get base(): string {
        return `${this.apiBase}/academy/tenants/${this.runtime.tenant}`;
    }

    private course(courseId: string): string {
        return `${this.base}/courses/${courseId}`;
    }

    private skip(...codes: number[]) {
        return { context: new HttpContext().set(SKIPPED_ERROR_CODES, codes) };
    }

    // members

    me(): Observable<Member> {
        return this.http.get<Member>(`${this.base}/me`, this.skip(401, 403, 404));
    }

    /** `quiet` suppresses the global notice when the caller may not list members (403). */
    listMembers(query: MemberQuery = {}, quiet = false): Observable<MemberPage> {
        return this.http.get<MemberPage>(`${this.base}/members`, {
            params: toParams(query),
            ...(quiet ? this.skip(403) : {}),
        });
    }

    inviteMember(invite: MemberInvite): Observable<Member> {
        return this.http.post<Member>(`${this.base}/members`, invite, this.skip(409));
    }

    updateMember(memberId: string, patch: MemberPatch): Observable<Member> {
        return this.http.patch<Member>(`${this.base}/members/${memberId}`, patch);
    }

    resendInvite(memberId: string): Observable<void> {
        return this.http.post<void>(
            `${this.base}/members/${memberId}/resend-invite`,
            {},
            this.skip(409),
        );
    }

    // library

    libraryMissions(q?: string): Observable<LibraryMission[]> {
        return this.http.get<LibraryMission[]>(`${this.base}/library/missions`, {
            params: toParams({ q }),
        });
    }

    // courses

    listCourses(status?: CourseStatus): Observable<CourseSummary[]> {
        return this.http.get<CourseSummary[]>(`${this.base}/courses`, {
            params: toParams({ status }),
        });
    }

    createCourse(input: CourseInput): Observable<Course> {
        return this.http.post<Course>(`${this.base}/courses`, input, this.skip(409));
    }

    getCourse(courseId: string): Observable<Course> {
        return this.http.get<Course>(this.course(courseId));
    }

    updateCourse(courseId: string, patch: CoursePatch): Observable<Course> {
        return this.http.patch<Course>(this.course(courseId), patch, this.skip(409));
    }

    deleteCourse(courseId: string): Observable<void> {
        return this.http.delete<void>(this.course(courseId), this.skip(409));
    }

    /** 422 carries a PublishChecklist body. */
    publishCourse(courseId: string): Observable<Course> {
        return this.http.post<Course>(`${this.course(courseId)}/publish`, {}, this.skip(422));
    }

    /** Read-only readiness check; the same items a failed publish returns. */
    publishChecklist(courseId: string): Observable<PublishChecklist> {
        return this.http.get<PublishChecklist>(
            `${this.course(courseId)}/publish-checklist`,
            this.skip(404, 405, 501),
        );
    }

    addStaff(courseId: string, input: CourseStaffInput): Observable<CourseStaff[] | CourseStaff> {
        return this.http.post<CourseStaff[] | CourseStaff>(`${this.course(courseId)}/staff`, input, this.skip(409));
    }

    removeStaff(courseId: string, memberId: string): Observable<void> {
        return this.http.delete<void>(`${this.course(courseId)}/staff`, {
            body: { memberId },
            ...this.skip(409),
        });
    }

    archiveCourse(courseId: string): Observable<Course> {
        return this.http.post<Course>(`${this.course(courseId)}/archive`, {});
    }

    getRange(courseId: string): Observable<CourseRange> {
        return this.http.get<CourseRange>(`${this.course(courseId)}/range`);
    }

    updateRange(courseId: string, range: CourseRange): Observable<CourseRange> {
        return this.http.put<CourseRange>(`${this.course(courseId)}/range`, range);
    }

    addModule(courseId: string, input: ModuleInput): Observable<CourseModule> {
        return this.http.post<CourseModule>(`${this.course(courseId)}/modules`, input);
    }

    updateModule(courseId: string, moduleId: string, input: Partial<ModuleInput>): Observable<CourseModule> {
        return this.http.patch<CourseModule>(`${this.course(courseId)}/modules/${moduleId}`, input);
    }

    deleteModule(courseId: string, moduleId: string): Observable<void> {
        return this.http.delete<void>(`${this.course(courseId)}/modules/${moduleId}`);
    }

    addMission(courseId: string, moduleId: string, input: MissionInput): Observable<CourseMission> {
        return this.http.post<CourseMission>(
            `${this.course(courseId)}/modules/${moduleId}/missions`,
            input,
        );
    }

    updateMission(courseId: string, missionId: string, patch: MissionPatch): Observable<CourseMission> {
        return this.http.patch<CourseMission>(
            `${this.course(courseId)}/missions/${missionId}`,
            patch,
            this.skip(409),
        );
    }

    deleteMission(courseId: string, missionId: string): Observable<void> {
        return this.http.delete<void>(`${this.course(courseId)}/missions/${missionId}`);
    }

    // roster

    rosterTemplate(courseId: string): Observable<string> {
        return this.http.get(`${this.course(courseId)}/roster/template.csv`, {
            responseType: 'text',
        });
    }

    /** 400 carries a message about missing columns or file size. */
    previewRoster(courseId: string, file: File): Observable<RosterPreview> {
        const form = new FormData();
        form.append('file', file, file.name);
        return this.http.post<RosterPreview>(
            `${this.course(courseId)}/roster/preview`,
            form,
            this.skip(400),
        );
    }

    commitRoster(courseId: string, request: RosterCommitRequest): Observable<RosterImport> {
        return this.http.post<RosterImport>(
            `${this.course(courseId)}/roster/commit`,
            request,
            this.skip(409),
        );
    }

    listImports(courseId: string): Observable<RosterImport[]> {
        return this.http.get<RosterImport[]>(`${this.course(courseId)}/roster/imports`);
    }

    getImport(importId: string): Observable<RosterImportDetail> {
        return this.http.get<RosterImportDetail>(`${this.base}/roster-imports/${importId}`);
    }

    importErrorsCsv(importId: string): Observable<string> {
        return this.http.get(`${this.base}/roster-imports/${importId}/errors.csv`, {
            responseType: 'text',
        });
    }

    listEnrollments(
        courseId: string,
        filter: { status?: EnrollmentStatus; section?: string } = {},
    ): Observable<Enrollment[]> {
        return this.http.get<Enrollment[]>(`${this.course(courseId)}/enrollments`, {
            params: toParams(filter),
        });
    }

    addEnrollment(courseId: string, row: RosterRowInput): Observable<Enrollment> {
        return this.http.post<Enrollment>(
            `${this.course(courseId)}/enrollments`,
            row,
            this.skip(409),
        );
    }

    resendEnrollmentInvite(courseId: string, enrollmentId: string): Observable<void> {
        return this.http.post<void>(
            `${this.course(courseId)}/enrollments/${enrollmentId}/resend-invite`,
            {},
            this.skip(409),
        );
    }

    updateEnrollment(
        courseId: string,
        enrollmentId: string,
        patch: { status?: EnrollmentStatus; section?: string },
    ): Observable<Enrollment> {
        return this.http.patch<Enrollment>(
            `${this.course(courseId)}/enrollments/${enrollmentId}`,
            patch,
        );
    }
}

function toParams(values: object): HttpParams {
    let params = new HttpParams();
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params = params.set(key, String(value));
        }
    });
    return params;
}

/** Reads `{ message }` from an academy error body. */
export function academyErrorMessage(err: unknown, fallback: string): string {
    const body = (err as { error?: { message?: string | string[] } })?.error;
    const message = body?.message;
    if (Array.isArray(message)) {
        return message.join('; ');
    }
    return message || fallback;
}
