import { Component, Input, Output, EventEmitter, OnChanges, OnInit, SimpleChanges, HostListener } from '@angular/core';
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
export class AdminFilterComponent implements OnInit, OnChanges {
  @Input() fields: FilterField[] = [];
  @Output() filterChange = new EventEmitter<Record<string, any>>();
  @Output() filterReset = new EventEmitter<void>();

  isPanelOpen = false;
  values: Record<string, any> = {};
  activeFilters: ActiveFilter[] = [];

  ngOnInit(): void {
    this.syncValuesFromFields();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) this.syncValuesFromFields();
  }

  get activeCount(): number { return this.activeFilters.length; }

  togglePanel(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isPanelOpen = !this.isPanelOpen;
  }

  closePanel(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isPanelOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isPanelOpen) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && (target.closest('.admin-filter__panel') || target.closest('.admin-filter__btn'))) {
      return;
    }
    this.closePanel();
  }

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

  private syncValuesFromFields(): void {
    const fieldKeys = new Set(this.fields.map(field => field.key));
    Object.keys(this.values).forEach(key => {
      if (!fieldKeys.has(key)) delete this.values[key];
    });

    this.fields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(field, 'value')) {
        this.values[field.key] = field.value ?? '';
      } else if (!Object.prototype.hasOwnProperty.call(this.values, field.key)) {
        this.values[field.key] = '';
      }
    });
    this.buildActiveFilters();
  }
}
