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
    const isViewAction = action.key === 'view' || action.label === 'Xem';
    const actionKeyClass = action.key ? `action-btn--${action.key}` : '';
    const classes = [base, actionKeyClass];
    if (isViewAction && !classes.includes('action-btn--view')) {
      classes.push('action-btn--view');
    }

    switch (action.variant) {
      case 'danger':   classes.push('action-btn--danger'); break;
      case 'warning':  classes.push('action-btn--warning'); break;
      case 'primary':  classes.push('action-btn--primary'); break;
      default:         break;
    }
    return classes.filter(Boolean).join(' ');
  }

  onClick(action: RowAction): void {
    if (!action.disabled) {
      this.actionClick.emit({ action: action.key, row: this.row });
    }
  }
}
