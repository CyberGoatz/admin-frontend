import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EMPTY, Subject } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { academyErrorMessage, AcademyApiService } from '../../../academy/academy-api.service';
import { Member, MemberQuery, MemberRole, MemberStatus } from '../../../academy/academy.model';
import { TenantContextService } from '../../../academy/tenant-context.service';
import { formatDate, label, ROLE_LABELS } from '../shared/academy-format';
import { InviteMemberDialogComponent } from './invite-member-dialog.component';

/** Tenant admin: staff list, invite, resend, suspend and role changes. */
@Component({
    selector: 'crczp-academy-members',
    templateUrl: './members.component.html',
    styles: `
        .inline-input.role-select {
            min-width: 170px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSelectModule,
        MatTooltipModule,
    ],
})
export class MembersComponent {
    readonly roleLabels = ROLE_LABELS;
    readonly roles: MemberRole[] = ['tenant_admin', 'professor', 'ta', 'student'];
    readonly staffRoles: MemberRole[] = ['tenant_admin', 'professor', 'ta'];
    readonly statuses: MemberStatus[] = ['invited', 'active', 'suspended'];
    readonly label = label;
    readonly formatDate = formatDate;

    readonly members = signal<Member[]>([]);
    readonly total = signal(0);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly busy = signal<string | null>(null);

    query: MemberQuery = { role: undefined, status: undefined, q: '', page: 0, size: 50 };

    readonly me = inject(TenantContextService).member;
    private readonly api = inject(AcademyApiService);
    private readonly dialog = inject(MatDialog);
    private readonly snack = inject(MatSnackBar);
    private readonly reload$ = new Subject<number>();

    constructor() {
        this.reload$
            .pipe(
                debounceTime(0),
                switchMap(() => {
                    this.loading.set(true);
                    return this.api.listMembers(this.query).pipe(
                        catchError((err) => {
                            this.loading.set(false);
                            this.error.set(academyErrorMessage(err, 'Members could not be loaded.'));
                            return EMPTY;
                        }),
                    );
                }),
                takeUntilDestroyed(inject(DestroyRef)),
            )
            .subscribe((page) => {
                this.members.set(page.items);
                this.total.set(page.total);
                this.loading.set(false);
                this.error.set(null);
            });
        this.load();
    }

    load(resetPage = false): void {
        if (resetPage) {
            this.query.page = 0;
        }
        this.reload$.next(Date.now());
    }

    onPage(event: PageEvent): void {
        this.query.page = event.pageIndex;
        this.query.size = event.pageSize;
        this.load();
    }

    invite(): void {
        this.dialog
            .open(InviteMemberDialogComponent, { width: '600px', maxWidth: '95vw' })
            .afterClosed()
            .subscribe((member?: Member) => {
                if (member) {
                    this.snack.open(`Invite sent to ${member.email}`, undefined, { duration: 3000 });
                    this.load();
                }
            });
    }

    resend(member: Member): void {
        this.busy.set(member.id);
        this.api.resendInvite(member.id).subscribe({
            next: () => {
                this.busy.set(null);
                this.snack.open(`Invite sent again to ${member.email}`, undefined, { duration: 3000 });
                this.load();
            },
            error: (err) => {
                this.busy.set(null);
                this.snack.open(academyErrorMessage(err, 'The invite could not be sent.'), 'Close');
            },
        });
    }

    setStatus(member: Member, status: MemberStatus): void {
        this.patch(member, { status }, status === 'suspended' ? 'Suspended' : 'Reactivated');
    }

    setRole(member: Member, role: MemberRole): void {
        if (role !== member.role) {
            this.patch(member, { role }, `Role changed to ${ROLE_LABELS[role]}`);
        }
    }

    isSelf(member: Member): boolean {
        return this.me()?.id === member.id;
    }

    private patch(member: Member, patch: Partial<Member>, message: string): void {
        this.busy.set(member.id);
        this.api.updateMember(member.id, patch).subscribe({
            next: (updated) => {
                this.busy.set(null);
                this.members.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
                this.snack.open(`${message}: ${updated.displayName}`, undefined, { duration: 3000 });
            },
            error: (err) => {
                this.busy.set(null);
                this.snack.open(academyErrorMessage(err, 'The change was not saved.'), 'Close');
                this.load();
            },
        });
    }
}
