import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

@Component({
  selector: 'app-product-csv-modal',
  standalone: false,
  templateUrl: './product-csv-modal.component.html',
  styleUrls: ['./product-csv-modal.component.css']
})
export class ProductCsvModalComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<any>();

  // State
  selectedFile: File | null = null;
  fileName = '';
  fileSizeText = '';
  fileContent = '';
  isDragging = false;

  isValidating = false;
  isImporting = false;
  isCompleted = false;

  validationResult: any = null;
  importResult: any = null;
  errorMessage = '';

  // Filter preview rows
  previewFilter: 'all' | 'valid' | 'error' = 'all';

  constructor(private apiService: ApiService) {}

  get canImport(): boolean {
    return !!this.validationResult && this.validationResult.canImport && !this.isValidating && !this.isImporting;
  }

  get filteredRows(): any[] {
    if (!this.validationResult || !this.validationResult.rows) return [];
    if (this.previewFilter === 'valid') {
      return this.validationResult.rows.filter((r: any) => r.status === 'valid');
    }
    if (this.previewFilter === 'error') {
      return this.validationResult.rows.filter((r: any) => r.status === 'error');
    }
    return this.validationResult.rows;
  }

  // ── Download Template ──────────────────────────────────────
  downloadTemplate(): void {
    this.apiService.downloadProductCsvTemplate().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cheri_product_import_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.errorMessage = 'Lỗi khi tải file mẫu: ' + (err.error?.message || err.message);
      }
    });
  }

  // ── Drag & Drop / File Input ───────────────────────────────
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileChange(event: any): void {
    if (event.target.files && event.target.files.length > 0) {
      this.handleFile(event.target.files[0]);
    }
  }

  private handleFile(file: File): void {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.errorMessage = 'Chỉ chấp nhận file có định dạng .csv!';
      return;
    }

    this.selectedFile = file;
    this.fileName = file.name;
    this.fileSizeText = this.formatFileSize(file.size);
    this.errorMessage = '';
    this.validationResult = null;
    this.importResult = null;
    this.isCompleted = false;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.fileContent = e.target.result || '';
      // Automatically trigger validation after file loaded
      this.validateFile();
    };
    reader.onerror = () => {
      this.errorMessage = 'Không thể đọc nội dung file đã chọn.';
    };
    reader.readAsText(file, 'utf-8');
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // ── Validate CSV ───────────────────────────────────────────
  validateFile(): void {
    if (!this.fileContent) {
      this.errorMessage = 'Vui lòng chọn file CSV trước khi kiểm tra dữ liệu.';
      return;
    }

    this.isValidating = true;
    this.errorMessage = '';

    this.apiService.validateProductsCsv(this.fileContent).subscribe({
      next: (res) => {
        this.isValidating = false;
        this.validationResult = res;
        this.previewFilter = res.summary?.errorRows > 0 ? 'all' : 'all';
      },
      error: (err) => {
        this.isValidating = false;
        this.errorMessage = 'Lỗi kiểm tra dữ liệu: ' + (err.error?.message || err.message);
      }
    });
  }

  // ── Execute Import ─────────────────────────────────────────
  importProducts(): void {
    if (!this.canImport) return;

    this.isImporting = true;
    this.errorMessage = '';

    const payload = {
      csvContent: this.fileContent,
      products: this.validationResult?.products
    };

    this.apiService.importProductsCsv(payload).subscribe({
      next: (res) => {
        this.isImporting = false;
        this.isCompleted = true;
        this.importResult = res;
        // Emit imported event so parent products list reloads from API
        this.imported.emit(res);
      },
      error: (err) => {
        this.isImporting = false;
        this.errorMessage = 'Lỗi nhập dữ liệu vào MongoDB: ' + (err.error?.message || err.message);
      }
    });
  }

  // ── Download Error Report ──────────────────────────────────
  downloadErrorReport(): void {
    if (!this.validationResult || !this.validationResult.rows) return;
    const errorRows = this.validationResult.rows.filter((r: any) => r.status === 'error');
    if (errorRows.length === 0) return;

    const lines = [
      'BÁO CÁO LỖI NHẬP SẢN PHẨM BẰNG FILE CSV - CHÉRI STORE',
      `Thời gian: ${new Date().toLocaleString('vi-VN')}`,
      `Tổng số dòng lỗi: ${errorRows.length}`,
      '------------------------------------------------------------',
      'Dòng,Slug (titleUrl),Tên sản phẩm,Mã SKU,Chi tiết lỗi'
    ];

    for (const r of errorRows) {
      const errDetail = r.errors.join(' | ').replace(/"/g, '""');
      lines.push(`${r.rowNumber},"${r.titleUrl || ''}","${r.title || ''}","${r.sku || ''}","${errDetail}"`);
    }

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao_cao_loi_csv_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // ── Reset & Close ──────────────────────────────────────────
  resetModal(): void {
    this.selectedFile = null;
    this.fileName = '';
    this.fileSizeText = '';
    this.fileContent = '';
    this.validationResult = null;
    this.importResult = null;
    this.errorMessage = '';
    this.isValidating = false;
    this.isImporting = false;
    this.isCompleted = false;
    this.previewFilter = 'all';
  }

  closeModal(): void {
    this.resetModal();
    this.closed.emit();
  }
}
