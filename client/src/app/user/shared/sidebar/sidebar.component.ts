import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnChanges, inject, ChangeDetectorRef } from '@angular/core';
import { of } from 'rxjs';
import { take, delay } from 'rxjs/operators';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { FormsModule } from '@angular/forms';
import { PriceFormatPipe } from '../../../pipes/price.pipe';
import { Category } from '../models';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
  imports: [CommonModule, RouterLink, TranslatePipe, PriceFormatPipe, MatSliderModule, MatSelectModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class SidebarComponent implements OnInit, OnChanges {
  private cdr = inject(ChangeDetectorRef);

  @Input() categories: Category[] = [];
  @Input() activeCategory?: string;
  @Input() activeCategories: string[] = [];
  @Input() minPrice: number = 0;
  @Input() maxPrice: number = 10000000;
  @Input() price: number = 0;
  @Input() filterMinPrice: number = 0;
  @Input() filterMaxPrice: number = 10000000;
  @Input() stock: string = 'all';
  @Input() rating: any = 0;
  @Input() selectedRatings: number[] = [];
  @Input() sortOptions: { name: string; id: string }[] = [];
  @Input() choosenSort: string = 'newest';
  @Input() currency: string = 'đ';
  @Input() lang: string = 'vi';
  @Input() activeFiltersCount: number = 0;

  @Output() changeMinPrice = new EventEmitter<number>();
  @Output() changeMaxPrice = new EventEmitter<number>();
  @Output() changeSort = new EventEmitter<string>();
  @Output() changeCategory = new EventEmitter<string>();
  @Output() changeCategories = new EventEmitter<string[]>();
  @Output() changeStock = new EventEmitter<string>();
  @Output() changeRating = new EventEmitter<any>();
  @Output() changeRatings = new EventEmitter<number[]>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() applyFilters = new EventEmitter<void>();

  // Local slider state
  localMin: number = 0;
  localMax: number = 10000000;

  // Input display text state
  inputMinStr: string = '0';
  inputMaxStr: string = '0';
  isMinInputFocused: boolean = false;
  isMaxInputFocused: boolean = false;
  private _debounceTimer: any = null;

  // Local multi-select lists
  selectedCategoryList: string[] = [];
  selectedRatingList: number[] = [];

  // Accordion states
  showCategories = true;
  showPrice = true;
  showStock = true;
  showRating = true;
  showSort = true;

  ngOnInit(): void {
    this._syncState();
  }

  ngOnChanges(): void {
    this._syncState();
  }

  private _syncState(): void {
    const rawMin = (this.filterMinPrice !== undefined && this.filterMinPrice !== null) ? this.filterMinPrice : (this.minPrice || 0);
    const rawMax = (this.filterMaxPrice !== undefined && this.filterMaxPrice !== null) ? this.filterMaxPrice : (this.price || this.maxPrice || 10000000);

    this.localMin = Math.max(this.minPrice || 0, Math.min(rawMin, rawMax));
    this.localMax = Math.min(this.maxPrice || 10000000, Math.max(rawMax, this.localMin));

    if (!this.isMinInputFocused) {
      this.inputMinStr = this._formatPrice(this.localMin);
    }
    if (!this.isMaxInputFocused) {
      this.inputMaxStr = this._formatPrice(this.localMax);
    }

    // Sync categories
    if (this.activeCategories && this.activeCategories.length > 0) {
      this.selectedCategoryList = [...this.activeCategories];
    } else if (this.activeCategory) {
      this.selectedCategoryList = this.activeCategory
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
    } else {
      this.selectedCategoryList = [];
    }

    // Sync ratings
    if (this.selectedRatings && this.selectedRatings.length > 0) {
      this.selectedRatingList = [...this.selectedRatings];
    } else if (Array.isArray(this.rating)) {
      this.selectedRatingList = [...this.rating];
    } else if (typeof this.rating === 'string' && this.rating.length > 0 && this.rating !== '0') {
      this.selectedRatingList = this.rating
        .split(',')
        .map((r: string) => Number(r))
        .filter((r: number) => !isNaN(r) && r > 0);
    } else if (typeof this.rating === 'number' && this.rating > 0) {
      this.selectedRatingList = [this.rating];
    } else {
      this.selectedRatingList = [];
    }

    this.cdr.markForCheck();
  }

  onInputChange(sort: string): void {
    this.changeSort.emit(sort);
  }

  // ── Range Slider Handlers ──
  onMinSliderChange(value: number): void {
    if (value === null || value === undefined || isNaN(value)) return;
    const clamped = Math.max(this.minPrice, Math.min(value, this.localMax));
    this.localMin = clamped;
    if (!this.isMinInputFocused) {
      this.inputMinStr = this._formatPrice(this.localMin);
    }
    this._scheduleFilterChange(true, this.localMin);
    this.cdr.markForCheck();
  }

  onMaxSliderChange(value: number): void {
    if (value === null || value === undefined || isNaN(value)) return;
    const clamped = Math.min(this.maxPrice, Math.max(value, this.localMin));
    this.localMax = clamped;
    if (!this.isMaxInputFocused) {
      this.inputMaxStr = this._formatPrice(this.localMax);
    }
    this._scheduleFilterChange(false, this.localMax);
    this.cdr.markForCheck();
  }

  // Backward compatibility aliases
  onMinPriceChange(value: number): void {
    this.onMinSliderChange(value);
  }

  onMaxPriceChange(value: number): void {
    this.onMaxSliderChange(value);
  }

  // ── Input Box Handlers ──
  onMinInputFocus(): void {
    this.isMinInputFocused = true;
    // Show clean number without formatting so user can backspace/type easily
    this.inputMinStr = this.localMin > 0 ? this.localMin.toString() : '';
  }

  onMinTextInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.inputMinStr = input.value;

    const trimmed = input.value.trim();
    if (!trimmed) {
      // Don't force 0 while typing
      return;
    }

    const parsed = this._parsePrice(trimmed);
    if (parsed !== null) {
      // Enforce localMin <= localMax
      if (parsed > this.localMax) {
        this.localMin = this.localMax;
      } else if (parsed >= this.minPrice) {
        this.localMin = parsed;
      }
      this._scheduleFilterChange(true, this.localMin);
      this.cdr.markForCheck();
    }
  }

  onMinInputBlur(): void {
    this.isMinInputFocused = false;
    this._finalizeMinInput();
  }

  private _finalizeMinInput(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    const parsed = this._parsePrice(this.inputMinStr);
    let finalVal = parsed !== null ? parsed : this.minPrice;
    if (finalVal < this.minPrice) finalVal = this.minPrice;
    if (finalVal > this.localMax) finalVal = this.localMax;
    if (finalVal > this.maxPrice) finalVal = this.maxPrice;

    this.localMin = finalVal;
    this.inputMinStr = this._formatPrice(this.localMin);
    this.changeMinPrice.emit(this.localMin);
    this.cdr.markForCheck();
  }

  onMaxInputFocus(): void {
    this.isMaxInputFocused = true;
    this.inputMaxStr = this.localMax > 0 ? this.localMax.toString() : '';
  }

  onMaxTextInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.inputMaxStr = input.value;

    const trimmed = input.value.trim();
    if (!trimmed) {
      return;
    }

    const parsed = this._parsePrice(trimmed);
    if (parsed !== null) {
      // Enforce localMax >= localMin and localMax <= maxPrice
      if (parsed < this.localMin) {
        this.localMax = this.localMin;
      } else if (parsed > this.maxPrice) {
        this.localMax = this.maxPrice;
      } else {
        this.localMax = parsed;
      }
      this._scheduleFilterChange(false, this.localMax);
      this.cdr.markForCheck();
    }
  }

  onMaxInputBlur(): void {
    this.isMaxInputFocused = false;
    this._finalizeMaxInput();
  }

  private _finalizeMaxInput(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    const parsed = this._parsePrice(this.inputMaxStr);
    let finalVal = parsed !== null ? parsed : this.maxPrice;
    if (finalVal > this.maxPrice) finalVal = this.maxPrice;
    if (finalVal < this.localMin) finalVal = this.localMin;
    if (finalVal < this.minPrice) finalVal = this.minPrice;

    this.localMax = finalVal;
    this.inputMaxStr = this._formatPrice(this.localMax);
    this.changeMaxPrice.emit(this.localMax);
    this.cdr.markForCheck();
  }

  onInputEnter(event: Event): void {
    (event.target as HTMLInputElement).blur();
  }

  private _scheduleFilterChange(isMin: boolean, value: number): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      if (isMin) {
        this.changeMinPrice.emit(value);
      } else {
        this.changeMaxPrice.emit(value);
      }
      this._debounceTimer = null;
    }, 350);
  }

  private _parsePrice(raw: string | number): number | null {
    if (raw === null || raw === undefined) return null;
    const str = String(raw).trim();
    if (str.startsWith('-')) return 0;
    const digitsOnly = str.replace(/[^\d]/g, '');
    if (!digitsOnly) return null;
    const num = parseInt(digitsOnly, 10);
    return isNaN(num) ? null : num;
  }

  private _formatPrice(val: number): string {
    if (val === null || val === undefined || isNaN(val)) return '0';
    const rounded = Math.round(val);
    return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  onApplyFilters(): void {
    this._finalizeMinInput();
    this._finalizeMaxInput();
    this.changeMinPrice.emit(this.localMin);
    this.changeMaxPrice.emit(this.localMax);
    this.applyFilters.emit();
  }

  onStockChange(val: string): void {
    this.changeStock.emit(val);
  }

  // Multi-select categories
  isCategorySelected(titleUrl: string): boolean {
    return this.selectedCategoryList.includes(titleUrl);
  }

  isAllCategoriesSelected(): boolean {
    return this.selectedCategoryList.length === 0;
  }

  onToggleCategory(titleUrl: string): void {
    if (!titleUrl) {
      // Clicked "Tất cả danh mục" -> clear selections
      this.selectedCategoryList = [];
    } else {
      if (this.selectedCategoryList.includes(titleUrl)) {
        this.selectedCategoryList = this.selectedCategoryList.filter(c => c !== titleUrl);
      } else {
        this.selectedCategoryList = [...this.selectedCategoryList, titleUrl];
      }
    }
    const catStr = this.selectedCategoryList.join(',');
    this.changeCategory.emit(catStr);
    this.changeCategories.emit(this.selectedCategoryList);
  }

  // Multi-select ratings
  isRatingSelected(stars: number): boolean {
    return this.selectedRatingList.includes(stars);
  }

  onToggleRating(stars: number): void {
    if (this.selectedRatingList.includes(stars)) {
      this.selectedRatingList = this.selectedRatingList.filter(r => r !== stars);
    } else {
      this.selectedRatingList = [...this.selectedRatingList, stars];
    }
    const ratVal = this.selectedRatingList.length > 0 ? this.selectedRatingList.join(',') : 0;
    this.changeRating.emit(ratVal);
    this.changeRatings.emit(this.selectedRatingList);
  }

  onClearFilters(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this.selectedCategoryList = [];
    this.selectedRatingList = [];
    this.localMin = this.minPrice || 0;
    this.localMax = this.maxPrice || 10000000;
    this.inputMinStr = this._formatPrice(this.localMin);
    this.inputMaxStr = this._formatPrice(this.localMax);
    this.clearFilters.emit();
    this.cdr.markForCheck();
  }

  trackById(_index: number, item: any) {
    return item.titleUrl;
  }

  getRatingStars(count: number): number[] {
    return Array(count).fill(0);
  }
}
