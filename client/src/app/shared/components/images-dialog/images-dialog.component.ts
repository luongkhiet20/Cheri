import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslatePipe } from '../../../pipes/translate.pipe';

@Component({
    selector: 'app-images-dialog',
    templateUrl: './images-dialog.component.html',
    styleUrls: ['./images-dialog.component.css'],
    imports: [CommonModule, TranslatePipe]
})
export class ImagesDialogComponent implements OnInit {
  dialogRef = inject<MatDialogRef<ImagesDialogComponent>>(MatDialogRef);
  data = inject<{
    index: number;
    images: string[];
}>(MAT_DIALOG_DATA);

  openImages = {};

  ngOnInit(): void {
    this.openImages[this.data.index] = true;
  }

  prevImg(event: Event, i: number): void {
    event.stopPropagation();
    event.preventDefault();
    this.openImages[i] = false;
    this.openImages[i - 1] = true;
  }

  nextImg(event: Event, i: number): void {
    event.stopPropagation();
    event.preventDefault();
    this.openImages[i] = false;
    this.openImages[i + 1] = true;
  }

  onCloseImage(): void {
    this.dialogRef.close();
  }
}
