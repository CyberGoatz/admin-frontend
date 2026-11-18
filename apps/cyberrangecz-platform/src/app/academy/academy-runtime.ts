import { InjectionToken } from '@angular/core';
import { DynamicEnvironment } from '@sentinel/common/dynamic-env';
import { AdminConfig, Branding } from './academy.model';

/**
 * Runtime white labeling for the admin front end.
 *
 * Runs before Angular bootstraps:
 * 1. loads `assets/config.json`;
 * 2. on campus deployments (or with the dev mock flag) asks backend-cybergoatz
 *    for `GET /academy/public/admin-config?host=` and merges the tenant's
 *    OIDC providers into the config;
 * 3. applies the tenant's branding (colors, title, favicon, loading logo).
 */

export interface AcademyRuntime {
    /** Tenant slug when this host belongs to a campus tenant, otherwise null. */
    tenant: string | null;
    /** Title shown in the browser tab and portal header. */
    title: string;
    branding: Branding;
    /** True when the academy API is served by the in-browser mock. */
    mock: boolean;
    /** Tenant IANA time zone for dates and lab windows, when known. */
    timezone?: string;
}

/** Keys added to config.json for campus deployments. */
interface AcademyConfigSection {
    academy?: {
        /** `campus` turns on the admin-config lookup at bootstrap. */
        tenancyMode?: 'public' | 'campus';
        /** `false` keeps the dev mock off even when `?academyMock=1` was set before. */
        mock?: boolean;
    };
    /** Optional default branding for hosts without a tenant. */
    branding?: Partial<Branding>;
}

type RawConfig = AcademyConfigSection & {
    basePaths?: { cybergoatz?: string };
    authConfig?: {
        providers?: {
            label?: string;
            textColor?: string;
            backgroundColor?: string;
            oidcConfig?: Record<string, unknown>;
        }[];
    };
    [key: string]: unknown;
};

export const DEFAULT_BRANDING: Branding = {
    productName: 'CyberGoatz Admin',
    logoUrl: './assets/logo/logo-black.svg',
    faviconUrl: '/assets/icon/favicon.ico',
    colorPrimary: '#b23a73',
    colorOnPrimary: '#ffffff',
};

const MOCK_STORAGE_KEY = 'academyMock';
const ADMIN_CONFIG_TIMEOUT_MS = 5000;

let runtime: AcademyRuntime = {
    tenant: null,
    title: DEFAULT_BRANDING.productName,
    branding: DEFAULT_BRANDING,
    mock: false,
};

export function getAcademyRuntime(): AcademyRuntime {
    return runtime;
}

export const ACADEMY_RUNTIME = new InjectionToken<AcademyRuntime>(
    'AcademyRuntime',
    { providedIn: 'root', factory: () => runtime },
);

/**
 * Dev flag for the academy mock backend. Never on in production builds.
 * Turn on with `?academyMock=1` (remembered in localStorage), off with `?academyMock=0`.
 */
export function readAcademyMockFlag(production: boolean): boolean {
    if (production) {
        return false;
    }
    const param = new URLSearchParams(window.location.search).get(
        MOCK_STORAGE_KEY,
    );
    try {
        if (param === '1') {
            localStorage.setItem(MOCK_STORAGE_KEY, '1');
        } else if (param === '0') {
            localStorage.removeItem(MOCK_STORAGE_KEY);
        }
        return localStorage.getItem(MOCK_STORAGE_KEY) === '1';
    } catch {
        return param === '1';
    }
}

/**
 * Loads config.json, resolves the tenant for this host and sets the result as
 * the dynamic environment read by the rest of the app.
 */
export async function loadRuntimeConfig(
    configUrl: string,
    mock: boolean,
): Promise<void> {
    const config: RawConfig = await fetch(configUrl).then((r) => r.json());
    if (config.academy?.mock === false) {
        mock = false;
    }
    const defaults: Branding = { ...DEFAULT_BRANDING, ...(config.branding ?? {}) };
    runtime = {
        tenant: null,
        title: defaults.productName,
        branding: defaults,
        mock,
    };

    const campus = mock || config.academy?.tenancyMode === 'campus';
    if (campus) {
        const adminConfig = mock
            ? (await import('./mock/academy-mock-fixtures')).mockAdminConfig()
            : await fetchAdminConfig(config.basePaths?.cybergoatz);
        if (adminConfig?.tenant) {
            const branding: Branding = {
                ...defaults,
                logoUrl: undefined,
                faviconUrl: undefined,
                ...(adminConfig.branding ?? {}),
            };
            // Tenants without uploaded artwork get the product name set in type.
            branding.markUrl ||= textMark(branding.productName, branding.colorPrimary, branding.colorOnPrimary);
            branding.logoUrl ||= textLogo(branding.productName, branding.colorPrimary);
            runtime = {
                tenant: adminConfig.tenant,
                title: adminConfig.title || branding.productName,
                branding,
                mock,
                timezone: adminConfig.timezone,
            };
            mergeAuthProviders(config, adminConfig, branding);
        }
    }

    DynamicEnvironment.setConfig(config);
    applyBranding(runtime);
}

async function fetchAdminConfig(
    cybergoatzBase: string | undefined,
): Promise<AdminConfig | null> {
    if (!cybergoatzBase) {
        return null;
    }
    const base = cybergoatzBase.replace(/\/$/, '');
    // Hosts are stored and resolved without a port (docs/academy.md).
    const url = `${base}/academy/public/admin-config?host=${encodeURIComponent(window.location.hostname)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ADMIN_CONFIG_TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            // 404: this host is not a tenant staff host. Run as the public admin.
            return null;
        }
        return (await response.json()) as AdminConfig;
    } catch (err) {
        console.warn('Tenant config unavailable, using default config', err);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Replaces the configured sign-in providers with the tenant's own clients.
 * Redirect URIs and the remaining OIDC options come from the first provider
 * in config.json, rewritten to the current origin.
 */
function mergeAuthProviders(
    config: RawConfig,
    adminConfig: AdminConfig,
    branding: Branding,
): void {
    const tenantProviders = adminConfig.authConfig?.providers ?? [];
    if (tenantProviders.length === 0) {
        return;
    }
    config.authConfig = config.authConfig ?? {};
    const template = config.authConfig.providers?.[0]?.oidcConfig ?? {};
    const origin = window.location.origin;
    config.authConfig.providers = tenantProviders.map((provider) => ({
        label: provider.label || `Sign in to ${branding.productName}`,
        textColor: branding.colorOnPrimary,
        backgroundColor: branding.colorPrimary,
        oidcConfig: {
            ...template,
            issuer: provider.issuer ?? template['issuer'],
            clientId: provider.clientId ?? template['clientId'],
            scope: provider.scope ?? template['scope'],
            logoutUrl: provider.logoutUrl ?? template['logoutUrl'],
            redirectUri: origin,
            postLogoutRedirectUri: `${origin}/logout-confirmed`,
            silentRefreshRedirectUri: `${origin}/silent-refresh.html`,
        },
    }));
}

/** Material 3 tones used by the theme (see libs/utils/theme variables.scss). */
const TONES = [0, 10, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100];

/**
 * Applies branding to the document: title, favicon, loading logo and, for
 * tenants, the primary palette on the Material 3 CSS variables.
 */
export function applyBranding(rt: AcademyRuntime): void {
    const { branding } = rt;
    const style = document.documentElement.style;
    document.title = rt.title;

    const faviconUrl = branding.faviconUrl || branding.markUrl;
    if (faviconUrl) {
        document
            .querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')
            .forEach((link) => {
                link.href = faviconUrl;
                link.removeAttribute('type');
            });
    }

    const loadingLogo = document.querySelector<HTMLImageElement>(
        '.loading-logo',
    );
    if (loadingLogo && branding.logoUrl) {
        loadingLogo.src = branding.logoUrl;
        loadingLogo.alt = branding.productName;
        loadingLogo.hidden = false;
    }

    style.setProperty('--loading-accent', branding.colorPrimary);
    if (!rt.tenant) {
        // Public admin keeps the palette compiled into the theme.
        return;
    }

    const primary = normalizeHex(branding.colorPrimary);
    const onPrimary = normalizeHex(branding.colorOnPrimary);
    if (!primary || !onPrimary) {
        return;
    }
    const tone = (t: number) => toneOf(primary, t);

    TONES.forEach((t) => style.setProperty(`--primary-${t}`, tone(t)));
    const vars: Record<string, string> = {
        '--primary': primary,
        '--primary-container': primary,
        '--primary-fixed': tone(35),
        '--primary-fixed-dim': tone(60),
        '--on-primary': onPrimary,
        '--on-primary-container': onPrimary,
        '--mat-sys-primary': primary,
        '--mat-sys-on-primary': onPrimary,
        '--mat-sys-primary-container': tone(90),
        '--mat-sys-on-primary-container': tone(10),
        '--mat-sys-inverse-primary': tone(80),
        '--mat-sys-primary-fixed': tone(90),
        '--mat-sys-primary-fixed-dim': tone(80),
        '--mat-sys-on-primary-fixed': tone(10),
        '--mat-sys-on-primary-fixed-variant': tone(30),
        '--mat-sys-surface-tint': primary,
        // Raw brand colors for surfaces painted in the tenant color (sidebar).
        '--tenant-primary': primary,
        '--tenant-on-primary': onPrimary,
        // Campus UI spec tokens.
        '--brand': primary,
        '--on-brand': onPrimary,
        '--brand-accent': primary,
    };
    const accent = normalizeHex(branding.colorAccent);
    if (accent) {
        Object.assign(vars, {
            '--tenant-accent': accent,
            '--brand-accent': accent,
            '--secondary': accent,
            '--secondary-container': accent,
            '--mat-sys-secondary': accent,
            '--mat-sys-on-secondary': '#ffffff',
            '--mat-sys-secondary-container': toneOf(primary, 90),
            '--mat-sys-on-secondary-container': toneOf(primary, 10),
        });
    }
    Object.entries(vars).forEach(([name, value]) =>
        style.setProperty(name, value),
    );
    document.documentElement.dataset['tenant'] = rt.tenant;
    loadCampusFonts();
}

const CAMPUS_FONTS_URL =
    'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap';

/** Geist and Geist Mono for tenant hosts (campus UI spec); other hosts keep the theme fonts. */
function loadCampusFonts(): void {
    if (document.querySelector('link[data-campus-fonts]')) {
        return;
    }
    const head = document.head;
    for (const origin of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
        const preconnect = document.createElement('link');
        preconnect.rel = 'preconnect';
        preconnect.href = origin;
        if (origin.includes('gstatic')) {
            preconnect.crossOrigin = 'anonymous';
        }
        head.appendChild(preconnect);
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CAMPUS_FONTS_URL;
    link.dataset['campusFonts'] = '';
    head.appendChild(link);
}

function normalizeHex(value: string | undefined): string | null {
    if (!value) {
        return null;
    }
    const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
    return match ? `#${match[1].toLowerCase()}` : null;
}

/** Tone 40 is the brand color; lower tones mix toward black, higher toward white. */
function toneOf(hex: string, t: number): string {
    if (t === 40) {
        return hex;
    }
    return t < 40
        ? mix(hex, '#000000', (40 - t) / 40)
        : mix(hex, '#ffffff', (t - 40) / 60);
}

function mix(a: string, b: string, amount: number): string {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const channel = (shift: number) => {
        const ca = (pa >> shift) & 0xff;
        const cb = (pb >> shift) & 0xff;
        return Math.round(ca + (cb - ca) * amount);
    };
    const rgb = (channel(16) << 16) | (channel(8) << 8) | channel(0);
    return `#${rgb.toString(16).padStart(6, '0')}`;
}

const escapeXml = (text: string) =>
    text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** Square mark with the product's first letter, for favicon and sign-in. */
function textMark(name: string, background: string, foreground: string): string {
    const letter = escapeXml((name.trim().charAt(0) || '?').toUpperCase());
    return svgUrl(
        `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
            `<rect width="64" height="64" rx="8" fill="${normalizeHex(background) ?? '#545f72'}"/>` +
            `<text x="32" y="44" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="700" fill="${normalizeHex(foreground) ?? '#ffffff'}" text-anchor="middle">${letter}</text>` +
            `</svg>`,
    );
}

/** Product name in type, stacked over two lines for the 140px nav rail. */
function textLogo(name: string, color: string): string {
    const words = name.trim().split(/\s+/);
    const first = escapeXml(words[0] ?? '');
    const rest = escapeXml(words.slice(1).join(' '));
    return svgUrl(
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="110" viewBox="0 0 200 110">` +
            `<text x="100" y="48" font-family="Inter,Arial,sans-serif" font-size="40" font-weight="700" fill="${normalizeHex(color) ?? '#191c1d'}" text-anchor="middle">${first}</text>` +
            `<text x="100" y="88" font-family="Inter,Arial,sans-serif" font-size="26" font-weight="500" fill="#191c1d" text-anchor="middle">${rest}</text>` +
            `</svg>`,
    );
}
