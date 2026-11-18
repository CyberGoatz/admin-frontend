import { HintPolicy, MemberRole, StaffRole } from '../../../academy/academy.model';

export const ROLE_LABELS: Record<MemberRole, string> = {
    tenant_admin: 'Tenant admin',
    professor: 'Professor',
    ta: 'Teaching assistant',
    student: 'Student',
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
    owner: 'Owner',
    instructor: 'Instructor',
    ta: 'TA',
};

export const HINT_POLICY_LABELS: Record<HintPolicy, string> = {
    allowed: 'Allowed',
    penalized: 'Penalized',
    disabled: 'Disabled',
};

export const WEEKDAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

export function label(value: string | null | undefined): string {
    if (!value) {
        return '';
    }
    const text = value.replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO timestamp to the value of `<input type="date">` (local date). */
export function toDateInput(iso: string | null | undefined): string {
    if (!iso) {
        return '';
    }
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? ''
        : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `<input type="date">` value to an ISO timestamp at local midnight. */
export function fromDateInput(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }
    const d = new Date(`${value}T00:00:00`);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO timestamp to the value of `<input type="datetime-local">`. */
export function toDateTimeInput(iso: string | null | undefined): string {
    if (!iso) {
        return '';
    }
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? ''
        : `${toDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeInput(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatDate(iso: string | null | undefined): string {
    if (!iso) {
        return '';
    }
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) {
        return '';
    }
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? ''
        : d.toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
          });
}

/** Saves text as a file in the browser. */
export function downloadText(text: string, fileName: string, type = 'text/csv'): void {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves a blob as a file in the browser. */
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File name from a Content-Disposition header, if any. */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
    const match = header ? /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header) : null;
    return match ? decodeURIComponent(match[1]) : fallback;
}
