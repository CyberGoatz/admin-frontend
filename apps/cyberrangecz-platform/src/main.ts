import {
    enableProdMode,
    ErrorHandler,
    importProvidersFrom,
    inject,
    Injectable,
} from '@angular/core';
import { environment } from './environments/environment';
import {
    APP_CONFIG,
    appConfigProvider,
    SentinelConfig,
} from '@sentinel/common/dynamic-env';
import { bootstrapApplication } from '@angular/platform-browser';
import {
    loadRuntimeConfig,
    getAcademyRuntime,
    readAcademyMockFlag,
} from './app/academy/academy-runtime';
import { academyMockInterceptor } from './app/academy/mock/academy-mock.interceptor';
import { AppComponent } from './app/app.component';
import {
    BrowserAnimationsModule,
    provideAnimations,
} from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import {
    HTTP_INTERCEPTORS,
    HttpClient,
    provideHttpClient,
    withInterceptors,
    withInterceptorsFromDi,
} from '@angular/common/http';
import { loadingInterceptor } from './app/services/http-interceptors/loading-interceptor';
import { tokenRefreshInterceptor } from './app/services/http-interceptors/token-refresh-interceptor';
import { TokenRefreshService } from './app/services/shared/token-refresh.service';
import { provideSentinelNotifications } from '@sentinel/layout/notification';
import {
    provideSentinelAuth,
    SentinelAuthConfig,
    SentinelAuthContext,
    SentinelAuthErrorHandler,
    SentinelAuthorizationStrategy,
    SentinelUagStrategyConfig,
    UnauthorizedInterceptor,
    User,
    UserDTO,
} from '@sentinel/auth';
import { errorLogInterceptor } from './app/services/http-interceptors/error-log-interceptor';
import { catchError, Observable, retry, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import {
    provideHttpCache,
    withHttpCacheInterceptor,
    withLocalStorage,
} from '@ngneat/cashew';
import { LoadingService } from './app/services/loading.service';
import {
    ErrorHandlerService,
    NotificationService,
    PortalConfig,
} from '@crczp/utils';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { RoleService } from './app/services/role.service';
import { APP_ROUTES } from './app/app-routes';
import { provideSentinelMarkdownEditorConfig } from '@sentinel/components/markdown-editor';

@Injectable()
export class SentinelUagAuthorizationStrategy extends SentinelAuthorizationStrategy {
    private configService = inject(SentinelAuthContext);
    private errorHandler = inject(SentinelAuthErrorHandler);
    private http = inject(HttpClient);
    private readonly POSSIBLE_RETRIES = 3;

    authorize(): Observable<User> {
        const config = this.configService.config
            .authorizationStrategyConfig as SentinelUagStrategyConfig;
        if (config.authorizationUrl) {
            return this.http.get<UserDTO>(config.authorizationUrl).pipe(
                map((resp) => User.fromDTO(resp)),
                retry(this.POSSIBLE_RETRIES),
                catchError((err) => {
                    this.errorHandler.emit(err, 'Authorizing to User & Group');
                    return throwError(() => err);
                }),
            );
        } else {
            return throwError(
                () =>
                    new Error(
                        'Failed to read authorizationUrl from SentinelUagStrategyConfig',
                    ),
            );
        }
    }
}

if (environment.production) {
    enableProdMode();
}

// Loads config.json, applies the tenant's auth clients and branding for this
// host (GET /academy/public/admin-config), then starts Angular.
loadRuntimeConfig(
    'assets/config.json',
    readAcademyMockFlag(environment.production),
)
    .then(() =>
        bootstrapApplication(AppComponent, {
            providers: buildProviders(),
        }),
    )
    .catch((err) => console.error('Error bootstrapping application:', err));

function buildProviders() {
    return [
        importProvidersFrom(BrowserAnimationsModule),
        provideAnimations(),
        provideNativeDateAdapter(),
        // Campus UI spec: outlined 40px fields on tenant hosts.
        ...(getAcademyRuntime().tenant
            ? [
                  {
                      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
                      useValue: { appearance: 'outline', subscriptSizing: 'dynamic' },
                  },
              ]
            : []),
        appConfigProvider,
        {
            provide: PortalConfig,
            useFactory: (config: SentinelConfig) =>
                PortalConfig.schema().parse(config),
            deps: [APP_CONFIG],
        },
        provideSentinelNotifications(),
        ErrorHandlerService,
        { provide: ErrorHandler, useExisting: ErrorHandlerService },
        {
            provide: SentinelAuthErrorHandler,
            useExisting: ErrorHandlerService,
        },
        {
            provide: HTTP_INTERCEPTORS,
            useClass: UnauthorizedInterceptor,
            multi: true,
        },
        provideHttpClient(
            withInterceptorsFromDi(),
            withInterceptors([
                tokenRefreshInterceptor,
                loadingInterceptor,
                errorLogInterceptor,
                withHttpCacheInterceptor(),
                academyMockInterceptor,
            ]),
        ),
        {
            provide: SentinelAuthConfig,
            useFactory: () => inject(PortalConfig).authConfig,
            deps: [PortalConfig],
        },
        RoleService,
        {
            provide: SentinelAuthorizationStrategy,
            useClass: SentinelUagAuthorizationStrategy,
        },
        provideSentinelAuth(() => inject(APP_CONFIG).authConfig, [APP_CONFIG]),
        LoadingService,
        NotificationService,
        TokenRefreshService,
        provideSentinelMarkdownEditorConfig({
            markdownParser: {},
        }),
        provideHttpCache(withLocalStorage()),
        provideRouter(APP_ROUTES),
    ];
}
