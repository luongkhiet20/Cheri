import { Component, Input } from '@angular/core';
import { BadgeVariant } from '../models/admin-table.models';

@Component({
  selector: 'app-admin-status-badge',
  standalone: false,
  templateUrl: './admin-status-badge.component.html',
  styleUrls: ['./admin-status-badge.component.css']
})
export class AdminStatusBadgeComponent {
  @Input() label: string = '';
  @Input() variant: BadgeVariant = 'neutral';
  @Input() status: string = '';

  get resolvedLabel(): string {
    return this.label || this.status;
  }
}
