import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

import { Category } from '../../models';

@Component({
  selector: 'app-categories-list',
  templateUrl: './categories-list.component.html',
  styleUrls: ['./categories-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CommonModule]
})
export class CategoriesListComponent {
  @Input() categories: Category[];
  @Input() lang: string;
  @Input() withSlider = true;

  constructor() {}
}
