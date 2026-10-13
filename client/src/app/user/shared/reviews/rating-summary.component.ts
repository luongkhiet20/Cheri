import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReviewSummary } from './review.models';
import { formatReviewSummary, getStarFill } from './rating-view';

@Component({
  selector: 'app-rating-summary',
  standalone: true,
  templateUrl: './rating-summary.component.html',
  styleUrls: ['./rating-summary.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingSummaryComponent {
  @Input() summary: ReviewSummary = { average: null, count: 0 };
  @Input() showStars = false;
  @Input() interactive = false;
  @Output() readonly activate = new EventEmitter<void>();
  readonly stars = [0, 1, 2, 3, 4];
  get text(): string { return formatReviewSummary(this.summary); }
  starFill(index: number): number {
    return getStarFill(this.summary.count > 0 ? this.summary.average : null, index);
  }
  onActivate(event: Event): void {
    event.stopPropagation();
    if (this.interactive) this.activate.emit();
  }
}
