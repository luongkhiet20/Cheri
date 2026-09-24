import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FilterField } from '../models/admin-table.models';

export interface ActiveFilter {
  key: string;
  label: string;
  value: string | number;
  displayValue: string;
}

@Component({
  selector: 'app-admin-filter',
  standalone: false,
  templateUrl: './admin-filter.component.html',
  styleUrls: ['./admin-filter.component.css']
})
export class AdminFilterComponent implements OnInit {
  @Input() fields: FilterField[] = [];
  @Output() filterChange = new EventEmitter<Record<string, any>>();
  @Output() filterReset = new EventEmitter<void>();

  isPanelOpen = false;
  values: Record<string, any> = {};
  activeFilters: ActiveFilter[] = [];

  ngOnInit(): void {
    this.fields.forEach(f => this.values[f.key] = '');
  }

  get activeCount(): number { return this.activeFilters.length; }

  togglePanel(): void { this.isPanelOpen = !this.isPanelOpen; }
  closePanel(): void  { this.isPanelOpen = false; }

  onFieldChange(field: FilterField, event: Event): void {
    const val = (event.target as HTMLSelectElement | HTMLInputElement).value;
    this.values[field.key] = val;
  }

  applyFilters(): void {
    this.buildActiveFilters();
    this.filterChange.emit({ ...this.values });
    this.closePanel();
  }

  removeFilter(key: string): void {
    this.values[key] = '';
    this.buildActiveFilters();
    this.filterChange.emit({ ...this.values });
  }

  resetAll(): void {
    this.fields.forEach(f => this.values[f.key] = '');
    this.activeFilters = [];
    this.filterReset.emit();
    this.filterChange.emit({ ...this.values });
    this.closePanel();
  }

  private buildActiveFilters(): void {
    this.activeFilters = this.fields
      .filter(f => this.values[f.key] !== '' && this.values[f.key] !== null && this.values[f.key] !== undefined)
      .map(f => {
        const val = this.values[f.key];
        const opt = f.options?.find(o => String(o.value) === String(val));
        return { key: f.key, label: f.label, value: val, displayValue: opt ? opt.label : String(val) };
      });
  }
}
