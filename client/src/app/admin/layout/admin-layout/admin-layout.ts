import { Component, ViewChild } from '@angular/core';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: false,
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayout {
  @ViewChild('sidebar') sidebar!: AdminSidebarComponent;

  toggleSidebar(): void {
    this.sidebar?.toggleMobile();
  }
}
