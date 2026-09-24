import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChildren, QueryList, ElementRef, AfterViewChecked } from '@angular/core';
import { TableColumn, RowAction, ActionEvent, PaginationConfig } from '../models/admin-table.models';

@Component({
  selector: 'app-admin-table',
  standalone: false,
  templateUrl: './admin-table.component.html',
  styleUrls: ['./admin-table.component.css']
})
export class AdminTableComponent implements OnChanges, AfterViewChecked {

  readonly fallbackImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAABmJLR0QA/wD/AP+gvaeTAAAASUlEQVRYhe3OMQEAAAQEsJl/aOMBHoQSqChJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkjTpA8BoAAFBHaYcAAAAAElFTkSuQmCC';

  // ── Existing Inputs ──────────────────────────────────────────
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() actions: RowAction[] = [];
  @Input() showActions: boolean = true;
  @Input() loading: boolean = false;
  @Input() pagination: PaginationConfig | null = null;
  @Input() totalLabel: string = 'bản ghi';

  // ── NEW: Selection Inputs ────────────────────────────────────
  /** Enable row checkboxes */
  @Input() selectable: boolean = false;
  /** Externally controlled selected IDs (for sync with toolbar) */
  @Input() selectedIds: Set<any> = new Set();
  /** Key field used as row identifier (default: 'id') */
  @Input() rowKey: string = 'id';

  // ── Existing Outputs ─────────────────────────────────────────
  @Output() actionClick = new EventEmitter<ActionEvent>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  // ── NEW: Selection Outputs ───────────────────────────────────
  /** Emits the full Set of selected IDs whenever selection changes */
  @Output() selectionChange = new EventEmitter<Set<any>>();

  // ── References for indeterminate checkbox ────────────────────
  @ViewChildren('headerCheckbox') headerCheckboxRefs!: QueryList<ElementRef<HTMLInputElement>>;

  sortKey: string = '';
  sortDir: 'asc' | 'desc' = 'asc';

  // ── ngOnChanges: clear selection if data changes ─────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      // Remove selected IDs that no longer exist in new data
      const existingKeys = new Set(this.data.map(r => r[this.rowKey]));
      const cleaned = new Set([...this.selectedIds].filter(id => existingKeys.has(id)));
      if (cleaned.size !== this.selectedIds.size) {
        this.selectedIds = cleaned;
        this.selectionChange.emit(new Set(this.selectedIds));
      }
    }
  }

  ngAfterViewChecked(): void {
    this.syncHeaderIndeterminate();
  }

  // ── Selection helpers ────────────────────────────────────────
  get selectedCount(): number { return this.selectedIds.size; }

  get allSelected(): boolean {
    return this.data.length > 0 && this.data.every(r => this.selectedIds.has(r[this.rowKey]));
  }

  get isIndeterminate(): boolean {
    return this.selectedCount > 0 && !this.allSelected;
  }

  isRowSelected(row: any): boolean {
    return this.selectedIds.has(row[this.rowKey]);
  }

  toggleRow(row: any): void {
    const id = row[this.rowKey];
    const next = new Set(this.selectedIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    this.selectedIds = next;
    this.selectionChange.emit(new Set(this.selectedIds));
  }

  toggleAll(): void {
    if (this.allSelected) {
      // Deselect all current page rows
      const next = new Set(this.selectedIds);
      this.data.forEach(r => next.delete(r[this.rowKey]));
      this.selectedIds = next;
    } else {
      // Select all current page rows
      const next = new Set(this.selectedIds);
      this.data.forEach(r => next.add(r[this.rowKey]));
      this.selectedIds = next;
    }
    this.selectionChange.emit(new Set(this.selectedIds));
  }

  private syncHeaderIndeterminate(): void {
    this.headerCheckboxRefs?.forEach(ref => {
      if (ref?.nativeElement) {
        ref.nativeElement.indeterminate = this.isIndeterminate;
      }
    });
  }

  // ── Existing methods ─────────────────────────────────────────
  get displayTotal(): number {
    if (this.pagination && this.pagination.total != null) {
      return this.pagination.total;
    }
    return this.data ? this.data.length : 0;
  }

  getCellValue(row: any, key: string): any {
    return key.split('.').reduce((obj, k) => (obj && obj[k] != null ? obj[k] : ''), row);
  }

  formatValue(row: any, col: TableColumn): string {
    const val = this.getCellValue(row, col.key);
    switch (col.type) {
      case 'currency':
        return val != null && val !== ''
          ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(val))
          : '';
      case 'number':
        return val != null && val !== '' ? Number(val).toLocaleString('vi-VN') : '';
      case 'date':
        return val ? new Date(val).toLocaleDateString('vi-VN') : '';
      default:
        return val != null ? String(val) : '';
    }
  }

  isStatusColumn(col: TableColumn): boolean {
    return col.type === 'status' || col.type === 'badge';
  }

  isImageColumn(col: TableColumn): boolean { return col.type === 'image'; }

  onAction(event: ActionEvent): void { this.actionClick.emit(event); }

  onSort(col: TableColumn): void {
    if (!col.sortable) return;
    if (this.sortKey === col.key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = col.key;
      this.sortDir = 'asc';
    }
  }

  onPageChange(p: number): void { this.pageChange.emit(p); }
  onPageSizeChange(s: number): void { this.pageSizeChange.emit(s); }
}
