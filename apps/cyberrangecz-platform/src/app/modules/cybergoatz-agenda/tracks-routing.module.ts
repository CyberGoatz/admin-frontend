import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TrainingApiModule } from '@crczp/training-api';
import { ValidRouterConfig } from '@crczp/routing-commons';
import { CyberGoatzTracksComponent } from './tracks/cybergoatz-tracks.component';
import { CyberGoatzTrackFormComponent } from './tracks/cybergoatz-track-form.component';
import { CyberGoatzTrackDetailComponent } from './tracks/cybergoatz-track-detail.component';

const routes: ValidRouterConfig<'tracks'> = [
    {
        path: '',
        component: CyberGoatzTracksComponent,
    },
    {
        path: 'create',
        component: CyberGoatzTrackFormComponent,
        data: {
            breadcrumb: 'Create Track',
            title: 'Create CyberGoatz Track',
        },
    },
    {
        path: ':trackId/edit',
        component: CyberGoatzTrackFormComponent,
        data: {
            breadcrumb: 'Edit Track',
            title: 'Edit CyberGoatz Track',
        },
    },
    {
        path: ':trackId',
        component: CyberGoatzTrackDetailComponent,
        data: {
            breadcrumb: 'Track Detail',
            title: 'CyberGoatz Track Detail',
        },
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes), TrainingApiModule],
    exports: [RouterModule],
})
export class CyberGoatzTracksRoutingModule {}
