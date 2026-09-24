import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FilterField } from '../models/admin-table.models';

@Component({
  selector: 'app-admin-toolbar',
  standalone: false,
  templateUrl: './admin-toolbar.component.html',
  styleUrls: ['./admin-toolbar.component.css']
})
export class AdminToolbarComponent implements AfterViewChecked {

  // ── Existing Inputs ──────────────────────────────────────────
  @Input() searchPlaceholder: string = 'Tìm kiếm...';
  @Input() searchValue: string = '';
  @Input() filterFields: FilterField[] = [];
  @Input() isLoading: boolean = false;
  @Input() showFilter: boolean = true;
  @Input() showRefresh: boolean = true;

  // ── NEW: Selection & Total Inputs ────────────────────────────
  /** Show the select-all checkbox in the toolbar */
  @Input() selectable: boolean = false;
  /** Whether all rows on current page are selected */
  @Input() allSelected: boolean = false;
  /** Whether selection is partial (for indeterminate state) */
  @Input() indeterminate: boolean = false;
  /** Count of currently selected rows */
  @Input() selectedCount: number = 0;
  /** Total record count to display (prefers pagination.total) */
  @Input() total: number = 0;
  /** Show delete-selected button */
  @Input() showDeleteSelected: boolean = false;

  // ── Existing Outputs ─────────────────────────────────────────
  @Output() searchChange = new EventEmitter<string>();
  @Output() filterChange = new EventEmitter<Record<string, any>>();
  @Output() filterReset = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();

  // ── NEW: Selection Outputs ───────────────────────────────────
  /** Fired when user clicks the toolbar select-all checkbox */
  @Output() selectAllChange = new EventEmitter<void>();
  /** Fired when user clicks "Xóa đã chọn" */
  @Output() deleteSelected = new EventEmitter<void>();

  isRefreshing = false;

  @ViewChild('toolbarCheckbox') toolbarCheckboxRef!: ElementRef<HTMLInputElement>;

  ngAfterViewChecked(): void {
    if (this.toolbarCheckboxRef?.nativeElement) {
      this.toolbarCheckboxRef.nativeElement.indeterminate = this.indeterminate;
    }
  }

  get deleteLabel(): string {
    return this.selectedCount > 0
      ? `Xóa đã chọn (${this.selectedCount})`
      : 'Xóa đã chọn';
  }

  // ── Existing methods ─────────────────────────────────────────
  onSearch(val: string): void { this.searchChange.emit(val); }
  onFilter(values: Record<string, any>): void { this.filterChange.emit(values); }
  onFilterReset(): void { this.filterReset.emit(); }

  onRefresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.refresh.emit();
    setTimeout(() => { this.isRefreshing = false; }, 800);
  }

  onSelectAll(): void { this.selectAllChange.emit(); }
  onDeleteSelected(): void { this.deleteSelected.emit(); }
}
