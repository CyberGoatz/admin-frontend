import {
    LibraryMission,
    MissionDifficulty,
    MissionSource,
    MissionWork,
} from '../../../academy/academy.model';

export const DIFFICULTY_LABELS: Record<MissionDifficulty, string> = {
    introductory: 'Introductory',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
};

export const WORK_LABELS: Record<MissionWork, string> = {
    attack: 'Attack',
    defend: 'Defend',
    investigate: 'Investigate',
};

export const SOURCE_LABELS: Record<MissionSource, string> = {
    cybergoatz: 'CyberGoatz',
    cyberrangecz: 'CyberRangeCZ library',
};

/** Course types in the order the filter lists them. Matches the backend catalog. */
export const COURSE_TYPES = [
    'Introduction to Cybersecurity',
    'Network Security and Defense',
    'Ethical Hacking and Penetration Testing',
    'Web Application Security',
    'System Administration and Hardening',
    'Security Operations and Incident Response',
    'Digital Forensics',
    'Cloud Security',
];

export interface CatalogFilters {
    courseTypes: string[];
    work: MissionWork[];
    difficulty: MissionDifficulty[];
    source: MissionSource[];
}

export const NO_FILTERS: CatalogFilters = {
    courseTypes: [],
    work: [],
    difficulty: [],
    source: [],
};

export function filterCount(f: CatalogFilters): number {
    return (
        f.courseTypes.length +
        f.work.length +
        f.difficulty.length +
        f.source.length
    );
}

export function hasFilters(f: CatalogFilters): boolean {
    return filterCount(f) > 0;
}

function haystack(m: LibraryMission): string {
    return [
        m.title,
        m.description,
        ...(m.topics ?? []),
        ...(m.courseTypes ?? []),
        ...(m.tools ?? []),
        ...(m.mitreTechniques ?? []),
        ...(m.levelTitles ?? []),
        ...(m.outcomes ?? []),
        ...(m.stack ?? []),
        ...(m.lab ?? []).flatMap((n) => n.hosts.map((h) => h.os)),
        m.credit?.text ?? '',
        m.difficulty ?? '',
        m.work ?? '',
    ]
        .join(' ')
        .toLowerCase();
}

/** Every word of the query must appear somewhere in the mission's catalog text. */
export function matchesQuery(m: LibraryMission, query: string): boolean {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
        return true;
    }
    const text = haystack(m);
    return words.every((w) => text.includes(w));
}

export function matchesFilters(
    m: LibraryMission,
    f: CatalogFilters,
    skip?: keyof CatalogFilters,
): boolean {
    return (
        (skip === 'courseTypes' ||
            !f.courseTypes.length ||
            (m.courseTypes ?? []).some((t) => f.courseTypes.includes(t))) &&
        (skip === 'work' ||
            !f.work.length ||
            (!!m.work && f.work.includes(m.work))) &&
        (skip === 'difficulty' ||
            !f.difficulty.length ||
            (!!m.difficulty && f.difficulty.includes(m.difficulty))) &&
        (skip === 'source' ||
            !f.source.length ||
            (!!m.catalogSource && f.source.includes(m.catalogSource)))
    );
}

// Suggestions: words from the course and module titles, matched against each
// mission's title, topics and course types.

const STOP = new Set(
    (
        'a an and of the to for in on with into from at by is are be your our ' +
        'intro introduction introductory basics basic fundamentals foundations principles applied advanced ' +
        'security cyber cybersecurity information computer systems system lab labs course module unit week part ' +
        'topics topic engineering analysis i ii iii iv 1 2 3 4 5'
    ).split(' '),
);

/** Course words that mean something different in mission text. */
const SYNONYMS: Record<string, string[]> = {
    offensive: ['attack', 'penetration', 'exploit', 'hacking', 'escalation'],
    offense: ['attack', 'penetration', 'exploit'],
    pentest: ['penetration', 'exploit'],
    pentesting: ['penetration', 'exploit'],
    hacking: ['attack', 'penetration', 'exploit'],
    defensive: ['defend', 'hardening', 'detection'],
    defense: ['defend', 'hardening', 'detection'],
    soc: ['operations', 'detection', 'triage', 'incident'],
    ir: ['incident', 'triage'],
    recon: ['reconnaissance', 'enumeration'],
    monitoring: ['detection', 'logs', 'siem'],
    hunting: ['threat', 'detection', 'beaconing'],
    threat: ['detection', 'hunting'],
    malware: ['web', 'shell', 'persistence', 'command'],
    linux: ['linux', 'sudo', 'ssh'],
    windows: ['windows'],
    web: ['web', 'injection', 'owasp'],
    response: ['incident', 'triage', 'containment'],
    secure: ['hardening', 'baseline', 'configuration'],
    securing: ['hardening', 'baseline', 'configuration'],
    configuration: ['hardening', 'baseline', 'configuration'],
    config: ['hardening', 'baseline', 'configuration'],
    patching: ['vulnerability', 'patching'],
    vulnerabilities: ['vulnerability', 'patching', 'cvss'],
    access: ['authentication', 'credential', 'password'],
    passwords: ['password', 'credential'],
    privilege: ['escalation', 'sudo', 'permissions'],
    exploitation: ['exploit', 'injection', 'escalation'],
    scanning: ['reconnaissance', 'enumeration', 'nmap', 'vulnerability'],
    detection: ['detection', 'alert', 'siem'],
    investigation: ['triage', 'forensics', 'incident'],
    logging: ['log', 'logs', 'siem'],
    network: ['firewalls', 'dns', 'network', 'ports'],
    perimeter: ['firewalls', 'network'],
    cloud: ['cloud'],
    email: ['phishing', 'email'],
};

function stem(word: string): string {
    return word.length > 5
        ? word.replace(/(ations|ation|ions|ion|ing|ers|er|es|s)$/, '')
        : word;
}

function words(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1 && !STOP.has(w));
}

function sameWord(a: string, b: string): boolean {
    const sa = stem(a);
    const sb = stem(b);
    return (
        sa === sb ||
        (sa.length >= 5 &&
            sb.length >= 5 &&
            (sa.startsWith(sb) || sb.startsWith(sa)))
    );
}

export interface Suggestion {
    mission: LibraryMission;
    score: number;
    /** Catalog terms that matched, for the "Matches" line. */
    matched: string[];
}

/** Words in a course title that point to a course type. */
const COURSE_TYPE_WORDS: Record<string, string[]> = {
    'Introduction to Cybersecurity': [
        'intro',
        'introduction',
        'fundamentals',
        'foundations',
        'principles',
        'basics',
        'essentials',
    ],
    'Network Security and Defense': [
        'network',
        'networks',
        'networking',
        'defense',
        'defensive',
        'perimeter',
    ],
    'Ethical Hacking and Penetration Testing': [
        'hacking',
        'penetration',
        'pentest',
        'pentesting',
        'offensive',
        'ethical',
        'red',
    ],
    'Web Application Security': [
        'web',
        'application',
        'applications',
        'appsec',
    ],
    'System Administration and Hardening': [
        'system',
        'systems',
        'administration',
        'hardening',
        'linux',
        'windows',
        'server',
        'operating',
    ],
    'Security Operations and Incident Response': [
        'operations',
        'soc',
        'incident',
        'response',
        'monitoring',
        'blue',
        'detection',
        'threat',
    ],
    'Digital Forensics': [
        'forensics',
        'forensic',
        'investigation',
        'investigations',
    ],
    'Cloud Security': ['cloud', 'aws', 'azure', 'gcp'],
};

/** Course types a course title points to, such as "Offensive Security Lab" to ethical hacking. */
export function courseTypesFor(courseTitle: string): string[] {
    const title = courseTitle
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    return Object.entries(COURSE_TYPE_WORDS)
        .filter(([, keys]) => keys.some((k) => title.includes(k)))
        .map(([type]) => type);
}

function hits(terms: string[], query: string[]): string[] {
    return terms.filter((term) =>
        words(term).some((w) => query.some((q) => sameWord(q, w))),
    );
}

/**
 * Ranks missions for a module. Module title words (with synonyms) matched in
 * a mission's title or topics decide the ranking; the course title only adds
 * a small bonus when it matches one of the mission's course types. With no
 * module match at all, suggestions fall back to the course fit alone.
 */
export function suggest(
    missions: LibraryMission[],
    moduleTitle: string,
    courseTitle: string,
    limit = 4,
): { basis: 'module' | 'course'; items: Suggestion[] } {
    const expand = (list: string[]) =>
        list.flatMap((w) => [w, ...(SYNONYMS[w] ?? [])]);
    const moduleQuery = expand(words(moduleTitle));
    const courseTypes = courseTypesFor(courseTitle);
    const scored = missions.map((mission) => {
        const titleHits = hits([mission.title], moduleQuery);
        const topicHits = hits(mission.topics ?? [], moduleQuery);
        const toolHits = hits(
            [...(mission.stack ?? []), ...(mission.tools ?? [])],
            moduleQuery,
        );
        const fitHits = (mission.courseTypes ?? []).filter((t) =>
            courseTypes.includes(t),
        );
        const moduleScore =
            titleHits.length * 4 + topicHits.length * 3 + toolHits.length;
        return {
            mission,
            moduleScore,
            score: moduleScore + Math.min(fitHits.length, 1) * 2,
            matched: distinct([
                ...topicHits,
                ...toolHits,
                ...(moduleScore ? [] : fitHits),
            ]).slice(0, 3),
        };
    });
    const anyModuleMatch = scored.some((s) => s.moduleScore > 0);
    const items = scored
        .filter((s) => (anyModuleMatch ? s.moduleScore > 0 : s.score > 0))
        .sort(
            (a, b) =>
                b.score - a.score ||
                a.mission.title.localeCompare(b.mission.title),
        )
        .slice(0, limit)
        .map(({ mission, score, matched }) => ({ mission, score, matched }));
    return { basis: anyModuleMatch ? 'module' : 'course', items };
}

/** Drops terms that repeat an earlier one ("Firewall log" after "Firewall logs"). */
function distinct(terms: string[]): string[] {
    const out: string[] = [];
    for (const term of terms) {
        const t = term.toLowerCase();
        if (
            !out.some(
                (o) =>
                    o.toLowerCase().startsWith(t) ||
                    t.startsWith(o.toLowerCase()),
            )
        ) {
            out.push(term);
        }
    }
    return out;
}

export function usageLine(m: LibraryMission): string {
    const u = m.usage;
    if (!u || !u.courses) {
        return 'Not in a course yet';
    }
    const courses = `${u.courses} ${u.courses === 1 ? 'course' : 'courses'}`;
    const universities = `${u.universities} ${u.universities === 1 ? 'university' : 'universities'}`;
    return `Used in ${courses} at ${universities}`;
}
