import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnChanges } from '@angular/core';
import { of } from 'rxjs';
import { take, delay } from 'rxjs/operators';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { FormsModule } from '@angular/forms';
import { PriceFormatPipe } from '../../../pipes/price.pipe';
import { Category } from '../../models';

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.css'],
    imports: [CommonModule, RouterLink, TranslatePipe, PriceFormatPipe, MatSliderModule, MatSelectModule, FormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true
})
export class SidebarComponent implements OnInit, OnChanges {
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

  // Local slider state
  localMin: number = 0;
  localMax: number = 10000000;

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
    this.localMin = this.filterMinPrice || this.minPrice || 0;
    this.localMax = this.filterMaxPrice || this.maxPrice || 10000000;

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
  }

  onInputChange(sort: string): void {
    this.changeSort.emit(sort);
  }

  onMinPriceChange(value: number): void {
    this.localMin = value;
    of('change').pipe(take(1), delay(300)).subscribe(() => {
      this.changeMinPrice.emit(value);
    });
  }

  onMaxPriceChange(value: number): void {
    this.localMax = value;
    of('change').pipe(take(1), delay(300)).subscribe(() => {
      this.changeMaxPrice.emit(value);
    });
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
    this.selectedCategoryList = [];
    this.selectedRatingList = [];
    this.clearFilters.emit();
  }

  trackById(_index: number, item: any) {
    return item.titleUrl;
  }

  getRatingStars(count: number): number[] {
    return Array(count).fill(0);
  }
}
