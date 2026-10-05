import { Component, ViewChild, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AdminSidebarComponent } from '../admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: false,
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayout implements OnInit, OnDestroy {
  @ViewChild('sidebar') sidebar!: AdminSidebarComponent;
  private routerSub?: Subscription;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.routerSub = this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        this.resetScrollToTop();
      });
    }
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  onActivateChild(): void {
    this.resetScrollToTop();
  }

  resetScrollToTop(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const scrollWrap = document.querySelector('.main-scroll-wrap') as HTMLElement | null;
    if (scrollWrap) {
      const prevBehavior = scrollWrap.style.scrollBehavior;
      scrollWrap.style.scrollBehavior = 'auto';
      scrollWrap.scrollTop = 0;
      scrollWrap.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto'
      });

      requestAnimationFrame(() => {
        if (scrollWrap) {
          scrollWrap.scrollTop = 0;
          scrollWrap.style.scrollBehavior = prevBehavior;
        }
      });
    }

    const adminMain = document.querySelector('.admin-main') as HTMLElement | null;
    if (adminMain) {
      adminMain.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  toggleSidebar(): void {
    this.sidebar?.toggleMobile();
  }
}
