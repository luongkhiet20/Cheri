import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-admin-card',
  standalone: false,
  templateUrl: './admin-card.component.html',
  styleUrls: ['./admin-card.component.css']
})
export class AdminCardComponent {
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() noPadding: boolean = false;
}
