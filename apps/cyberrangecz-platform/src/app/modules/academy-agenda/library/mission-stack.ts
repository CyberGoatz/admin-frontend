/**
 * Icons for the software a mission uses, from Simple Icons (CC0), served from
 * public/academy/stack. Names without an icon show as text.
 */
const ICONS: [RegExp, string][] = [
    [/^ubuntu/i, 'ubuntu'],
    [/^debian/i, 'debian'],
    [/^kali/i, 'kalilinux'],
    [/^curl$/i, 'curl'],
    [/^metasploit/i, 'metasploit'],
    [/^webmin/i, 'webmin'],
    [/^php$/i, 'php'],
    [/^aws$/i, 'amazonwebservices'],
];

export function stackIcon(name: string): string | null {
    const hit = ICONS.find(([pattern]) => pattern.test(name.trim()));
    return hit ? `/assets/academy/stack/${hit[1]}.svg` : null;
}
