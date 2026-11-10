import {
    AdminConfig,
    Branding,
    Course,
    CourseRange,
    Enrollment,
    LibraryMission,
    Member,
    RosterImport,
} from '../academy.model';

/**
 * Seed state for the in-browser academy mock (dev flag `?academyMock=1`).
 * Mirrors the VIT seed in strategy/university-range-plan.md section 7.
 */

/** Stacked logo sized for the 140px navigation rail. */
const stackedLogo = (line1: string, line2: string, color: string) =>
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">` +
            `<rect x="70" y="4" width="60" height="60" rx="6" fill="${color}"/>` +
            `<text x="100" y="47" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="700" fill="#ffffff" text-anchor="middle">${line1.charAt(0)}</text>` +
            `<text x="100" y="102" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="700" fill="#14213d" text-anchor="middle">${line1}</text>` +
            `<text x="100" y="136" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="500" fill="#14213d" text-anchor="middle">${line2}</text>` +
            `</svg>`,
    );

const mark = (color: string) =>
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
            `<rect width="32" height="32" rx="4" fill="${color}"/>` +
            `<text x="16" y="23" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="700" fill="#ffffff" text-anchor="middle">V</text>` +
            `</svg>`,
    );

export const MOCK_BRANDING: Branding = {
    productName: 'VIT Cyber Range',
    legalName: 'Vellore Institute of Technology',
    logoUrl: stackedLogo('VIT', 'Cyber Range', '#1f3c88'),
    markUrl: mark('#1f3c88'),
    faviconUrl: mark('#1f3c88'),
    colorPrimary: '#1f3c88',
    colorOnPrimary: '#ffffff',
    colorAccent: '#f2a900',
    supportEmail: 'range-support@deployopen.com',
    emailFromName: 'VIT Cyber Range',
};

export function mockAdminConfig(): AdminConfig {
    return {
        tenant: 'vit',
        title: 'VIT Cyber Range Admin',
        timezone: 'Asia/Kolkata',
        branding: MOCK_BRANDING,
        authConfig: {
            providers: [
                {
                    label: 'Sign in with VIT Cyber Range',
                    issuer: 'http://localhost:8180/realms/campus',
                    clientId: 'vit-admin',
                    scope: 'openid email profile organization offline_access',
                    logoutUrl:
                        'http://localhost:8180/realms/campus/protocol/openid-connect/logout',
                },
            ],
        },
    };
}

const STAFF_DOMAIN = 'staff.deployopen.com';
const LEARNER_DOMAIN = 'learners.deployopen.com';

function member(
    id: string,
    role: Member['role'],
    givenName: string,
    familyName: string,
    status: Member['status'],
    extra: Partial<Member> = {},
): Member {
    const local = [givenName, familyName].filter(Boolean).join('.')
        .toLowerCase()
        .replace(/[^a-z.]/g, '');
    return {
        id,
        role,
        status,
        givenName,
        familyName,
        displayName: `${givenName} ${familyName}`.trim(),
        email: `${local}@${role === 'student' ? LEARNER_DOMAIN : STAFF_DOMAIN}`,
        rollNumber: null,
        department: 'School of Computer Science and Engineering',
        invitedAt: '2026-07-14T09:30:00Z',
        activatedAt: status === 'active' ? '2026-07-15T04:12:00Z' : null,
        ...extra,
    };
}

export const MOCK_STAFF: Member[] = [
    member('7d1f1c1e-0a51-4d0e-9c43-0a0000000001', 'tenant_admin', 'Kavitha', 'Raman', 'active'),
    member('7d1f1c1e-0a51-4d0e-9c43-0a0000000002', 'professor', 'Arun', 'Prakash', 'active'),
    member('7d1f1c1e-0a51-4d0e-9c43-0a0000000003', 'professor', 'Meera', 'Krishnan', 'active'),
    member('7d1f1c1e-0a51-4d0e-9c43-0a0000000004', 'professor', 'Sanjay', 'Iyer', 'invited', { activatedAt: null }),
    member('7d1f1c1e-0a51-4d0e-9c43-0a0000000005', 'ta', 'Divya', 'Natarajan', 'active'),
    member('7d1f1c1e-0a51-4d0e-9c43-0a0000000006', 'ta', 'Rahul', 'Menon', 'invited', { activatedAt: null }),
];

const STUDENT_NAMES: [string, string][] = [
    ['Aditya', 'Sharma'],
    ['Priya', 'Venkatesh'],
    ['Karthik', 'Subramanian'],
    ['Sneha', 'Reddy'],
    ['Vikram', 'Joshi'],
    ['Ananya', 'Pillai'],
    ['Rohan', 'Gupta'],
    ['Lakshmi', ''],
    ['Harish', 'Kumar'],
    ['Nandini', 'Rao'],
    ['Siddharth', 'Bose'],
    ['Ishita', 'Chatterjee'],
];

export const MOCK_STUDENTS: Member[] = STUDENT_NAMES.map(([g, f], i) =>
    member(
        `5a2e9b10-77c4-4f5e-8d21-1b00000000${String(i + 10).padStart(2, '0')}`,
        'student',
        g,
        f,
        i % 4 === 3 ? 'invited' : 'active',
        { rollNumber: `22BCE1${String(101 + i * 7).padStart(3, '0')}` },
    ),
);

const lib = (
    id: number,
    title: string,
    minutes: number,
    levels: number,
    topics: string[],
    mitre: string[],
    description: string,
): LibraryMission => ({
    trainingDefinitionId: id,
    title,
    description,
    source: 'library',
    estimatedDurationMinutes: minutes,
    levels,
    maxScore: levels * 25,
    sandboxDefinitionId: 300 + id,
    topics,
    mitreTechniques: mitre,
});

export const MOCK_LIBRARY: LibraryMission[] = [
    lib(41, 'Web Directory Discovery', 40, 4, ['Reconnaissance', 'Web'], ['T1595.003'], 'Enumerate hidden paths on a web server and report exposed content.'),
    lib(42, 'SSH Hardening Basics', 45, 4, ['Secure configuration', 'Linux'], ['T1021.004'], 'Harden an OpenSSH server against password guessing and weak ciphers.'),
    lib(43, 'Firewall Baseline Review', 50, 5, ['Secure configuration', 'Network'], ['T1562.004'], 'Audit host firewall rules against a documented baseline.'),
    lib(44, 'Vulnerability Remediation Prioritization', 60, 5, ['Vulnerability management'], ['T1190'], 'Rank scanner findings by exploitability and business impact.'),
    lib(45, 'SSH Weak Password Basics', 35, 3, ['Credentials', 'Linux'], ['T1110.001'], 'Find and exploit a weak SSH password, then fix it.'),
    lib(46, 'Command Injection Basics', 45, 4, ['Web', 'Exploitation'], ['T1059.004'], 'Exploit an unsanitized shell call in a web form.'),
    lib(47, 'Sudo Misconfiguration Privilege Escalation', 50, 4, ['Privilege escalation', 'Linux'], ['T1548.003'], 'Escalate to root through a permissive sudoers entry.'),
    lib(48, 'Phishing Email Triage', 40, 4, ['SOC', 'Email'], ['T1566.001'], 'Triage a reported phishing email and extract indicators.'),
    lib(49, 'Cloud IAM Alert Triage', 45, 4, ['SOC', 'Cloud'], ['T1078.004'], 'Investigate an IAM alert for suspicious key usage.'),
    lib(50, 'Log Detection Rule Tuning', 55, 5, ['Detection', 'SIEM'], ['T1562.001'], 'Tune a noisy detection rule without losing true positives.'),
    lib(51, 'Windows Authentication Brute Force', 45, 4, ['Detection', 'Windows'], ['T1110'], 'Detect a password spraying attack in Windows security logs.'),
    lib(52, 'DNS Exfiltration Basics', 50, 4, ['Network forensics'], ['T1048.003'], 'Spot data leaving the network through DNS queries.'),
    lib(53, 'Firewall Beaconing Review', 45, 4, ['Network forensics'], ['T1071'], 'Find periodic command and control beacons in firewall logs.'),
    lib(54, 'Web Shell Triage', 50, 4, ['Network forensics', 'Web'], ['T1505.003'], 'Locate and contain a web shell on a compromised server.'),
];

const DEFAULT_RANGE: CourseRange = {
    mode: 'per_student',
    poolBuffer: 3,
    maxConcurrent: null,
    vmSizeProfile: 'standard',
    idleTimeoutMinutes: 60,
    labWindows: [],
    teardownAt: null,
};

export function defaultRange(): CourseRange {
    return { ...DEFAULT_RANGE, labWindows: [] };
}

const libTitle = (id: number) =>
    MOCK_LIBRARY.find((m) => m.trainingDefinitionId === id)?.title ?? `Mission ${id}`;

let missionSeq = 0;
const cm = (
    defId: number,
    position: number,
    extra: Partial<Course['modules'][number]['missions'][number]> = {},
) => ({
    id: `c0ffee00-0000-4000-8000-${String(++missionSeq).padStart(12, '0')}`,
    trainingDefinitionId: defId,
    title: libTitle(defId),
    position,
    points: 100,
    dueAt: null,
    attemptsAllowed: 2,
    required: true,
    hintPolicy: 'penalized' as const,
    trainingInstanceId: null,
    poolId: null,
    sandboxDefinitionId: 300 + defId,
    ...extra,
});

const [admin, arun, meera, sanjay, divya] = MOCK_STAFF;

export const MOCK_COURSES: Course[] = [
    {
        id: 'a1b2c3d4-0000-4000-8000-000000003501',
        code: 'CSE3501',
        title: 'Information Security Analysis and Audit',
        term: 'Fall 2026',
        section: 'A1',
        status: 'published',
        startsAt: '2026-07-20T00:00:00Z',
        endsAt: '2026-11-28T00:00:00Z',
        enrolledCount: 0,
        missionCount: 0,
        staff: [
            { memberId: arun.id, displayName: arun.displayName, role: 'owner' },
            { memberId: divya.id, displayName: divya.displayName, role: 'ta' },
        ],
        description:
            'Hands-on assessment of systems and networks: reconnaissance, secure configuration and vulnerability management.',
        leaderboardEnabled: false,
        range: { ...DEFAULT_RANGE, labWindows: [{ weekday: 2, start: '14:00', end: '16:00', timezone: 'Asia/Kolkata' }] },
        modules: [
            {
                id: 'b0000000-0000-4000-8000-000000000101',
                title: 'Reconnaissance',
                position: 0,
                unlocksAt: '2026-07-20T00:00:00Z',
                dueAt: '2026-08-10T18:29:00Z',
                missions: [cm(41, 0, { trainingInstanceId: 9101, poolId: 701, provisioning: 'ready' })],
            },
            {
                id: 'b0000000-0000-4000-8000-000000000102',
                title: 'Secure configuration',
                position: 1,
                unlocksAt: '2026-08-11T00:00:00Z',
                dueAt: '2026-09-14T18:29:00Z',
                missions: [
                    cm(42, 0, { trainingInstanceId: 9102, poolId: 702, provisioning: 'ready' }),
                    cm(43, 1, { trainingInstanceId: 9103, poolId: 703, provisioning: 'ready', points: 150 }),
                ],
            },
            {
                id: 'b0000000-0000-4000-8000-000000000103',
                title: 'Vulnerability management',
                position: 2,
                unlocksAt: '2026-09-15T00:00:00Z',
                dueAt: '2026-10-26T18:29:00Z',
                missions: [cm(44, 0, { trainingInstanceId: 9104, poolId: 704, provisioning: 'ready', points: 200, hintPolicy: 'disabled' })],
            },
        ],
    },
    {
        id: 'a1b2c3d4-0000-4000-8000-000000003502',
        code: 'CSE3502',
        title: 'Network and Web Exploitation Lab',
        term: 'Fall 2026',
        section: 'L1',
        status: 'draft',
        startsAt: '2026-11-16T00:00:00Z',
        endsAt: '2027-03-31T00:00:00Z',
        enrolledCount: 0,
        missionCount: 0,
        staff: [{ memberId: arun.id, displayName: arun.displayName, role: 'owner' }],
        description: 'Offensive techniques in a contained lab: credentials, web flaws and privilege escalation.',
        leaderboardEnabled: true,
        range: defaultRange(),
        modules: [
            {
                id: 'b0000000-0000-4000-8000-000000000201',
                title: 'Credentials',
                position: 0,
                unlocksAt: '2026-11-16T00:00:00Z',
                dueAt: '2026-12-07T18:29:00Z',
                missions: [cm(45, 0)],
            },
            {
                id: 'b0000000-0000-4000-8000-000000000202',
                title: 'Web',
                position: 1,
                unlocksAt: '2026-12-08T00:00:00Z',
                dueAt: '2027-01-18T18:29:00Z',
                missions: [cm(46, 0, { points: 150 })],
            },
            {
                id: 'b0000000-0000-4000-8000-000000000203',
                title: 'Privilege escalation',
                position: 2,
                unlocksAt: null,
                dueAt: null,
                missions: [],
            },
        ],
    },
    {
        id: 'a1b2c3d4-0000-4000-8000-000000004003',
        code: 'CSE4003',
        title: 'Security Operations and Incident Response',
        term: 'Fall 2026',
        section: null,
        status: 'draft',
        startsAt: null,
        endsAt: null,
        enrolledCount: 0,
        missionCount: 0,
        staff: [
            { memberId: meera.id, displayName: meera.displayName, role: 'owner' },
            { memberId: sanjay.id, displayName: sanjay.displayName, role: 'instructor' },
        ],
        description: '',
        leaderboardEnabled: false,
        range: defaultRange(),
        modules: [],
    },
];

export function mockEnrollments(): Record<string, Enrollment[]> {
    const enroll = (courseId: string, students: Member[], sections: string[]) =>
        students.map((s, i) => ({
            id: `e0000000-0000-4000-8000-${courseId.slice(-6)}${String(i).padStart(6, '0')}`,
            status: s.status === 'active' ? ('active' as const) : ('invited' as const),
            section: sections[i % sections.length],
            source: 'csv' as const,
            enrolledAt: '2026-07-18T06:00:00Z',
            member: s,
        }));
    return {
        [MOCK_COURSES[0].id]: enroll(MOCK_COURSES[0].id, MOCK_STUDENTS.slice(0, 10), ['L1', 'L2']),
        [MOCK_COURSES[1].id]: enroll(MOCK_COURSES[1].id, MOCK_STUDENTS.slice(4, 12), ['L1']),
        [MOCK_COURSES[2].id]: [],
    };
}

export function mockImports(): Record<string, RosterImport[]> {
    return {
        [MOCK_COURSES[0].id]: [
            {
                id: 'f0000000-0000-4000-8000-000000000001',
                courseId: MOCK_COURSES[0].id,
                fileName: 'cse3501-fall-2026.csv',
                status: 'completed',
                rowCount: 12,
                created: 10,
                updated: 0,
                enrolled: 10,
                dropped: 0,
                skipped: 0,
                failed: 2,
                uploadedBy: arun.displayName,
                createdAt: '2026-07-18T05:58:00Z',
                completedAt: '2026-07-18T06:00:00Z',
            },
        ],
    };
}

export const MOCK_ADMIN_ID = admin.id;
