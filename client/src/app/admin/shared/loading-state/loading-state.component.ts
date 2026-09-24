import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  standalone: false,
  templateUrl: './loading-state.component.html',
  styleUrls: ['./loading-state.component.css']
})
export class LoadingStateComponent {
  @Input() message: string = 'Đang tải dữ liệu...';
  @Input() rows: number = 5;
  @Input() type: 'spinner' | 'skeleton' = 'skeleton';

  get skeletonRows(): number[] {
    return Array.from({ length: this.rows }, (_, i) => i);
  }
}
