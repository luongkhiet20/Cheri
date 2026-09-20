import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-admin-card',
  templateUrl: './admin-card.component.html',
  styleUrls: ['./admin-card.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCardComponent {
  @Input() title = '';
  @Input() icon = '';
  @Input() noHeader = false;
  @Input() padded = false;
}
