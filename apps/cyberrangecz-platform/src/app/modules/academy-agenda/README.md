# academy-agenda

Staff screens for campus tenants (universities). The API is the academy contract in
backend-cybergoatz: `openapi/academy.yaml` and `docs/academy.md`.

| Route | Who | Screen |
|---|---|---|
| `/academy` | tenant staff | Redirects: tenant admins to Members, others to Courses |
| `/academy/members` | tenant admin | Staff and student list, invite, resend invite, suspend, change role |
| `/academy/courses` | tenant staff | Courses the caller teaches (tenant admins see all), create a draft |
| `/academy/courses/:courseId` | tenant staff (TAs read only) | Details, modules and missions, range settings, enrollments, publish with checklist |
| `/academy/courses/:courseId/roster` | tenant admin, professor | CSV upload, preview with row errors, commit progress, earlier uploads |
| `/academy/library` | tenant admin, professor | Missions available to place in a course |

Supporting code lives in `src/app/academy/`:

- `academy-runtime.ts`: runs before Angular. Loads `config.json`, calls
  `GET /academy/public/admin-config?host=` on campus deployments, merges the tenant's
  OIDC clients into `authConfig.providers`, and applies branding (title, favicon,
  logo, `--primary-*` and `--mat-sys-primary*` variables).
- `academy-api.service.ts`, `academy.model.ts`: hand-written client for the contract.
- `tenant-context.service.ts`, `academy-guards.ts`: tenant role from `GET /academy/tenants/{t}/me`.
- `mock/`: in-browser mock of the whole contract.

## Hosts

| Use | Production | Local |
|---|---|---|
| Staff (this app) | `<tenant>-admin.cybergoatz.com` | `<tenant>-admin.localhost:4200` |
| Students (learner app) | `<tenant>.cybergoatz.com` | `<tenant>.localhost:3000` |
| Identity (realm `campus`) | `campus-auth.cybergoatz.com` | `localhost:8180` |
| Academy API | `campus-api.cybergoatz.com` | `localhost:3100` |

The app sends `location.hostname` (no port) to `admin-config`; the tenant's record supplies the name, logos, colors and Keycloak client. The local seed uses `northgate`.

## Configuration

`config.json` keys (both optional):

```json
{
    "academy": { "tenancyMode": "campus" },
    "branding": { "productName": "CyberGoatz Admin" }
}
```

With `tenancyMode` unset or `public`, nothing changes for the public admin.

## Running against the mock

Development builds only:

```bash
npx nx serve cyberrangecz-platform --ssl=false
```

Open `http://localhost:4200/academy?academyMock=1`. The flag is remembered in
localStorage; `?academyMock=0` turns it off. `?academyRole=tenant_admin|professor|ta`
picks the signed-in role. Mock edits persist in sessionStorage for the tab.
No sign-in is needed in mock mode.
