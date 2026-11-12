import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ValidRouterConfig } from '@crczp/routing-commons';
import { CyberGoatzCatalogComponent } from './cybergoatz-catalog.component';

const routes: ValidRouterConfig<'catalog'> = [
    {
        path: '',
        component: CyberGoatzCatalogComponent,
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class CyberGoatzCatalogRoutingModule {}
