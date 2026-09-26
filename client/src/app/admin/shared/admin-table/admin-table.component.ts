import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChildren, QueryList, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { TableColumn, RowAction, ActionEvent, PaginationConfig } from '../models/admin-table.models';

@Component({
  selector: 'app-admin-table',
  standalone: false,
  templateUrl: './admin-table.component.html',
  styleUrls: ['./admin-table.component.css']
})
export class AdminTableComponent implements OnChanges, AfterViewChecked {

  constructor(private cdr: ChangeDetectorRef) {}

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

  // ── Sorting Outputs ──────────────────────────────────────────
  /** Emits sort key and direction whenever sort state changes */
  @Output() sortChange = new EventEmitter<{ key: string; dir: 'asc' | 'desc'; column: TableColumn }>();

  // ── References for indeterminate checkbox ────────────────────
  @ViewChildren('headerCheckbox') headerCheckboxRefs!: QueryList<ElementRef<HTMLInputElement>>;

  @Input() sortKey: string = '';
  @Input() sortDir: 'asc' | 'desc' = 'asc';

  private _cachedData: any[] = [];
  private _cachedSortKey: string = '';
  private _cachedSortDir: 'asc' | 'desc' = 'asc';
  private _sortedData: any[] = [];

  get sortedData(): any[] {
    if (!this.sortKey) {
      return this.data || [];
    }
    if (
      this._cachedData === this.data &&
      this._cachedSortKey === this.sortKey &&
      this._cachedSortDir === this.sortDir
    ) {
      return this._sortedData;
    }
    this._cachedData = this.data;
    this._cachedSortKey = this.sortKey;
    this._cachedSortDir = this.sortDir;
    this._sortedData = this.sortData(this.data, this.sortKey, this.sortDir);
    return this._sortedData;
  }

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
      this.cdr.markForCheck();
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
    this.sortChange.emit({ key: this.sortKey, dir: this.sortDir, column: col });
    this.cdr.markForCheck();
  }

  sortData(data: any[], key: string, dir: 'asc' | 'desc'): any[] {
    if (!data || data.length === 0 || !key) {
      return data || [];
    }

    const col = this.columns.find(c => c.key === key);
    const colType = col?.type || 'text';
    const multiplier = dir === 'desc' ? -1 : 1;

    return [...data].sort((a, b) => {
      const valA = this.getCellValue(a, key);
      const valB = this.getCellValue(b, key);

      const isEmptyA = valA == null || valA === '';
      const isEmptyB = valB == null || valB === '';

      if (isEmptyA && isEmptyB) return 0;
      if (isEmptyA) return 1;
      if (isEmptyB) return -1;

      let cmp = 0;

      if (colType === 'number' || colType === 'currency') {
        const parseNum = (v: any): number => {
          if (typeof v === 'number') return v;
          if (!v && v !== 0) return NaN;
          const s = String(v).trim().replace(/\s+/g, '').replace(/₫|VND|\$/gi, '');
          if (s.includes('.') && !s.includes(',')) {
            if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
              return Number(s.replace(/\./g, ''));
            }
          }
          return Number(s.replace(/,/g, ''));
        };

        const numA = parseNum(valA);
        const numB = parseNum(valB);

        const isNaNA = isNaN(numA);
        const isNaNB = isNaN(numB);

        if (isNaNA && isNaNB) return 0;
        if (isNaNA) return 1;
        if (isNaNB) return -1;

        cmp = numA < numB ? -1 : numA > numB ? 1 : 0;
      } else if (colType === 'date') {
        const timeA = valA instanceof Date ? valA.getTime() : new Date(valA).getTime();
        const timeB = valB instanceof Date ? valB.getTime() : new Date(valB).getTime();

        const isNaNA = isNaN(timeA);
        const isNaNB = isNaN(timeB);

        if (isNaNA && isNaNB) return 0;
        if (isNaNA) return 1;
        if (isNaNB) return -1;

        cmp = timeA < timeB ? -1 : timeA > timeB ? 1 : 0;
      } else {
        const strA = String(valA).trim();
        const strB = String(valB).trim();
        cmp = strA.localeCompare(strB, 'vi', { sensitivity: 'base', numeric: true });
      }

      return cmp * multiplier;
    });
  }

  onPageChange(p: number): void { this.pageChange.emit(p); }
  onPageSizeChange(s: number): void { this.pageSizeChange.emit(s); }
}
