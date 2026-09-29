import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
    selector: 'app-admin-card',
    templateUrl: './admin-card.component.html',
    styleUrls: ['./admin-card.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgIf]
})
export class AdminCardComponent {
  @Input() title = '';
  @Input() icon = '';
  @Input() noHeader = false;
  @Input() padded = false;
}
