import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef,
  Output,
  EventEmitter,
  HostListener,
  ViewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminService } from '../../services/admin.service';
import { SignalStore } from '../../../store/signal.store';
import { accessTokenKey } from '../../../user/shared/constants';
import { SettingsService } from '../../pages/settings/settings.service';
import { NotificationPopupComponent } from '../../shared/notification-popup/notification-popup.component';

@Component({
  selector: 'app-admin-header',
  standalone: false,
  templateUrl: './admin-header.component.html',
  styleUrls: ['./admin-header.component.css']
})
export class AdminHeaderComponent implements OnInit, OnDestroy {
  @Output() toggleMenu = new EventEmitter<void>();
  @ViewChild('notifPopup') notifPopup!: NotificationPopupComponent;

  isUserMenuOpen = false;
  currentUser: any = null;
  logoUrl: string = '';
  hasLogoError = false;
  unreadCount = 0;

  private userSub: Subscription | null = null;
  private settingsSub: Subscription | null = null;

  onToggleMenu(): void {
    this.toggleMenu.emit();
  }

  onToggleNotification(): void {
    this.closeUserMenu();
    this.notifPopup?.toggle();
  }

  onUnreadCountChange(count: number): void {
    this.unreadCount = count;
    this.cdr.markForCheck();
  }

  constructor(
    private apiService: AdminService,
    private settingsService: SettingsService,
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

    // Subscribe to reactive settings updates (triggered when settings are loaded or saved)
    this.settingsSub = this.settingsService.settings$.subscribe(settings => {
      if (settings?.site?.logo) {
        this.logoUrl = settings.site.logo;
        this.hasLogoError = false;
      } else if (settings?.site) {
        this.logoUrl = '';
      }
      this.cdr.markForCheck();
    });

    // Fetch initial profile & settings (only in browser to prevent SSR blocking)
    if (isPlatformBrowser(this.platformId)) {
      this.apiService.getAccountProfile().subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: () => { }
      });

      this.settingsService.getSettings().subscribe({
        next: (res) => {
          if (res?.success && res.data?.site?.logo) {
            this.logoUrl = res.data.site.logo;
            this.hasLogoError = false;
            this.cdr.markForCheck();
          }
        },
        error: () => { }
      });
    }
  }

  onLogoError(): void {
    this.hasLogoError = true;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
    if (this.settingsSub) {
      this.settingsSub.unsubscribe();
    }
  }

  get userInitial(): string {
    const name = this.currentUser?.fullName || this.currentUser?.name || this.currentUser?.username || 'A';
    return name.trim().charAt(0).toUpperCase();
  }

  toggleUserMenu(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isUserMenuOpen = !this.isUserMenuOpen;
    if (this.isUserMenuOpen) {
      this.notifPopup?.close();
    }
    this.cdr.markForCheck();
  }

  closeUserMenu(): void {
    if (this.isUserMenuOpen) {
      this.isUserMenuOpen = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isUserMenuOpen) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && (target.closest('.admin-header__user-menu') || target.closest('.admin-header__user-btn'))) {
      return;
    }
    this.closeUserMenu();
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
