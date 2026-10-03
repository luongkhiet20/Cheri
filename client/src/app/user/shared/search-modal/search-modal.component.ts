import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '../../../services/translate.service';
import { ApiService } from '../../../services/api.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-search-modal',
  templateUrl: './search-modal.component.html',
  styleUrls: ['./search-modal.component.css'],
  imports: [CommonModule, FormsModule]
})
export class SearchModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  keyword: string = '';
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  isLoading: boolean = false;
  errorMessage: string = '';

  // 14. Suggestion chips
  suggestions: string[] = ['lụa', 'chân váy', 'đầm', 'satin'];

  private langSub: Subscription;
  currentLang: string = 'vi';

  private router = inject(Router);
  private translate = inject(TranslateService);
  private apiService = inject(ApiService);

  ngOnInit(): void {
    this.langSub = this.translate.getLang$().subscribe((l) => {
      this.currentLang = l || 'vi';
    });
  }

  ngOnDestroy(): void {
    if (this.langSub) this.langSub.unsubscribe();
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.errorMessage = '';
    this.close.emit();
  }

  selectSuggestion(chip: string): void {
    this.keyword = chip;
    this.errorMessage = '';
    this.submitSearch();
  }

  onFileSelected(event: any): void {
    this.errorMessage = '';
    const file = event?.target?.files?.[0];
    if (!file) return;

    // Validate mime type
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      this.errorMessage = 'Định dạng file không hợp lệ. Vui lòng chọn ảnh JPG, PNG hoặc WebP.';
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Kích thước file vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.';
      return;
    }

    this.selectedFile = file;
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.previewUrl = URL.createObjectURL(file);
  }

  removeImage(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.selectedFile = null;
    this.previewUrl = null;
    this.errorMessage = '';
  }

  triggerFileInput(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  submitSearch(): void {
    this.errorMessage = '';
    const trimmedKeyword = this.keyword ? this.keyword.trim().replace(/\s+/g, ' ') : '';

    if (!trimmedKeyword && !this.selectedFile) {
      this.errorMessage = 'Vui lòng nhập từ khóa hoặc tải ảnh lên để tìm kiếm.';
      return;
    }

    // CASE 1: Chỉ tìm bằng từ khóa
    if (trimmedKeyword && !this.selectedFile) {
      this.closeModal();
      this.router.navigate(['/' + this.currentLang + '/product/all'], {
        queryParams: { search: trimmedKeyword, page: 1 },
      });
      return;
    }

    // CASE 2 & CASE 3: Có ảnh (hoặc cả ảnh + từ khóa)
    if (this.selectedFile) {
      this.isLoading = true;
      this.apiService.searchByImage(this.selectedFile, trimmedKeyword).subscribe({
        next: (res: any) => {
          this.isLoading = false;
          let matchedProductIds: string | undefined = undefined;

          if (res?.success && Array.isArray(res.matches) && res.matches.length > 0) {
            matchedProductIds = res.matches.map((m: any) => m.productId).join(',');
          }

          this.closeModal();
          const queryParams: any = {
            imageSearch: '1',
            page: 1,
          };
          if (trimmedKeyword) {
            queryParams.search = trimmedKeyword;
          }
          if (matchedProductIds) {
            queryParams.productIds = matchedProductIds;
          }

          this.router.navigate(['/' + this.currentLang + '/product/all'], {
            queryParams,
          });
        },
        error: (err: any) => {
          this.isLoading = false;
          // Fallback grace: navigate to products page with keyword or error context
          this.closeModal();
          const queryParams: any = {
            imageSearch: '1',
            page: 1,
          };
          if (trimmedKeyword) {
            queryParams.search = trimmedKeyword;
          }
          this.router.navigate(['/' + this.currentLang + '/product/all'], {
            queryParams,
          });
        },
      });
    }
  }
}
