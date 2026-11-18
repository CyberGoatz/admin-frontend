import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MissionCatalogComponent } from './mission-catalog.component';

/** The CyberGoatz mission catalog, for browsing outside a course. */
@Component({
    selector: 'crczp-academy-mission-library',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MissionCatalogComponent],
    template: `
        <div class="academy-page library-page">
            <header class="academy-header">
                <div class="academy-header-text">
                    <h1 class="academy-title">Mission library</h1>
                    <p class="academy-description">
                        Hands-on missions to build courses from, each on its own
                        lab range. Filter by the kind of course you teach, or
                        search by topic, tool or ATT&amp;CK ID.
                    </p>
                </div>
            </header>
            <crczp-academy-mission-catalog
                class="library-catalog"
                mode="browse"
            />
        </div>
    `,
    styles: `
        .library-page {
            max-width: 1320px;
        }
        .library-catalog {
            height: calc(100vh - 220px);
            min-height: 560px;
        }
    `,
})
export class MissionLibraryComponent {}
