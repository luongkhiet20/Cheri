import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Product } from '../../shared/models';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-all-products',
  templateUrl: './all-products.component.html',
  styleUrls: ['./all-products.component.css'],
  standalone: false
})
export class AllProductsComponent implements OnChanges {
  @Input() allProducts: Product[] = [];
  @Input() lang: string = 'vi';
  @Input() currency: string = 'đ';

  @Output() getAllProducts = new EventEmitter<void>();
  @Output() editProduct = new EventEmitter<string>();
  @Output() deleteProduct = new EventEmitter<string>();

  searchQuery: string = '';
  viewMode: 'grid' | 'table' = 'table';
  filteredProducts: Product[] = [];

  constructor(private apiService: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allProducts']) {
      this.filterProducts();
    }
  }

  onSearchChange(): void {
    this.filterProducts();
  }

  filterProducts(): void {
    const list = this.allProducts || [];
    if (!this.searchQuery || !this.searchQuery.trim()) {
      this.filteredProducts = [...list];
      return;
    }
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredProducts = list.filter((p) => {
      const title = (p.title || p[this.lang]?.title || p['vi']?.title || '').toLowerCase();
      const titleUrl = (p.titleUrl || '').toLowerCase();
      const idStr = (p.id || p._id || '').toString().toLowerCase();
      const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
      return title.includes(q) || titleUrl.includes(q) || idStr.includes(q) || tags.includes(q);
    });
  }

  onRefresh(): void {
    this.getAllProducts.emit();
  }

  onEdit(titleUrl: string): void {
    this.editProduct.emit(titleUrl);
  }

  onDelete(product: Product, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const title = this.getProductTitle(product);
    if (confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${title}" không?`)) {
      const target = product.titleUrl || product.id || product._id;
      if (!target) return;
      this.deleteProduct.emit(target);
      this.apiService.removeProduct(target).subscribe({
        next: () => {
          this.allProducts = (this.allProducts || []).filter(
            (p) => (p.titleUrl || p.id || p._id) !== target
          );
          this.filterProducts();
        },
        error: (err) => {
          console.error('Lỗi khi xóa sản phẩm:', err);
          this.onRefresh();
        }
      });
    }
  }

  getProductTitle(product: Product): string {
    return product[this.lang]?.title || product['vi']?.title || product.title || product.titleUrl || 'Chưa đặt tên';
  }

  getProductPrice(product: Product): number {
    return product[this.lang]?.salePrice || product[this.lang]?.regularPrice || product['vi']?.salePrice || product['vi']?.regularPrice || product.salePrice || product.regularPrice || 0;
  }

  getOriginalPrice(product: Product): number | null {
    const langObj = product[this.lang] || product['vi'] || {};
    if (langObj.salePrice && langObj.regularPrice && langObj.regularPrice > langObj.salePrice) {
      return langObj.regularPrice;
    }
    if (product.salePrice && product.regularPrice && product.regularPrice > product.salePrice) {
      return product.regularPrice;
    }
    return null;
  }

  getProductStock(product: Product): string {
    return product[this.lang]?.stock || product.stock || 'Còn hàng';
  }

  isProductVisible(product: any): boolean {
    if (!product) return false;
    const langData = product[this.lang] || product['vi'] || {};
    if (langData.visibility !== undefined) {
      return !!langData.visibility;
    }
    if (product.visibility !== undefined) {
      return !!product.visibility;
    }
    return true;
  }

  toggleProductVisibility(product: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const current = this.isProductVisible(product);
    const newVal = !current;

    // Cập nhật UI ngay lập tức
    product.visibility = newVal;
    if (product[this.lang]) {
      product[this.lang].visibility = newVal;
    }
    if (product['vi']) {
      product['vi'].visibility = newVal;
    }

    // Gửi payload cập nhật đến server
    const languages = ['vi', 'en', 'sk', 'cs'];
    const updatePayload: any = {
      titleUrl: product.titleUrl,
      visibility: newVal,
    };
    for (const l of languages) {
      updatePayload[l] = {
        ...(product[l] || {}),
        visibility: newVal,
      };
    }

    this.apiService.editProduct(updatePayload).subscribe({
      next: () => {
        // Cập nhật thành công
      },
      error: (err) => {
        console.error('Lỗi khi cập nhật trạng thái hiển thị sản phẩm:', err);
        // Khôi phục lại trạng thái cũ nếu lỗi
        product.visibility = current;
        if (product[this.lang]) product[this.lang].visibility = current;
        if (product['vi']) product['vi'].visibility = current;
      }
    });
  }
}
