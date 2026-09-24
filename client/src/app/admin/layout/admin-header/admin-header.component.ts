import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-header',
  standalone: false,
  templateUrl: './admin-header.component.html',
  styleUrls: ['./admin-header.component.css']
})
export class AdminHeaderComponent implements OnInit, OnDestroy {
  isUserMenuOpen = false;
  currentUser: any = null;
  private userSub: Subscription | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to reactive user updates (triggered when user updates profile or avatar)
    this.userSub = this.apiService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Fetch initial profile
    this.apiService.getAccountProfile().subscribe({
      next: () => {},
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }

  get userInitial(): string {
    const name = this.currentUser?.fullName || this.currentUser?.name || this.currentUser?.username || 'A';
    return name.trim().charAt(0).toUpperCase();
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  navigateTo(path: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isUserMenuOpen = false;
    this.router.navigate([path]);
  }
}


