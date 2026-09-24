import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: false,
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.css']
})
export class EmptyStateComponent {
  @Input() title: string = 'Chưa có dữ liệu';
  @Input() description: string = 'Hiện tại chưa có dữ liệu nào trong hệ thống.';
  @Input() actionLabel: string = '';
  @Input() icon: string = 'empty';
  @Output() actionClick = new EventEmitter<void>();

  onAction(): void {
    this.actionClick.emit();
  }
}
