import { Injectable, Inject, PLATFORM_ID, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  video = signal<string>('');

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  setVideo(url: string): void {
    this.video.set(url);
  }

  setCSSVariable(value: string, name: string): void {
    if (isPlatformBrowser(this.platformId) && this.document?.documentElement) {
      const varName = name.startsWith('--') ? name : `--${name}`;
      this.document.documentElement.style.setProperty(varName, value);
    }
  }

  setThemeColor(color: string, name: string): void {
    this.setCSSVariable(color, name);
  }

  getCSSVariable(name: string): string {
    if (isPlatformBrowser(this.platformId) && this.document?.documentElement) {
      const varName = name.startsWith('--') ? name : `--${name}`;
      return getComputedStyle(this.document.documentElement).getPropertyValue(varName).trim();
    }
    return '';
  }
}
