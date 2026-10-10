import {
  Component, OnInit, OnDestroy, ChangeDetectorRef,
  inject, PLATFORM_ID, HostListener, ElementRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AdminService } from '../../services/admin.service';

import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';

// ── Types ───────────────────────────────────────────────────────────────────
export interface DonutSegment {
  label: string; count: number; color: string;
  pct: number; offset: number; dash: number; variant: string;
}

export interface ChartPoint {
  label: string; date: string; revenue: number; ordersCount: number; fullDate?: string;
}

export interface CalendarDay {
  date: Date; day: number; inMonth: boolean;
  isToday: boolean; isStart: boolean; isEnd: boolean; inRange: boolean;
}

// ── Quick select presets ─────────────────────────────────────────────────────
const QUICK_PRESETS = [
  { key: '7d',         label: '7 ngày qua' },
  { key: '15d',        label: '15 ngày qua' },
  { key: '30d',        label: '30 ngày qua' },
  { key: 'this_month', label: 'Tháng này' },
  { key: 'last_month', label: 'Tháng trước' },
] as const;
type PresetKey = typeof QUICK_PRESETS[number]['key'];

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Tổng quan' }
  ];

  // ── Constants ──────────────────────────────────────────────────────────
  readonly LOW_STOCK_THRESHOLD = 5;
  readonly QUICK_PRESETS = QUICK_PRESETS;
  readonly WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  private readonly DONUT_COLORS = ['#74070E', '#C9868B', '#B7791F', '#4F7A5A', '#6B7280', '#B8A99A'];
  private readonly STATUS_ORDER = ['pending', 'processing', 'shipping', 'delivered', 'cancelled', 'returned'];
  private readonly STATUS_LABELS: Record<string, string> = {
    pending: 'Chờ xác nhận', processing: 'Đang xử lý', shipping: 'Đang giao',
    delivered: 'Đã giao', cancelled: 'Đã hủy', returned: 'Đã hoàn trả',
  };
  private readonly STATUS_VARIANTS: Record<string, string> = {
    pending: 'neutral', processing: 'warning', shipping: 'primary',
    delivered: 'success', cancelled: 'danger', returned: 'neutral',
  };

  private platformId = inject(PLATFORM_ID);
  private destroy$ = new Subject<void>();

  // ── Dashboard state ────────────────────────────────────────────────────
  stats: any = null;
  isLoading = true;
  isRefreshing = false;
  errorMessage = '';
  currentTimeRange = '7d';        // active preset key or 'custom'
  currentCustomStart: Date | null = null;
  currentCustomEnd: Date | null = null;
  lastUpdatedText = '';

  // Line chart
  hoveredPoint: ChartPoint | null = null;
  hoveredPointIndex = -1;
  readonly LINE_W = 600; readonly LINE_H = 160;
  readonly LINE_PAD_L = 52; readonly LINE_PAD_R = 12;
  readonly LINE_PAD_T = 12; readonly LINE_PAD_B = 28;

  // Donut
  donutSegments: DonutSegment[] = [];
  donutTotal = 0;
  hoveredSegmentIndex = -1;
  donutTooltip: { label: string; count: number; pct: number } | null = null;

  // ── Date Picker state ──────────────────────────────────────────────────
  pickerOpen = false;
  // Draught (pending) selection — only committed on "Áp dụng"
  draftStart: Date | null = null;
  draftEnd:   Date | null = null;
  draftPreset: string | null = null;   // which preset is highlighted inside picker
  selectingEnd = false;                 // true after first click (awaiting end date)
  hoverDate: Date | null = null;

  // Two-month calendar view
  leftMonth!: Date;   // first day of left calendar month
  rightMonth!: Date;  // first day of right calendar month

  leftCalendar: CalendarDay[][] = [];
  rightCalendar: CalendarDay[][] = [];

  constructor(
    private apiService: AdminService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initCalendarMonths();
      this.loadStats();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Close picker on Escape ─────────────────────────────────────────────
  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.pickerOpen) this.closePicker(false); }

  // ── Close picker on outside click ─────────────────────────────────────
  @HostListener('document:mousedown', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.pickerOpen) return;
    if (!this.elRef.nativeElement.querySelector('.date-picker-popup')?.contains(e.target as Node) &&
        !this.elRef.nativeElement.querySelector('.picker-trigger-btn')?.contains(e.target as Node)) {
      this.closePicker(false);
    }
  }

  // ── Data loading ────────────────────────────────────────────────────────
  loadStats(isRefresh = false): void {
    if (isRefresh) this.isRefreshing = true;
    else if (!this.stats) this.isLoading = true;
    this.errorMessage = '';

    let obs;
    if (this.currentTimeRange === 'custom' && this.currentCustomStart && this.currentCustomEnd) {
      obs = this.apiService.getDashboardStats(
        undefined,
        this.toISODate(this.currentCustomStart),
        this.toISODate(this.currentCustomEnd)
      );
    } else if (this.currentTimeRange === '15d') {
      // 15d not a backend preset — send as custom
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const start = new Date(end); start.setDate(end.getDate() - 14); start.setHours(0, 0, 0, 0);
      obs = this.apiService.getDashboardStats(undefined, this.toISODate(start), this.toISODate(end));
    } else {
      obs = this.apiService.getDashboardStats(this.currentTimeRange);
    }

    obs.subscribe({
      next: (res: any) => {
        this.isLoading = false; this.isRefreshing = false;
        if (res.success && res.stats) {
          this.stats = res.stats;
          this.lastUpdatedText = this.formatTimestamp(new Date());
          this.buildDonutSegments();
        } else {
          this.errorMessage = 'Không nhận được dữ liệu hợp lệ từ máy chủ.';
        }
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isLoading = false; this.isRefreshing = false;
        this.errorMessage = 'Không thể tải dữ liệu Dashboard từ MongoDB Atlas. Vui lòng kiểm tra kết nối.';
        console.error(err);
        this.cdr.markForCheck();
      }
    });
  }

  setTimeRange(range: string): void {
    if (this.currentTimeRange === range && range !== 'custom') return;
    if (this.isRefreshing) return;
    this.currentTimeRange = range;
    this.currentCustomStart = null; this.currentCustomEnd = null;
    this.loadStats(true);
  }

  // ── Date range label (header subtitle) ─────────────────────────────────
  getDateRangeLabel(): string {
    const now = new Date();
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    const fmtY = (d: Date) => `${fmt(d)}/${d.getFullYear()}`;

    if (this.currentTimeRange === 'custom' && this.currentCustomStart && this.currentCustomEnd) {
      return `${fmtY(this.currentCustomStart)} – ${fmtY(this.currentCustomEnd)}`;
    }
    if (this.currentTimeRange === 'this_month') {
      return `01/${String(now.getMonth()+1).padStart(2,'0')} – ${fmt(now)}`;
    }
    if (this.currentTimeRange === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return `01/${String(lm.getMonth()+1).padStart(2,'0')} – ${fmt(lastDay)}`;
    }
    const days = this.currentTimeRange === '30d' ? 30 : this.currentTimeRange === '15d' ? 15 : 7;
    const from = new Date(now); from.setDate(now.getDate() - days + 1);
    return `${fmt(from)} – ${fmt(now)}`;
  }

  // ── Revenue change % ────────────────────────────────────────────────────
  getChangePct(): number | null {
    const prev = this.stats?.prevPeriodRevenue, curr = this.stats?.totalRevenue;
    if (prev == null || curr == null || prev === 0) return null;
    return +((curr - prev) / prev * 100).toFixed(1);
  }

  getPeriodOrdersChangePct(): number | null {
    const prev = this.stats?.prevPeriodOrdersCount, curr = this.stats?.ordersCount;
    if (prev == null || curr == null || prev === 0) return null;
    return +((curr - prev) / prev * 100).toFixed(1);
  }

  formatTimestamp(date: Date): string {
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())} – ${p(date.getDate())}/${p(date.getMonth()+1)}/${date.getFullYear()}`;
  }

  // ── DATE PICKER ──────────────────────────────────────────────────────────

  private initCalendarMonths(): void {
    const now = new Date();
    this.leftMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    this.rightMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    this.rebuildCalendars();
  }

  openPicker(): void {
    // Initialise draught from current active range
    const { start, end } = this.getActiveDateRange();
    this.draftStart   = start;
    this.draftEnd     = end;
    this.draftPreset  = this.currentTimeRange !== 'custom' ? this.currentTimeRange : null;
    this.selectingEnd = false;
    this.hoverDate    = null;
    // Scroll calendar so draftStart is visible
    if (this.draftStart) {
      this.leftMonth  = new Date(this.draftStart.getFullYear(), this.draftStart.getMonth(), 1);
      this.rightMonth = new Date(this.draftStart.getFullYear(), this.draftStart.getMonth() + 1, 1);
    } else {
      this.initCalendarMonths();
    }
    this.rebuildCalendars();
    this.pickerOpen = true;
    this.cdr.markForCheck();
  }

  closePicker(apply: boolean): void {
    if (apply && this.draftStart && this.draftEnd) {
      if (this.draftPreset && this.draftPreset !== 'custom') {
        this.currentTimeRange = this.draftPreset;
        this.currentCustomStart = null; this.currentCustomEnd = null;
      } else {
        this.currentTimeRange = 'custom';
        this.currentCustomStart = this.draftStart;
        this.currentCustomEnd   = this.draftEnd;
      }
      this.loadStats(true);
    }
    this.pickerOpen = false;
    this.cdr.markForCheck();
  }

  selectPreset(key: string): void {
    this.draftPreset = key;
    const { start, end } = this.calcPresetRange(key as PresetKey);
    this.draftStart = start; this.draftEnd = end;
    this.selectingEnd = false;
    // Navigate calendar to show draftStart
    if (start) {
      this.leftMonth  = new Date(start.getFullYear(), start.getMonth(), 1);
      this.rightMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    }
    this.rebuildCalendars();
    this.cdr.markForCheck();
  }

  onDayClick(day: CalendarDay): void {
    if (!day.inMonth) return;
    if (!this.selectingEnd || !this.draftStart) {
      // First click: set start
      this.draftStart = day.date;
      this.draftEnd = null;
      this.draftPreset = null;
      this.selectingEnd = true;
    } else {
      // Second click: set end
      if (day.date < this.draftStart) {
        // Clicked before start → restart
        this.draftStart = day.date; this.draftEnd = null; this.selectingEnd = true;
      } else {
        this.draftEnd = day.date; this.selectingEnd = false;
      }
    }
    this.rebuildCalendars();
    this.cdr.markForCheck();
  }

  onDayHover(day: CalendarDay): void {
    if (this.selectingEnd && this.draftStart) {
      this.hoverDate = day.date;
      this.rebuildCalendars();
      this.cdr.markForCheck();
    }
  }

  onCalendarLeave(): void {
    this.hoverDate = null;
    this.rebuildCalendars();
    this.cdr.markForCheck();
  }

  prevMonth(): void {
    this.leftMonth  = new Date(this.leftMonth.getFullYear(), this.leftMonth.getMonth() - 1, 1);
    this.rightMonth = new Date(this.leftMonth.getFullYear(), this.leftMonth.getMonth() + 1, 1);
    this.rebuildCalendars();
  }

  nextMonth(): void {
    this.leftMonth  = new Date(this.leftMonth.getFullYear(), this.leftMonth.getMonth() + 1, 1);
    this.rightMonth = new Date(this.leftMonth.getFullYear(), this.leftMonth.getMonth() + 1, 1);
    this.rebuildCalendars();
  }

  private rebuildCalendars(): void {
    this.leftCalendar  = this.buildMonthGrid(this.leftMonth);
    this.rightCalendar = this.buildMonthGrid(this.rightMonth);
  }

  private buildMonthGrid(firstOfMonth: Date): CalendarDay[][] {
    const y = firstOfMonth.getFullYear(), m = firstOfMonth.getMonth();
    const today = new Date(); today.setHours(0,0,0,0);
    // Mon=0..Sun=6 for our grid (Monday-first)
    const dayOfWeek = (d: Date) => (d.getDay() + 6) % 7;
    const startPad = dayOfWeek(firstOfMonth);
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const cells: CalendarDay[] = [];
    // Prev-month padding
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(y, m, -i); d.setHours(0,0,0,0);
      cells.push(this.makeDay(d, false, today));
    }
    // This month
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d); dt.setHours(0,0,0,0);
      cells.push(this.makeDay(dt, true, today));
    }
    // Next-month padding to fill rows
    let day = 1;
    while (cells.length % 7 !== 0) {
      const dt = new Date(y, m + 1, day++); dt.setHours(0,0,0,0);
      cells.push(this.makeDay(dt, false, today));
    }
    // Chunk into weeks
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7));
    return weeks;
  }

  private makeDay(date: Date, inMonth: boolean, today: Date): CalendarDay {
    const t = date.getTime();
    const effectiveEnd = (this.selectingEnd && this.hoverDate && this.draftStart)
      ? (this.hoverDate >= this.draftStart ? this.hoverDate : null)
      : this.draftEnd;
    const s = this.draftStart?.getTime();
    const e = effectiveEnd?.getTime();
    return {
      date, day: date.getDate(), inMonth,
      isToday: date.getTime() === today.getTime(),
      isStart: s != null && t === s,
      isEnd:   e != null && t === e,
      inRange: s != null && e != null && t > s && t < e,
    };
  }

  private calcPresetRange(key: PresetKey): { start: Date; end: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (key) {
      case '7d': {
        const s = new Date(today); s.setDate(today.getDate() - 6);
        return { start: s, end: endOfToday };
      }
      case '15d': {
        const s = new Date(today); s.setDate(today.getDate() - 14);
        return { start: s, end: endOfToday };
      }
      case '30d': {
        const s = new Date(today); s.setDate(today.getDate() - 29);
        return { start: s, end: endOfToday };
      }
      case 'this_month':
        return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: endOfToday };
      case 'last_month': {
        const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const e = new Date(today.getFullYear(), today.getMonth(), 0);
        return { start: s, end: e };
      }
    }
  }

  private getActiveDateRange(): { start: Date | null; end: Date | null } {
    if (this.currentTimeRange === 'custom') {
      return { start: this.currentCustomStart, end: this.currentCustomEnd };
    }
    if (QUICK_PRESETS.find(p => p.key === this.currentTimeRange)) {
      return this.calcPresetRange(this.currentTimeRange as PresetKey);
    }
    return { start: null, end: null };
  }

  // ── Picker display helpers ───────────────────────────────────────────────
  getPickerRangeLabel(): string {
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const effectiveEnd = this.draftEnd ??
      (this.selectingEnd && this.hoverDate && this.draftStart && this.hoverDate >= this.draftStart
        ? this.hoverDate : null);
    if (this.draftStart && effectiveEnd) return `${fmt(this.draftStart)} – ${fmt(effectiveEnd)}`;
    if (this.draftStart) return `${fmt(this.draftStart)} – chọn ngày kết thúc…`;
    return 'Chọn khoảng ngày';
  }

  monthTitle(d: Date): string {
    return `Tháng ${d.getMonth() + 1} ${d.getFullYear()}`;
  }

  canApply(): boolean {
    return !!(this.draftStart && this.draftEnd);
  }

  private toISODate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // ── LINE CHART helpers ──────────────────────────────────────────────────
  getTimeline(): ChartPoint[] { return this.stats?.revenueTimeline || []; }

  getMaxRevenue(): number {
    const pts = this.getTimeline();
    if (!pts.length) return 1000000;
    const m = Math.max(...pts.map(p => p.revenue || 0));
    return m > 0 ? m : 1000000;
  }

  private xOf(i: number, total: number): number {
    if (total <= 1) return this.LINE_PAD_L;
    return this.LINE_PAD_L + (i / (total - 1)) * (this.LINE_W - this.LINE_PAD_L - this.LINE_PAD_R);
  }

  private yOf(rev: number): number {
    const max = this.getMaxRevenue();
    const ratio = max > 0 ? rev / max : 0;
    return this.LINE_PAD_T + (1 - ratio) * (this.LINE_H - this.LINE_PAD_T - this.LINE_PAD_B);
  }

  getLinePath(): string {
    const pts = this.getTimeline(); if (!pts.length) return '';
    const n = pts.length;
    return pts.map((p, i) => `${i===0?'M':'L'}${this.xOf(i,n).toFixed(1)},${this.yOf(p.revenue).toFixed(1)}`).join(' ');
  }

  getAreaPath(): string {
    const pts = this.getTimeline(); if (!pts.length) return '';
    const n = pts.length;
    const bottom = (this.LINE_H - this.LINE_PAD_B).toFixed(1);
    const line = pts.map((p, i) => `${i===0?'M':'L'}${this.xOf(i,n).toFixed(1)},${this.yOf(p.revenue).toFixed(1)}`).join(' ');
    return `${line} L${this.xOf(n-1,n).toFixed(1)},${bottom} L${this.xOf(0,n).toFixed(1)},${bottom} Z`;
  }

  getChartPoints(): Array<{ x: number; y: number; point: ChartPoint }> {
    const pts = this.getTimeline(), n = pts.length;
    return pts.map((p, i) => ({ x: this.xOf(i, n), y: this.yOf(p.revenue), point: p }));
  }

  getYTicks(): Array<{ y: number; label: string }> {
    const max = this.getMaxRevenue();
    return [0, 0.25, 0.5, 0.75, 1].map(r => ({ y: this.yOf(max*r), label: this.fmtTick(max*r) }));
  }

  private fmtTick(v: number): string {
    if (v >= 1e9) return `${(v/1e9).toFixed(v%1e9===0?0:1)}T`;
    if (v >= 1e6) return `${(v/1e6).toFixed(v%1e6===0?0:1)}M`;
    if (v >= 1e3) return `${Math.round(v/1e3)}K`;
    return v === 0 ? '0' : `${v}`;
  }

  getXLabels(): Array<{ x: number; label: string; show: boolean }> {
    const pts = this.getTimeline(), n = pts.length;
    return pts.map((p, i) => {
      let show = true;
      if (n > 10) { const step = Math.ceil(n/7); show = i===0 || i===n-1 || i%step===0; }
      return { x: this.xOf(i, n), label: p.label, show };
    });
  }

  onChartPointHover(idx: number, point: ChartPoint): void { this.hoveredPoint = point; this.hoveredPointIndex = idx; }
  onChartLeave(): void { this.hoveredPoint = null; this.hoveredPointIndex = -1; }

  getTooltipX(i: number): number {
    return Math.min(this.xOf(i, this.getTimeline().length), this.LINE_W - 140);
  }

  formatVND(v: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);
  }

  // ── DONUT helpers ────────────────────────────────────────────────────────
  buildDonutSegments(): void {
    if (!this.stats?.ordersByStatus) { this.donutSegments = []; this.donutTotal = 0; return; }
    const s = this.stats.ordersByStatus;
    const CIRC = 2 * Math.PI * 54;
    const counts = this.STATUS_ORDER.map(k => s[k] || 0);
    const total = counts.reduce((a, b) => a + b, 0);
    this.donutTotal = total;
    if (total === 0) { this.donutSegments = []; return; }
    let cumOffset = 0;
    this.donutSegments = this.STATUS_ORDER.map((key, i) => {
      const count = counts[i], pct = +(count/total*100).toFixed(1);
      const dash = count/total*CIRC, gap = count > 0 ? 2 : 0;
      const seg: DonutSegment = { label: this.STATUS_LABELS[key], count, color: this.DONUT_COLORS[i], pct,
        dash: Math.max(0, dash-gap), offset: CIRC - cumOffset, variant: this.STATUS_VARIANTS[key] };
      cumOffset += dash;
      return seg;
    });
    this.cdr.markForCheck();
  }

  onDonutHover(i: number): void {
    this.hoveredSegmentIndex = i;
    const seg = this.donutSegments[i];
    if (seg) this.donutTooltip = { label: seg.label, count: seg.count, pct: seg.pct };
    this.cdr.markForCheck();
  }

  onDonutLeave(): void { this.hoveredSegmentIndex = -1; this.donutTooltip = null; this.cdr.markForCheck(); }

  trackById = (_: number, s: { id: string }) => s.id;

  // ── Navigation ──────────────────────────────────────────────────────────
  navigateOrders(): void { this.router.navigate(['/admin/orders']); }
  navigateOrdersByStatus(s: string): void { this.router.navigate(['/admin/orders'], { queryParams: { status: s } }); }
  navigateOrderDetail(id: string): void { if (!id) return; this.router.navigate(['/admin/orders', id]); }
  navigateProducts(k?: string, v?: string): void {
    if (k && v) this.router.navigate(['/admin/products'], { queryParams: { [k]: v } });
    else this.router.navigate(['/admin/products']);
  }
  navigateProductEdit(id: string): void { if (!id) return; this.router.navigate(['/admin/products', id, 'edit']); }
  navigateProductAdd(): void { this.router.navigate(['/admin/products/add']); }
  navigateUsers(): void { this.router.navigate(['/admin/users']); }
  navigateCategories(): void { this.router.navigate(['/admin/categories']); }
}
