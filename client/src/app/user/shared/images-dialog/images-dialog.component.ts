import { CommonModule } from '@angular/common';
import { Component, HostListener, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-images-dialog',
  templateUrl: './images-dialog.component.html',
  styleUrls: ['./images-dialog.component.css'],
  imports: [CommonModule],
  standalone: true
})
export class ImagesDialogComponent implements OnInit {
  currentIndex: number = 0;
  images: string[] = [];
  isZoomed: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<ImagesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { index: number; images: string[] }
  ) {}

  ngOnInit(): void {
    this.images = Array.isArray(this.data?.images) ? this.data.images : [];
    const initialIndex = Number(this.data?.index) || 0;
    this.currentIndex = Math.max(0, Math.min(initialIndex, Math.max(0, this.images.length - 1)));
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.prevImg();
    } else if (event.key === 'ArrowRight') {
      this.nextImg();
    } else if (event.key === 'Escape') {
      this.onClose();
    }
  }

  prevImg(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.isZoomed = false;
    }
  }

  nextImg(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (this.currentIndex < this.images.length - 1) {
      this.currentIndex++;
      this.isZoomed = false;
    }
  }

  goToImage(index: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (index >= 0 && index < this.images.length) {
      this.currentIndex = index;
      this.isZoomed = false;
    }
  }

  toggleZoom(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isZoomed = !this.isZoomed;
  }

  onStageClick(event: MouseEvent): void {
    // Nếu nhấp vào vùng ngoài ảnh thì đóng popup
    const target = event.target as HTMLElement;
    if (target.classList.contains('cheri-lightbox-stage') || target.classList.contains('cheri-lightbox-viewport')) {
      this.onClose();
    }
  }

  onClose(): void {
    this.dialogRef.close(this.currentIndex);
  }
}
