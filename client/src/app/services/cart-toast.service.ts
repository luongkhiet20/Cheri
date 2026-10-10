import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService } from '../admin/shared/notification/notification.service';

@Injectable({
  providedIn: 'root'
})
export class CartToastService {
  constructor(
    private snackBar: MatSnackBar,
    private notificationService: NotificationService
  ) {}

  /**
   * Hiển thị Toast thông báo thêm giỏ hàng Chéri:
   * “✨Đã thêm sản phẩm vào giỏ✨”
   */
  show(): void {
    // 1. Kích hoạt MatSnackBar với panelClass riêng biệt (hiển thị trên toàn bộ client user pages)
    this.snackBar.open('✨Đã thêm sản phẩm vào giỏ✨', undefined, {
      duration: 2300,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['cheri-cart-toast-snackbar']
    });

    // 2. Kích hoạt song song NotificationService
    this.notificationService.cartSuccess('✨Đã thêm sản phẩm vào giỏ✨', 2300);
  }
}
