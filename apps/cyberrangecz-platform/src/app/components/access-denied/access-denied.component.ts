import { Component } from '@angular/core';
import { MatCard, MatCardContent, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'crczp-access-denied',
    templateUrl: './access-denied.component.html',
    styleUrls: ['./access-denied.component.scss'],
    imports: [MatCard, MatCardContent, MatCardTitle, MatIcon],
})
export class AccessDeniedComponent {}
