import {
    HttpErrorResponse,
    HttpEvent,
    HttpRequest,
    HttpResponse,
} from '@angular/common/http';
import { from, mergeMap, Observable, of, throwError, timer } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
    Course,
    CourseMission,
    Enrollment,
    Member,
    MemberRole,
    PublishChecklist,
    RosterImport,
    RosterImportDetail,
    RosterPreview,
    RosterRowError,
    RosterRowInput,
    RosterRowOutcome,
} from '../academy.model';
import {
    defaultRange,
    MOCK_COURSES,
    MOCK_LIBRARY,
    MOCK_STAFF,
    MOCK_STUDENTS,
    mockEnrollments,
    mockImports,
} from './academy-mock-fixtures';

/**
 * In-browser implementation of the academy API used behind the dev flag
 * `?academyMock=1`. It follows openapi/academy.yaml closely enough for the
 * screens to exercise every success and error path (409, 422, row errors).
 * State lives in sessionStorage so a reload keeps edits.
 */

interface PendingImport {
    detail: RosterImportDetail;
    preview: RosterPreview;
    dropMissing: boolean;
    sendInvites: boolean;
    commitStartedAt: number | null;
    applied: boolean;
}

interface MockState {
    members: Member[];
    courses: Course[];
    enrollments: Record<string, Enrollment[]>;
    imports: Record<string, RosterImport[]>;
    pending: Record<string, PendingImport>;
    publishedAt: Record<string, number>;
}

const STATE_KEY = 'academyMockState.v1';
const ROLE_KEY = 'academyRole';
const LATENCY_MS = 220;
const COMMIT_DURATION_MS = 4000;
const PROVISION_DURATION_MS = 5000;
const VM_QUOTA = 120;
const MAX_ROWS = 2000;

type Params = Record<string, string>;
type Handler = (
    req: HttpRequest<unknown>,
    params: Params,
    query: URLSearchParams,
) => Observable<HttpEvent<unknown>>;

export class AcademyMockBackend {
    private state: MockState = this.load();
    private readonly routes: [string, RegExp, Handler][] = [];

    constructor() {
        this.registerRoutes();
    }

    /** Remembers the role used for `GET /me` (from `?academyRole=`). */
    static readRoleOverride(): MemberRole {
        const param = new URLSearchParams(window.location.search).get(ROLE_KEY);
        const allowed: MemberRole[] = ['tenant_admin', 'professor', 'ta'];
        try {
            if (param && allowed.includes(param as MemberRole)) {
                sessionStorage.setItem(ROLE_KEY, param);
            }
            return (sessionStorage.getItem(ROLE_KEY) as MemberRole) || 'professor';
        } catch {
            return allowed.includes(param as MemberRole)
                ? (param as MemberRole)
                : 'professor';
        }
    }

    handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
        const parsed = new URL(req.urlWithParams, window.location.origin);
        const path = parsed.pathname.slice(parsed.pathname.indexOf('/academy/') + '/academy'.length);
        for (const [method, pattern, handler] of this.routes) {
            if (method !== req.method) {
                continue;
            }
            const match = pattern.exec(path);
            if (match) {
                return handler(req, match.groups ?? {}, parsed.searchParams);
            }
        }
        return this.error(req, 404, 'Not found');
    }

    // ---------------------------------------------------------------- routes

    private registerRoutes(): void {
        const t = '/tenants/(?<tenant>[a-z0-9-]+)';
        const c = `${t}/courses/(?<courseId>[0-9a-f-]+)`;
        const add = (method: string, path: string, handler: Handler) =>
            this.routes.push([method, new RegExp(`^${path}$`), handler.bind(this)]);

        add('GET', `${t}/me`, this.getMe);
        add('GET', `${t}/members`, this.listMembers);
        add('POST', `${t}/members`, this.inviteMember);
        add('PATCH', `${t}/members/(?<memberId>[0-9a-f-]+)`, this.patchMember);
        add('POST', `${t}/members/(?<memberId>[0-9a-f-]+)/resend-invite`, this.resendInvite);
        add('GET', `${t}/library/missions`, this.listLibrary);
        add('GET', `${t}/courses`, this.listCourses);
        add('POST', `${t}/courses`, this.createCourse);
        add('GET', c, this.getCourse);
        add('PATCH', c, this.patchCourse);
        add('DELETE', c, this.deleteCourse);
        add('POST', `${c}/publish`, this.publishCourse);
        add('POST', `${c}/archive`, this.archiveCourse);
        add('GET', `${c}/publish-checklist`, this.getChecklist);
        add('POST', `${c}/staff`, this.addStaff);
        add('DELETE', `${c}/staff`, this.removeStaff);
        add('POST', `${c}/enrollments/(?<enrollmentId>[0-9a-f-]+)/resend-invite`, this.resendEnrollmentInvite);
        add('GET', `${c}/range`, this.getRange);
        add('PUT', `${c}/range`, this.putRange);
        add('POST', `${c}/modules`, this.addModule);
        add('PATCH', `${c}/modules/(?<moduleId>[0-9a-f-]+)`, this.patchModule);
        add('DELETE', `${c}/modules/(?<moduleId>[0-9a-f-]+)`, this.deleteModule);
        add('POST', `${c}/modules/(?<moduleId>[0-9a-f-]+)/missions`, this.addMission);
        add('PATCH', `${c}/missions/(?<missionId>[0-9a-f-]+)`, this.patchMission);
        add('DELETE', `${c}/missions/(?<missionId>[0-9a-f-]+)`, this.deleteMission);
        add('GET', `${c}/roster/template.csv`, this.rosterTemplate);
        add('POST', `${c}/roster/preview`, this.rosterPreview);
        add('POST', `${c}/roster/commit`, this.rosterCommit);
        add('GET', `${c}/roster/imports`, this.listImports);
        add('GET', `${t}/roster-imports/(?<importId>[0-9a-f-]+)`, this.getImport);
        add('GET', `${t}/roster-imports/(?<importId>[0-9a-f-]+)/errors.csv`, this.importErrorsCsv);
        add('GET', `${c}/enrollments`, this.listEnrollments);
        add('POST', `${c}/enrollments`, this.addEnrollment);
        add('PATCH', `${c}/enrollments/(?<enrollmentId>[0-9a-f-]+)`, this.patchEnrollment);
    }

    // --------------------------------------------------------------- members

    private me(): Member {
        const role = AcademyMockBackend.readRoleOverride();
        const withRole = this.state.members.filter((m) => m.role === role);
        return withRole.find((m) => m.status === 'active') ?? withRole[0] ?? this.state.members[0];
    }

    private getMe(req: HttpRequest<unknown>) {
        return this.ok(req, this.me());
    }

    private listMembers(req: HttpRequest<unknown>, _p: Params, q: URLSearchParams) {
        const role = q.get('role');
        const status = q.get('status');
        const text = (q.get('q') ?? '').toLowerCase();
        const page = Number(q.get('page') ?? 0);
        const size = Number(q.get('size') ?? 50);
        const items = this.state.members.filter(
            (m) =>
                (!role || m.role === role) &&
                (!status || m.status === status) &&
                (!text ||
                    [m.displayName, m.email, m.rollNumber]
                        .filter(Boolean)
                        .some((v) => v.toLowerCase().includes(text))),
        );
        return this.ok(req, {
            items: items.slice(page * size, page * size + size),
            page,
            size,
            total: items.length,
        });
    }

    private inviteMember(req: HttpRequest<unknown>) {
        const body = req.body as { email: string; firstName: string; lastName?: string; role: MemberRole; department?: string };
        const email = (body.email ?? '').trim().toLowerCase();
        if (this.state.members.some((m) => m.email === email)) {
            return this.error(req, 409, 'Email or roll number already used in this tenant', 'member_exists');
        }
        const member: Member = {
            id: uuid(),
            role: body.role,
            status: 'invited',
            email,
            givenName: body.firstName,
            familyName: body.lastName ?? '',
            displayName: `${body.firstName} ${body.lastName ?? ''}`.trim(),
            rollNumber: null,
            department: body.department ?? null,
            invitedAt: new Date().toISOString(),
            activatedAt: null,
        };
        this.state.members.push(member);
        return this.save(req, member, 201);
    }

    private patchMember(req: HttpRequest<unknown>, p: Params) {
        const member = this.state.members.find((m) => m.id === p['memberId']);
        if (!member) {
            return this.error(req, 404, 'Member not found');
        }
        Object.assign(member, req.body);
        return this.save(req, member);
    }

    private resendInvite(req: HttpRequest<unknown>, p: Params) {
        const member = this.state.members.find((m) => m.id === p['memberId']);
        if (!member) {
            return this.error(req, 404, 'Member not found');
        }
        if (member.status !== 'invited') {
            return this.error(req, 409, 'Member has already signed in', 'already_active');
        }
        member.invitedAt = new Date().toISOString();
        return this.save(req, null, 204);
    }

    // --------------------------------------------------------------- courses

    private listLibrary(req: HttpRequest<unknown>, _p: Params, q: URLSearchParams) {
        const text = (q.get('q') ?? '').toLowerCase();
        return this.ok(
            req,
            MOCK_LIBRARY.filter(
                (m) =>
                    !text ||
                    m.title.toLowerCase().includes(text) ||
                    m.topics?.some((topic) => topic.toLowerCase().includes(text)),
            ),
        );
    }

    private listCourses(req: HttpRequest<unknown>, _p: Params, q: URLSearchParams) {
        const me = this.me();
        const status = q.get('status');
        const courses = this.state.courses
            .filter((c) => me.role === 'tenant_admin' || c.staff.some((s) => s.memberId === me.id))
            .filter((c) => !status || c.status === status)
            .map((c) => {
                const course = this.withCounts(c);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { modules, range, description, leaderboardEnabled, ...summary } = course;
                return summary;
            });
        return this.ok(req, courses);
    }

    private createCourse(req: HttpRequest<unknown>) {
        const body = req.body as Partial<Course>;
        const clash = this.state.courses.some(
            (c) => c.code === body.code && c.term === body.term && (c.section ?? '') === (body.section ?? ''),
        );
        if (clash) {
            return this.error(req, 409, 'Code, term and section already exist', 'course_exists');
        }
        const me = this.me();
        const course: Course = {
            id: uuid(),
            code: body.code,
            title: body.title,
            term: body.term,
            section: body.section ?? null,
            description: body.description ?? '',
            startsAt: body.startsAt ?? null,
            endsAt: body.endsAt ?? null,
            leaderboardEnabled: body.leaderboardEnabled ?? false,
            status: 'draft',
            enrolledCount: 0,
            missionCount: 0,
            staff: [{ memberId: me.id, displayName: me.displayName, role: 'owner' }],
            modules: [],
            range: defaultRange(),
        };
        this.state.courses.push(course);
        this.state.enrollments[course.id] = [];
        return this.save(req, this.withCounts(course), 201);
    }

    private getCourse(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        return course ? this.ok(req, this.withCounts(course)) : this.error(req, 404, 'Course not found');
    }

    private patchCourse(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        Object.assign(course, req.body);
        return this.save(req, this.withCounts(course));
    }

    private deleteCourse(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        if (course.status !== 'draft') {
            return this.error(req, 409, 'Course is not a draft', 'not_draft');
        }
        this.state.courses = this.state.courses.filter((c) => c !== course);
        return this.save(req, null, 204);
    }

    private publishCourse(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        const checklist = this.checklist(course);
        if (!checklist.ok) {
            return this.error(req, 422, 'Checklist failed', 'publish_checklist', checklist);
        }
        course.status = 'published';
        let instance = 9200;
        this.missions(course).forEach((m) => {
            if (!m.trainingInstanceId) {
                m.trainingInstanceId = ++instance + Math.floor(Math.random() * 500);
                m.poolId = m.trainingInstanceId - 8400;
                m.provisioning = 'pending';
            }
        });
        this.state.publishedAt[course.id] = Date.now();
        return this.save(req, this.withCounts(course));
    }

    private getChecklist(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        return course ? this.ok(req, this.checklist(course)) : this.error(req, 404, 'Course not found');
    }

    private addStaff(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        const body = req.body as { memberId: string; role: 'instructor' | 'ta' };
        const member = this.state.members.find((m) => m.id === body.memberId);
        if (!member || !['professor', 'ta', 'tenant_admin'].includes(member.role)) {
            return this.error(req, 400, 'Only staff can be added to a course');
        }
        if (course.staff.some((s) => s.memberId === member.id)) {
            return this.error(req, 409, 'Already on this course', 'already_staff');
        }
        course.staff.push({ memberId: member.id, displayName: member.displayName, role: body.role });
        return this.save(req, course.staff, 201);
    }

    private removeStaff(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        const memberId = (req.body as { memberId: string })?.memberId;
        const entry = course.staff.find((s) => s.memberId === memberId);
        if (entry?.role === 'owner') {
            return this.error(req, 409, 'The course owner cannot be removed', 'owner');
        }
        course.staff = course.staff.filter((s) => s.memberId !== memberId);
        return this.save(req, null, 204);
    }

    private resendEnrollmentInvite(req: HttpRequest<unknown>, p: Params) {
        const enrollment = (this.state.enrollments[p['courseId']] ?? []).find((e) => e.id === p['enrollmentId']);
        if (!enrollment) {
            return this.error(req, 404, 'Enrollment not found');
        }
        if (enrollment.member.status !== 'invited') {
            return this.error(req, 409, 'This person has already signed in', 'already_active');
        }
        return this.save(req, null, 204);
    }

    private archiveCourse(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        course.status = 'archived';
        return this.save(req, this.withCounts(course));
    }

    private getRange(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        return course ? this.ok(req, course.range) : this.error(req, 404, 'Course not found');
    }

    private putRange(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        course.range = { ...defaultRange(), ...(req.body as object) };
        return this.save(req, course.range);
    }

    private addModule(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        const body = req.body as { title: string; unlocksAt?: string; dueAt?: string };
        const module = {
            id: uuid(),
            title: body.title,
            position: course.modules.length,
            unlocksAt: body.unlocksAt ?? null,
            dueAt: body.dueAt ?? null,
            missions: [],
        };
        course.modules.push(module);
        return this.save(req, module, 201);
    }

    private patchModule(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        const module = course?.modules.find((m) => m.id === p['moduleId']);
        if (!module) {
            return this.error(req, 404, 'Module not found');
        }
        const body = req.body as { position?: number };
        Object.assign(module, req.body);
        if (body.position !== undefined) {
            reorder(course.modules, module, body.position);
        }
        return this.save(req, module);
    }

    private deleteModule(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        course.modules = course.modules.filter((m) => m.id !== p['moduleId']);
        course.modules.forEach((m, i) => (m.position = i));
        return this.save(req, null, 204);
    }

    private addMission(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        const module = course?.modules.find((m) => m.id === p['moduleId']);
        if (!module) {
            return this.error(req, 404, 'Module not found');
        }
        const body = req.body as Partial<CourseMission>;
        const lib = MOCK_LIBRARY.find((m) => m.trainingDefinitionId === body.trainingDefinitionId);
        if (!lib) {
            return this.error(req, 400, 'Unknown training definition');
        }
        const mission: CourseMission = {
            id: uuid(),
            trainingDefinitionId: lib.trainingDefinitionId,
            title: lib.title,
            position: module.missions.length,
            points: body.points ?? 100,
            dueAt: body.dueAt ?? null,
            attemptsAllowed: body.attemptsAllowed ?? 1,
            required: body.required ?? true,
            hintPolicy: body.hintPolicy ?? 'penalized',
            trainingInstanceId: null,
            poolId: null,
            sandboxDefinitionId: lib.sandboxDefinitionId ?? null,
        };
        module.missions.push(mission);
        return this.save(req, mission, 201);
    }

    private patchMission(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        const module = course?.modules.find((m) => m.missions.some((x) => x.id === p['missionId']));
        const mission = module?.missions.find((x) => x.id === p['missionId']);
        if (!mission) {
            return this.error(req, 404, 'Mission not found');
        }
        const body = req.body as Partial<CourseMission>;
        if (body.trainingDefinitionId && course.status !== 'draft' && body.trainingDefinitionId !== mission.trainingDefinitionId) {
            return this.error(req, 409, 'Mission cannot change after publish');
        }
        Object.assign(mission, body);
        if (body.position !== undefined) {
            reorder(module.missions, mission, body.position);
        }
        return this.save(req, mission);
    }

    private deleteMission(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        course.modules.forEach((m) => {
            m.missions = m.missions.filter((x) => x.id !== p['missionId']);
            m.missions.forEach((x, i) => (x.position = i));
        });
        return this.save(req, null, 204);
    }

    // ---------------------------------------------------------------- roster

    private rosterTemplate(req: HttpRequest<unknown>) {
        return this.ok(
            req,
            'email,first_name,last_name,roll_number,section,role\n' +
                'aditya.sharma@learners.deployopen.com,Aditya,Sharma,22BCE1101,L1,student\n',
        );
    }

    private rosterPreview(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        return from(readCsvBody(req.body)).pipe(
            mergeMap(({ name, text }) => {
                const parsed = parseCsv(text.replace(/^\uFEFF/, ''));
                if (parsed.length === 0) {
                    return this.error(req, 400, 'The file is empty');
                }
                const [header, ...rows] = parsed;
                const body = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
                if (body.length > MAX_ROWS) {
                    return this.error(req, 400, `The file has ${body.length} rows; the limit is ${MAX_ROWS}`, 'too_many_rows');
                }
                const mapping = mapHeaders(header);
                const fields = new Set(Object.values(mapping));
                const missing = [
                    !fields.has('email') && 'email',
                    !fields.has('first_name') && !fields.has('name') && 'first_name',
                    !fields.has('roll_number') && 'roll_number',
                ].filter(Boolean);
                if (missing.length) {
                    return this.error(req, 400, `Missing required columns: ${missing.join(', ')}`, 'missing_columns');
                }
                const preview = this.buildPreview(course, name, header, mapping, body);
                return this.save(req, preview);
            }),
        );
    }

    private buildPreview(
        course: Course,
        fileName: string,
        header: string[],
        mapping: Record<string, string>,
        rows: string[][],
    ): RosterPreview {
        const seenEmail = new Set<string>();
        const seenRoll = new Set<string>();
        const enrolled = this.state.enrollments[course.id] ?? [];
        const outcomes: RosterRowOutcome[] = rows.map((cells, i) => {
            const row = normalizeRow(header, mapping, cells);
            const errors: RosterRowError[] = [];
            const role = row.role ?? 'student';
            if (!row.email) {
                errors.push({ code: 'missing_email', field: 'email', message: 'Email is required' });
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
                errors.push({ code: 'invalid_email', field: 'email', message: `"${row.email}" is not a valid email` });
            } else if (seenEmail.has(row.email)) {
                errors.push({ code: 'duplicate_email_in_file', field: 'email', message: 'This email appears earlier in the file' });
            }
            if (!row.firstName) {
                errors.push({ code: 'missing_first_name', field: 'firstName', message: 'First name is required' });
            }
            if (!row.rollNumber && role === 'student') {
                errors.push({ code: 'missing_roll_number', field: 'rollNumber', message: 'Roll number is required for students' });
            } else if (row.rollNumber && seenRoll.has(row.rollNumber)) {
                errors.push({ code: 'duplicate_roll_in_file', field: 'rollNumber', message: 'This roll number appears earlier in the file' });
            }
            if ((row.firstName ?? '').length > 80 || (row.lastName ?? '').length > 80 || (row.rollNumber ?? '').length > 32 || (row.section ?? '').length > 40) {
                errors.push({ code: 'too_long', message: 'A value is longer than allowed' });
            }
            const existingByEmail = this.state.members.find((m) => m.email === row.email);
            const existingByRoll = row.rollNumber ? this.state.members.find((m) => m.rollNumber === row.rollNumber) : undefined;
            if (existingByRoll && existingByRoll.email !== row.email) {
                errors.push({ code: 'roll_belongs_to_other_member', field: 'rollNumber', message: `Roll number belongs to ${existingByRoll.email}` });
            }
            if (existingByEmail && !['student', 'ta'].includes(existingByEmail.role)) {
                errors.push({ code: 'email_belongs_to_other_role', field: 'email', message: `This email is a ${existingByEmail.role.replace('_', ' ')} in this tenant` });
            }
            if (row.email) seenEmail.add(row.email);
            if (row.rollNumber) seenRoll.add(row.rollNumber);

            let outcome: RosterRowOutcome['outcome'] = 'create';
            if (errors.length) {
                outcome = 'error';
            } else if (existingByEmail) {
                const enrollment = enrolled.find((e) => e.member.id === existingByEmail.id && e.status !== 'dropped');
                if (!enrollment) {
                    outcome = 'enroll';
                } else {
                    const changed =
                        (row.section ?? null) !== (enrollment.section ?? null) ||
                        row.firstName !== existingByEmail.givenName ||
                        (row.lastName ?? '') !== (existingByEmail.familyName ?? '');
                    outcome = changed ? 'update' : 'unchanged';
                }
            }
            return { rowNumber: i + 1, normalized: row, outcome, errors };
        });
        const count = (o: string) => outcomes.filter((r) => r.outcome === o).length;
        const fileEmails = new Set(outcomes.map((r) => r.normalized.email));
        const id = uuid();
        const preview: RosterPreview = {
            importId: id,
            fileName,
            detectedColumns: mapping,
            counts: {
                total: outcomes.length,
                create: count('create'),
                update: count('update'),
                enroll: count('enroll'),
                unchanged: count('unchanged'),
                error: count('error'),
                missingFromFile: enrolled.filter((e) => e.status !== 'dropped' && !fileEmails.has(e.member.email)).length,
            },
            rows: outcomes,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
        this.state.pending[id] = {
            preview,
            dropMissing: false,
            sendInvites: true,
            commitStartedAt: null,
            applied: false,
            detail: {
                id,
                courseId: course.id,
                fileName,
                status: 'previewed',
                rowCount: outcomes.length,
                created: 0,
                updated: 0,
                enrolled: 0,
                dropped: 0,
                skipped: 0,
                failed: 0,
                uploadedBy: this.me().displayName,
                createdAt: new Date().toISOString(),
                completedAt: null,
                rows: outcomes,
            },
        };
        return preview;
    }

    private rosterCommit(req: HttpRequest<unknown>, p: Params) {
        const body = req.body as { importId: string; dropMissing?: boolean; sendInvites?: boolean };
        const pending = this.state.pending[body.importId];
        if (!pending || pending.detail.courseId !== p['courseId'] || pending.commitStartedAt) {
            return this.error(req, 409, 'Preview already committed or expired', 'preview_used');
        }
        if (new Date(pending.preview.expiresAt).getTime() < Date.now()) {
            return this.error(req, 409, 'Preview already committed or expired', 'preview_expired');
        }
        pending.dropMissing = !!body.dropMissing;
        pending.sendInvites = body.sendInvites !== false;
        pending.commitStartedAt = Date.now();
        pending.detail.status = 'committing';
        const list = (this.state.imports[p['courseId']] ??= []);
        list.unshift(this.summary(pending.detail));
        return this.save(req, this.summary(pending.detail), 202);
    }

    private listImports(req: HttpRequest<unknown>, p: Params) {
        const list = (this.state.imports[p['courseId']] ?? []).map((i) => {
            const pending = this.state.pending[i.id];
            return pending ? this.summary(this.progress(pending)) : i;
        });
        return this.ok(req, list);
    }

    private getImport(req: HttpRequest<unknown>, p: Params) {
        const pending = this.state.pending[p['importId']];
        if (pending) {
            const detail = this.progress(pending);
            this.persist();
            return this.ok(req, detail);
        }
        const done = Object.values(this.state.imports).flat().find((i) => i.id === p['importId']);
        return done ? this.ok(req, { ...done, rows: [] }) : this.error(req, 404, 'Import not found');
    }

    private importErrorsCsv(req: HttpRequest<unknown>, p: Params) {
        const pending = this.state.pending[p['importId']];
        const rows = pending?.detail.rows.filter((r) => r.outcome === 'error') ?? [];
        const lines = ['row,email,roll_number,error_code,message'].concat(
            rows.flatMap((r) =>
                (r.errors ?? []).map((e) =>
                    [r.rowNumber, r.normalized.email ?? '', r.normalized.rollNumber ?? '', e.code, `"${(e.message ?? '').replace(/"/g, '""')}"`].join(','),
                ),
            ),
        );
        return this.ok(req, lines.join('\n') + '\n');
    }

    /** Advances a committing import by elapsed time and applies it when done. */
    private progress(pending: PendingImport): RosterImportDetail {
        const detail = pending.detail;
        if (!pending.commitStartedAt || pending.applied) {
            return detail;
        }
        const fraction = Math.min(1, (Date.now() - pending.commitStartedAt) / COMMIT_DURATION_MS);
        const processed = detail.rows.slice(0, Math.ceil(fraction * detail.rows.length));
        const count = (o: string) => processed.filter((r) => r.outcome === o).length;
        detail.created = count('create');
        detail.updated = count('update');
        detail.enrolled = count('create') + count('enroll');
        detail.skipped = count('unchanged');
        detail.failed = count('error');
        detail.processed = processed.length;
        if (fraction >= 1) {
            this.apply(pending);
            detail.status = 'completed';
            detail.completedAt = new Date().toISOString();
            pending.applied = true;
        }
        const list = this.state.imports[detail.courseId] ?? [];
        const index = list.findIndex((i) => i.id === detail.id);
        if (index >= 0) {
            list[index] = this.summary(detail);
        }
        return detail;
    }

    private apply(pending: PendingImport): void {
        const courseId = pending.detail.courseId;
        const enrollments = (this.state.enrollments[courseId] ??= []);
        const fileEmails = new Set<string>();
        pending.detail.rows
            .filter((r) => r.outcome !== 'error')
            .forEach((r) => {
                const row = r.normalized as RosterRowInput;
                fileEmails.add(row.email);
                let member = this.state.members.find((m) => m.email === row.email);
                if (!member) {
                    member = {
                        id: uuid(),
                        role: row.role ?? 'student',
                        status: 'invited',
                        email: row.email,
                        givenName: row.firstName,
                        familyName: row.lastName ?? '',
                        displayName: `${row.firstName} ${row.lastName ?? ''}`.trim(),
                        rollNumber: row.rollNumber || null,
                        department: null,
                        invitedAt: new Date().toISOString(),
                        activatedAt: null,
                    };
                    this.state.members.push(member);
                } else {
                    member.givenName = row.firstName;
                    member.familyName = row.lastName ?? '';
                    member.displayName = `${row.firstName} ${row.lastName ?? ''}`.trim();
                }
                const existing = enrollments.find((e) => e.member.id === member.id);
                if (existing) {
                    existing.section = row.section ?? null;
                    existing.member = member;
                    if (existing.status === 'dropped') {
                        existing.status = member.status === 'active' ? 'active' : 'invited';
                    }
                } else {
                    enrollments.push({
                        id: uuid(),
                        status: member.status === 'active' ? 'active' : 'invited',
                        section: row.section ?? null,
                        source: 'csv',
                        enrolledAt: new Date().toISOString(),
                        member,
                    });
                }
            });
        if (pending.dropMissing) {
            enrollments
                .filter((e) => e.status !== 'dropped' && !fileEmails.has(e.member.email) && e.member.role === 'student')
                .forEach((e) => {
                    e.status = 'dropped';
                    pending.detail.dropped++;
                });
        }
    }

    private listEnrollments(req: HttpRequest<unknown>, p: Params, q: URLSearchParams) {
        const status = q.get('status');
        const section = q.get('section');
        const list = (this.state.enrollments[p['courseId']] ?? []).filter(
            (e) => (!status || e.status === status) && (!section || e.section === section),
        );
        return this.ok(req, list);
    }

    private addEnrollment(req: HttpRequest<unknown>, p: Params) {
        const course = this.course(p);
        if (!course) {
            return this.error(req, 404, 'Course not found');
        }
        const row = req.body as RosterRowInput;
        const email = row.email.trim().toLowerCase();
        const enrollments = (this.state.enrollments[course.id] ??= []);
        let member = this.state.members.find((m) => m.email === email);
        if (member && enrollments.some((e) => e.member.id === member.id && e.status !== 'dropped')) {
            return this.error(req, 409, 'This person is already enrolled', 'already_enrolled');
        }
        const rollOwner = this.state.members.find((m) => m.rollNumber === row.rollNumber);
        if (rollOwner && rollOwner.email !== email) {
            return this.error(req, 409, `Roll number belongs to ${rollOwner.email}`, 'roll_belongs_to_other_member');
        }
        if (!member) {
            member = {
                id: uuid(),
                role: row.role ?? 'student',
                status: 'invited',
                email,
                givenName: row.firstName,
                familyName: row.lastName ?? '',
                displayName: `${row.firstName} ${row.lastName ?? ''}`.trim(),
                rollNumber: row.rollNumber,
                department: null,
                invitedAt: new Date().toISOString(),
                activatedAt: null,
            };
            this.state.members.push(member);
        }
        const enrollment: Enrollment = {
            id: uuid(),
            status: member.status === 'active' ? 'active' : 'invited',
            section: row.section ?? null,
            source: 'manual',
            enrolledAt: new Date().toISOString(),
            member,
        };
        enrollments.push(enrollment);
        return this.save(req, enrollment, 201);
    }

    private patchEnrollment(req: HttpRequest<unknown>, p: Params) {
        const enrollment = (this.state.enrollments[p['courseId']] ?? []).find((e) => e.id === p['enrollmentId']);
        if (!enrollment) {
            return this.error(req, 404, 'Enrollment not found');
        }
        Object.assign(enrollment, req.body);
        return this.save(req, enrollment);
    }

    // --------------------------------------------------------------- helpers

    private course(p: Params): Course | undefined {
        return this.state.courses.find((c) => c.id === p['courseId']);
    }

    private missions(course: Course): CourseMission[] {
        return course.modules.flatMap((m) => m.missions);
    }

    private withCounts(course: Course): Course {
        const publishedAt = this.state.publishedAt[course.id];
        if (publishedAt && Date.now() - publishedAt > PROVISION_DURATION_MS) {
            this.missions(course).forEach((m) => {
                if (m.provisioning === 'pending') {
                    m.provisioning = 'ready';
                }
            });
        }
        course.modules.sort((a, b) => a.position - b.position);
        course.modules.forEach((m) => m.missions.sort((a, b) => a.position - b.position));
        course.enrolledCount = (this.state.enrollments[course.id] ?? []).filter((e) => e.status !== 'dropped').length;
        course.missionCount = this.missions(course).length;
        return structuredClone(course);
    }

    private checklist(course: Course): PublishChecklist {
        const missions = this.missions(course);
        const emptyModules = course.modules.filter((m) => m.missions.length === 0);
        const start = course.startsAt ? Date.parse(course.startsAt) : NaN;
        const end = course.endsAt ? Date.parse(course.endsAt) : NaN;
        const lateModules = course.modules.filter((m) => m.dueAt && !isNaN(end) && Date.parse(m.dueAt) > end);
        const enrolled = (this.state.enrollments[course.id] ?? []).filter((e) => e.status !== 'dropped').length;
        const demand = (course.range.maxConcurrent ?? enrolled) + course.range.poolBuffer;
        const noSandbox = missions.filter((m) => !m.sandboxDefinitionId);
        const items: PublishChecklist['items'] = [
            {
                key: 'has_missions',
                ok: missions.length > 0 && emptyModules.length === 0,
                message:
                    missions.length === 0
                        ? 'Add at least one mission'
                        : emptyModules.length
                          ? `Module "${emptyModules[0].title}" has no missions`
                          : `${missions.length} missions in ${course.modules.length} modules`,
            },
            {
                key: 'dates_valid',
                ok: !isNaN(start) && !isNaN(end) && start < end && lateModules.length === 0,
                message:
                    isNaN(start) || isNaN(end)
                        ? 'Set the course start and end dates'
                        : start >= end
                          ? 'The course must end after it starts'
                          : lateModules.length
                            ? `Module "${lateModules[0].title}" is due after the course ends`
                            : 'Course and module dates are consistent',
            },
            {
                key: 'quota_fits',
                ok: demand <= VM_QUOTA,
                message: `${demand} concurrent sandboxes needed of ${VM_QUOTA} allowed`,
            },
            {
                key: 'missions_have_sandbox',
                ok: noSandbox.length === 0,
                message: noSandbox.length ? `"${noSandbox[0].title}" has no sandbox definition` : 'Every mission has a sandbox definition',
            },
            {
                key: 'staff_present',
                ok: course.staff.some((s) => s.role === 'owner'),
                message: course.staff.some((s) => s.role === 'owner') ? 'Course has an owner' : 'Assign a course owner',
            },
        ];
        return { ok: items.every((i) => i.ok), items };
    }

    private summary(detail: RosterImportDetail): RosterImport {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { rows, ...rest } = detail;
        return { ...rest };
    }

    private ok(req: HttpRequest<unknown>, body: unknown, status = 200): Observable<HttpEvent<unknown>> {
        return of(new HttpResponse({ status, body: structuredClone(body), url: req.url })).pipe(delay(LATENCY_MS));
    }

    private save(req: HttpRequest<unknown>, body: unknown, status = 200) {
        this.persist();
        return this.ok(req, body, status);
    }

    private error(
        req: HttpRequest<unknown>,
        status: number,
        message: string,
        code?: string,
        body?: unknown,
    ): Observable<never> {
        return timer(LATENCY_MS).pipe(
            mergeMap(() =>
                throwError(
                    () =>
                        new HttpErrorResponse({
                            status,
                            statusText: message,
                            url: req.url,
                            error: body ?? { statusCode: status, message, code },
                        }),
                ),
            ),
        );
    }

    private load(): MockState {
        try {
            const raw = sessionStorage.getItem(STATE_KEY);
            if (raw) {
                return JSON.parse(raw) as MockState;
            }
        } catch {
            // fall through to the seed
        }
        return {
            members: [...MOCK_STAFF, ...MOCK_STUDENTS].map((m) => ({ ...m })),
            courses: structuredClone(MOCK_COURSES),
            enrollments: mockEnrollments(),
            imports: mockImports(),
            pending: {},
            publishedAt: {},
        };
    }

    private persist(): void {
        try {
            sessionStorage.setItem(STATE_KEY, JSON.stringify(this.state));
        } catch {
            // storage full or blocked: keep the in-memory state
        }
    }
}

// ------------------------------------------------------------------- CSV

async function readCsvBody(body: unknown): Promise<{ name: string; text: string }> {
    if (body instanceof FormData) {
        const file = body.get('file');
        if (file instanceof File) {
            return { name: file.name, text: await file.text() };
        }
    }
    if (typeof body === 'string') {
        return { name: 'roster.csv', text: body };
    }
    if (body instanceof Blob) {
        return { name: 'roster.csv', text: await body.text() };
    }
    return { name: 'roster.csv', text: '' };
}

/** RFC 4180 parser: quoted fields, doubled quotes, CRLF. */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') {
                cell += '"';
                i++;
            } else if (ch === '"') {
                quoted = false;
            } else {
                cell += ch;
            }
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            row.push(cell);
            cell = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') {
                i++;
            }
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += ch;
        }
    }
    if (cell !== '' || row.length) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
    email: ['email', 'e mail', 'email address', 'mail', 'email id'],
    first_name: ['first name', 'firstname', 'given name'],
    last_name: ['last name', 'lastname', 'surname', 'family name'],
    name: ['name', 'full name', 'student name'],
    roll_number: ['roll number', 'roll no', 'roll', 'reg no', 'regno', 'registration number', 'register number', 'student id'],
    section: ['section', 'lab section', 'batch'],
    role: ['role'],
};

function mapHeaders(header: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    header.forEach((raw) => {
        const key = raw.toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim();
        const field = Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.includes(key))?.[0];
        if (field) {
            mapping[raw] = field;
        }
    });
    return mapping;
}

function normalizeRow(
    header: string[],
    mapping: Record<string, string>,
    cells: string[],
): Partial<RosterRowInput> {
    const value = (field: string) => {
        const index = header.findIndex((h) => mapping[h] === field);
        return index >= 0 ? (cells[index] ?? '').trim() : '';
    };
    let firstName = value('first_name');
    let lastName = value('last_name');
    const name = value('name');
    if (!firstName && name) {
        const cut = name.lastIndexOf(' ');
        firstName = cut > 0 ? name.slice(0, cut) : name;
        lastName = cut > 0 ? name.slice(cut + 1) : '';
    }
    const role = value('role').toLowerCase();
    return {
        email: value('email').toLowerCase(),
        firstName,
        lastName,
        rollNumber: value('roll_number').toUpperCase(),
        section: value('section') || undefined,
        role: role === 'ta' ? 'ta' : 'student',
    };
}

function reorder<T extends { position?: number }>(list: T[], item: T, position: number): void {
    const without = list.filter((x) => x !== item);
    without.splice(Math.max(0, Math.min(position, without.length)), 0, item);
    without.forEach((x, i) => (x.position = i));
    list.splice(0, list.length, ...without);
}

function uuid(): string {
    return crypto.randomUUID();
}
