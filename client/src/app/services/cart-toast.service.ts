import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class CartToastService {
  constructor(
    private snackBar: MatSnackBar
  ) {}

  /**
   * Hiển thị Toast thông báo thêm giỏ hàng Chéri:
   * “✨Đã thêm sản phẩm vào giỏ✨”
   */
  show(): void {
    // Kích hoạt MatSnackBar với panelClass riêng biệt (hiển thị trên toàn bộ client user pages)
    this.snackBar.open('✨Đã thêm sản phẩm vào giỏ✨', undefined, {
      duration: 2300,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['cheri-cart-toast-snackbar']
    });
  }
}
