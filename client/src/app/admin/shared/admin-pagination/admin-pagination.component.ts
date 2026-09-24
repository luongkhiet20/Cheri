import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-admin-pagination',
  standalone: false,
  templateUrl: './admin-pagination.component.html',
  styleUrls: ['./admin-pagination.component.css']
})
export class AdminPaginationComponent implements OnChanges {
  @Input() page: number = 1;
  @Input() pageSize: number = 20;
  @Input() total: number = 0;
  @Input() pageSizeOptions: number[] = [10, 20, 50, 100];

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  pages: number[] = [];

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get rangeStart(): number { return this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1; }
  get rangeEnd(): number   { return Math.min(this.page * this.pageSize, this.total); }

  ngOnChanges(changes: SimpleChanges): void {
    this.buildPages();
  }

  buildPages(): void {
    const tp = this.totalPages;
    const cur = this.page;
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, cur - delta); i <= Math.min(tp, cur + delta); i++) {
      range.push(i);
    }
    // Always include first and last
    if (range[0] > 1) {
      if (range[0] > 2) range.unshift(-1); // ellipsis
      range.unshift(1);
    }
    if (range[range.length - 1] < tp) {
      if (range[range.length - 1] < tp - 1) range.push(-1);
      range.push(tp);
    }
    this.pages = range;
  }

  goTo(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.page) return;
    this.pageChange.emit(p);
  }

  onPageSizeChange(event: Event): void {
    const val = parseInt((event.target as HTMLSelectElement).value, 10);
    this.pageSizeChange.emit(val);
  }
}
