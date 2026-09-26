import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminService } from '../../services/admin.service';
import { SignalStore } from '../../../store/signal.store';
import { accessTokenKey } from '../../../user/shared/constants';

@Component({
  selector: 'app-admin-header',
  standalone: false,
  templateUrl: './admin-header.component.html',
  styleUrls: ['./admin-header.component.css']
})
export class AdminHeaderComponent implements OnInit, OnDestroy {
  @Output() toggleMenu = new EventEmitter<void>();

  isUserMenuOpen = false;
  currentUser: any = null;
  private userSub: Subscription | null = null;

  onToggleMenu(): void {
    this.toggleMenu.emit();
  }

  constructor(
    private apiService: AdminService,
    private router: Router,
    private store: SignalStore,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    // Subscribe to reactive user updates (triggered when user updates profile or avatar)
    this.userSub = this.apiService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });

    // Fetch initial profile (only in browser)
    if (isPlatformBrowser(this.platformId)) {
      this.apiService.getAccountProfile().subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: () => { }
      });
    }
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

  onLogout(): void {
    this.closeUserMenu();
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(accessTokenKey);
        sessionStorage.clear();
        document.cookie = 'jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      } catch (e) {}
    }

    this.store.signOut(() => {
      this.router.navigate(['/vi/authorize/signin']);
    });
  }
}



