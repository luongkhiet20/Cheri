import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RowAction, ActionEvent } from '../models/admin-table.models';

@Component({
  selector: 'app-admin-action-buttons',
  standalone: false,
  templateUrl: './admin-action-buttons.component.html',
  styleUrls: ['./admin-action-buttons.component.css']
})
export class AdminActionButtonsComponent {
  @Input() actions: RowAction[] = [];
  @Input() row: any = null;

  @Output() actionClick = new EventEmitter<ActionEvent>();

  isVisible(action: RowAction): boolean {
    if (action.showWhen) return action.showWhen(this.row);
    return true;
  }

  getButtonClass(action: RowAction): string {
    const base = 'action-btn';
    switch (action.variant) {
      case 'danger':   return `${base} action-btn--danger`;
      case 'warning':  return `${base} action-btn--warning`;
      case 'primary':  return `${base} action-btn--primary`;
      default:         return base;
    }
  }

  onClick(action: RowAction): void {
    if (!action.disabled) {
      this.actionClick.emit({ action: action.key, row: this.row });
    }
  }
}
