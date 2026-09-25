import { Component, OnInit, Inject, PLATFORM_ID, Signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { TranslateService } from '../../../services/translate.service';
import { SignalStore } from '../../../store/signal.store';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { User, Order } from '../../shared/models';
import { accessTokenKey } from '../../shared/constants';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {
  user$: Signal<User>;
  userOrders$: Signal<Order[]>;
  lang$: Observable<string>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private translate: TranslateService,
    private router: Router
  ) {
    this.lang$ = this.translate.getLang$();
  }

  ngOnInit(): void {
    this.user$ = this.selectors.user;
    this.userOrders$ = this.selectors.userOrders;
  }

  getUserInitial(): string {
    const user = this.user$();
    if (!user) return 'C';
    const name = user.fullName || user.name || user.email || 'C';
    return name.charAt(0).toUpperCase();
  }

  getDisplayName(): string {
    const user = this.user$();
    if (!user) return 'Quý khách';
    return user.fullName || user.name || (user.email ? user.email.split('@')[0] : 'Quý khách');
  }

  getRoleLabel(): string {
    const user = this.user$();
    if (!user) return 'Thành viên';
    const roles = user.roles || (user.role ? [user.role] : []);
    if (roles.includes('admin')) {
      return 'Quản trị viên (Admin)';
    }
    return 'Khách hàng thân thiết (Member)';
  }

  onLogout(): void {
    const currentLang = (this.translate as any)?.lang || 'vi';
    const targetUrl = `/${currentLang}`;

    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(accessTokenKey);
        sessionStorage.clear();
        document.cookie = 'jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      } catch (e) { }
    }

    this.store.signOut(() => {
      if (isPlatformBrowser(this.platformId)) {
        window.location.href = targetUrl;
      }
    });
  }
}
