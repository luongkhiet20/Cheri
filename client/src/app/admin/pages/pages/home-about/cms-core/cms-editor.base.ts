/**
 * cms-editor.base.ts — COMPONENT CHA dùng chung cho Home + About.
 * Gom toàn bộ logic trùng lặp (~70% của 2 file .ts, ~4000 dòng → ~450 dòng).
 * Component con chỉ khai báo `cfg` + phần đặc thù (vd. sản phẩm của Home).
 */
import { ChangeDetectorRef, Directive, OnDestroy, OnInit, inject } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable, Subject, throwError } from 'rxjs';
import { finalize, map, takeUntil } from 'rxjs/operators';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { ApiService } from '../../../../../services/api.service';
import {
  AnimationPreset, CmsSection, ColorKey, ConfigurableTypographyTarget, MotionPresetType,
  SectionAnimation, SectionColors, SectionCategory, SectionTypeOption, SectionTypography,
  TypographyConfig,
} from './cms.models';
import { SECTION_REGISTRY, getColorPropsForType, getFieldsForType } from './cms-section.registry';
import { CarouselController } from './cms-carousel.controller';

export interface CmsPageConfig<S extends CmsSection> {
  pageLabel: string;                       // 'Trang chủ' | 'Giới thiệu'
  livePath: string;                        // '/vi' | '/vi/about'
  initialSections: S[];
  typeOptions: SectionTypeOption[];
  load: () => Observable<any>;
  publish: (doc: { sections: S[] }) => Observable<any>;
  createSection: (type: string, order: number) => S;
  defaultTypography: (type: string) => SectionTypography;
  defaultColors: (type: string) => SectionColors;
}

// ── Motion preset: 1 bảng thay cho 2 × switch 60 dòng. (Hợp nhất theo giá trị của Home) ──
const MOTION: Record<MotionPresetType, (type: string) => SectionAnimation> = {
  minimal:   () => ({ preset: 'fade',       duration: 400,  delay: 0,   intensity: 'subtle', once: true }),
  subtle:    () => ({ preset: 'fade-up',    duration: 600,  delay: 50,  intensity: 'subtle', once: true }),
  normal:    () => ({ preset: 'fade-up',    duration: 750,  delay: 100, intensity: 'normal', once: true }),
  editorial: (t) => ({ preset: t === 'editorial' ? 'split-reveal' : 'reveal', duration: 900, delay: 150, intensity: 'normal', once: true }),
  luxury:    () => ({ preset: 'image-zoom', duration: 1200, delay: 200, intensity: 'subtle', once: true }),
  dynamic:   () => ({ preset: 'zoom-in',    duration: 650,  delay: 0,   intensity: 'strong', once: true }),
};
const DEFAULT_ANIM: SectionAnimation = { preset: 'fade-up', duration: 750, delay: 100, intensity: 'normal', once: true };
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const IMG_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_IMG = 10 * 1024 * 1024;

export type EditorTab = 'content' | 'media' | 'layout' | 'typography' | 'animation' | 'settings';

@Directive()
export abstract class CmsEditorBase<S extends CmsSection> implements OnInit, OnDestroy {
  protected readonly notify = inject(NotificationService);
  protected readonly api = inject(ApiService);
  protected readonly cdr = inject(ChangeDetectorRef);
  protected readonly destroy$ = new Subject<void>();
  protected abstract readonly cfg: CmsPageConfig<S>;

  // ── State ──
  sections: S[] = [];
  selectedSection: S | null = null;
  isLoadingDraft = false;
  isPublishing = false;
  hasUnsavedChanges = false;
  loadError = '';
  lastPublishedAt: Date | null = null;
  uploading = { desktop: false, mobile: false, carousel: false };

  isEditorOpen = false;
  editorActiveTab: EditorTab = 'content';
  isAddModalOpen = false;
  selectedAddCategory: 'ALL' | SectionCategory = 'ALL';
  sectionToDelete: S | null = null;
  isAnimationPlaying = false;
  previewViewport: 'desktop' | 'mobile' = 'desktop';
  isFullPreviewOpen = false;

  readonly carousel = new CarouselController(() => this.cdr.markForCheck());
  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  // ═════════ Lifecycle ═════════
  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void {
    this.destroy$.next(); this.destroy$.complete();
    this.carousel.stop();
    if (this.previewTimer) clearTimeout(this.previewTimer);
  }

  // ═════════ Load / Publish ═════════
  load(): void {
    this.isLoadingDraft = true; this.loadError = ''; this.cdr.markForCheck();
    this.cfg.load().pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingDraft = false; })).subscribe({
      next: (res: any) => {
        if (res?.error) {
          this.fail('Không thể tải cấu hình từ máy chủ: ' + (res.error.message || res.error.error || 'Lỗi xác thực hoặc kết nối'));
          return;
        }
        const server = res?.data?.sections ?? res?.sections;
        if (Array.isArray(server) && server.length) {
          this.sections = server;
          this.lastPublishedAt = res.data?.publishedAt ? new Date(res.data.publishedAt) : null;
        } else {
          this.sections = structuredClone(this.cfg.initialSections);
        }
        this.hasUnsavedChanges = false;
        this.afterLoad();
      },
      error: () => this.fail(`Lỗi kết nối khi tải cấu hình trang ${this.cfg.pageLabel}`),
    });
  }
  private fail(msg: string): void {
    this.loadError = msg; this.notify.error(msg);
    this.sections = structuredClone(this.cfg.initialSections);
    this.afterLoad();
  }
  /** Hook cho class con (Home: nạp sản phẩm...) */
  protected afterLoad(): void {
    this.renumber();
    this.sections.forEach((s) => this.normalize(s));
    this.selectSection(this.sections[0] ?? null);
    this.invalidateTargets();
    this.triggerAnimationPreview();
  }
  /** Bù các trường còn thiếu cho dữ liệu cũ (migration lười, idempotent) */
  protected normalize(s: S): void {
    s.typography ??= structuredClone(this.cfg.defaultTypography(s.type));
    s.colors ??= {};
    s.media ??= {};
    s.settings ??= {} as S['settings'];
    this.ensureAnimation(s);
    if (SECTION_REGISTRY[s.type]?.features.carousel && s.layout.variant === 'carousel') this.carousel.config(s);
  }

  /** Quy tắc riêng từng trang: trả về thông báo lỗi hoặc null. */
  protected validateSection(s: S): string | null {
    const has = (v?: string) => !!v?.trim();
    const c = s.content ?? {};
    const ok = has(s.media?.desktop?.url) || has(c.title) || has(c.quote) || has(c.description)
      || (s.media?.carouselSlides?.length ?? 0) > 0 || SECTION_REGISTRY[s.type]?.features.spacer;
    return ok ? null : `Phân đoạn "${s.name}" cần có ít nhất hình ảnh, tiêu đề, trích dẫn hoặc mô tả.`;
  }
  validateForPublish(): { valid: boolean; message: string } {
    const enabled = this.sections.filter((s) => s.enabled);
    if (!this.sections.length) return { valid: false, message: 'Danh sách phân đoạn trống.' };
    if (!enabled.length) return { valid: false, message: 'Tất cả phân đoạn đang bị ẩn. Hãy bật ít nhất 1 phân đoạn.' };
    for (const s of enabled) { const e = this.validateSection(s); if (e) return { valid: false, message: e }; }
    return { valid: true, message: 'Hợp lệ' };
  }
  /** Duyệt TẤT CẢ ảnh (kể cả slide) — bản About cũ bỏ sót carousel. */
  hasLocalImage(): boolean {
    const local = (u?: string) => !!u && u.startsWith('data:image');
    return this.sections.some((s) =>
      local(s.media?.desktop?.url) || local(s.media?.mobile?.url) ||
      (s.media?.carouselSlides ?? []).some((sl) => local(sl.url) || local(sl.mobileUrl)));
  }
  onPublish(): void {
    if (this.isPublishing || this.isLoadingDraft) return;
    const v = this.validateForPublish();
    if (!v.valid) { this.notify.error(v.message); return; }
    if (this.hasLocalImage()) { this.notify.error('Có ảnh đang ở dạng tạm thời. Hãy tải ảnh lên máy chủ trước khi xuất bản.'); return; }
    this.isPublishing = true; this.cdr.markForCheck();
    this.cfg.publish({ sections: this.sections }).pipe(takeUntil(this.destroy$), finalize(() => { this.isPublishing = false; this.cdr.markForCheck(); })).subscribe({
      next: (res: any) => {
        if (res?.error) return this.notify.error(`Không thể xuất bản ${this.cfg.pageLabel}: ` + (res.error.message || res.error.error || 'Lỗi máy chủ'));
        this.lastPublishedAt = new Date(); this.hasUnsavedChanges = false;
        this.notify.success(`Đã xuất bản ${this.cfg.pageLabel} thành công!`);
      },
      error: () => this.notify.error('Lỗi kết nối khi xuất bản. Cấu hình công khai hiện tại vẫn được giữ nguyên.'),
    });
  }
  onOpenLiveSite(): void { window.open(this.cfg.livePath, '_blank'); }

  // ═════════ Section list ═════════
  protected renumber(): void { this.sections.forEach((s, i) => (s.order = i + 1)); }
  /** Mọi thay đổi đi qua đây: 1 chỗ đặt dirty + CD + (tuỳ chọn) replay animation. */
  protected touch(opts: { replay?: boolean; targets?: boolean } = {}): void {
    this.hasUnsavedChanges = true;
    if (opts.targets) this.invalidateTargets();
    if (opts.replay) this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }
  trackById = (_: number, s: { id: string }) => s.id;

  get enabledSections(): S[] { return this._enabled(); }
  private _enCache: { src: S[]; sig: string; out: S[] } | null = null;
  private _enabled(): S[] {
    const sig = this.sections.map((s) => s.id + (s.enabled ? 1 : 0)).join('|');
    if (this._enCache?.src === this.sections && this._enCache.sig === sig) return this._enCache.out;
    const out = this.sections.filter((s) => s.enabled);
    this._enCache = { src: this.sections, sig, out };
    return out;
  }

  onDrop(e: CdkDragDrop<S[]>): void {
    if (e.previousIndex === e.currentIndex) return;
    moveItemInArray(this.sections, e.previousIndex, e.currentIndex);
    this.renumber(); this.notify.success('Đã cập nhật thứ tự các phân đoạn');
    this.touch({ replay: true, targets: true });
  }
  onToggleEnabled(s: S, e: MouseEvent): void {
    e.stopPropagation(); s.enabled = !s.enabled;
    this.notify.success(s.enabled ? `Đã bật "${s.name}"` : `Đã ẩn "${s.name}"`);
    this.touch();
  }
  selectSection(s: S | null): void {
    this.selectedSection = s;
    if (s) this.syncActiveTarget();
    this.carousel.start(s);
    this.cdr.markForCheck();
  }
  onSelectSection(s: S): void { this.selectSection(s); this.triggerAnimationPreview(); }
  onEditSection(s: S, e?: MouseEvent): void {
    e?.stopPropagation(); this.selectSection(s);
    this.editorActiveTab = 'content'; this.isEditorOpen = true; this.cdr.markForCheck();
  }
  onCloseEditor(): void { this.isEditorOpen = false; this.cdr.markForCheck(); }

  onDuplicateSection(s: S, e: MouseEvent): void {
    e.stopPropagation();
    const copy = structuredClone(s);
    copy.id = this.newId(s.type); copy.name = `${s.name} (Bản sao)`;
    this.sections.splice(this.sections.indexOf(s) + 1, 0, copy);
    this.renumber(); this.normalize(copy); this.selectSection(copy);
    this.notify.success(`Đã nhân bản "${s.name}"`);
    this.touch({ replay: true, targets: true });
  }
  onPromptDeleteSection(s: S, e: MouseEvent): void { e.stopPropagation(); this.sectionToDelete = s; this.cdr.markForCheck(); }
  onCancelDelete(): void { this.sectionToDelete = null; this.cdr.markForCheck(); }
  onConfirmDelete(): void {
    const d = this.sectionToDelete; if (!d) return;
    const i = this.sections.indexOf(d);
    this.sections.splice(i, 1); this.renumber();
    if (this.selectedSection === d) this.selectSection(this.sections[Math.min(i, this.sections.length - 1)] ?? null);
    if (!this.sections.length) this.isEditorOpen = false;
    this.sectionToDelete = null;
    this.notify.success(`Đã xoá "${d.name}"`); this.touch({ targets: true });
  }

  // Add modal
  get filteredSectionOptions(): SectionTypeOption[] {
    const all = this.cfg.typeOptions;
    return this.selectedAddCategory === 'ALL' ? all : all.filter((o) => o.category === this.selectedAddCategory);
  }
  onOpenAddModal(): void { this.isAddModalOpen = true; this.selectedAddCategory = 'ALL'; this.cdr.markForCheck(); }
  onCloseAddModal(): void { this.isAddModalOpen = false; this.cdr.markForCheck(); }
  onSelectNewSectionType(o: SectionTypeOption): void {
    const s = this.cfg.createSection(o.type, this.sections.length + 1);
    s.id = this.newId(o.type);
    this.sections.push(s); this.normalize(s);
    this.isAddModalOpen = false; this.onEditSection(s);
    this.notify.success(`Đã thêm "${o.name}"`); this.touch({ replay: true, targets: true });
  }
  protected newId(type: string): string { return `sec-${type}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`; }

  // ═════════ Animation (gộp 3 handler onCustomAnimation*Change → 1) ═════════
  ensureAnimation(s: S): SectionAnimation {
    const a = (s.animation ??= { ...DEFAULT_ANIM });
    a.preset ||= DEFAULT_ANIM.preset;
    if (!Number.isFinite(a.duration)) a.duration = DEFAULT_ANIM.duration;
    if (!Number.isFinite(a.delay)) a.delay = 0;
    a.intensity ||= 'normal';
    return a;
  }
  onApplyMotionPreset(p: MotionPresetType): void {
    const s = this.selectedSection; if (!s) return;
    s.motionPreset = p; s.isCustomAnimation = false; s.animation = MOTION[p](s.type);
    this.touch({ replay: true });
  }
  onSwitchToCustomAnimation(): void {
    if (!this.selectedSection) return;
    this.selectedSection.isCustomAnimation = true; this.touch({ replay: true });
  }
  /** Dùng cho preset / duration / delay / intensity; template: (change)="patchAnimation({duration: +$any($event.target).value})" */
  patchAnimation(patch: Partial<SectionAnimation>): void {
    const s = this.selectedSection; if (!s) return;
    const a = this.ensureAnimation(s);
    for (const k of Object.keys(patch) as (keyof SectionAnimation)[]) {
      const v = patch[k];
      if ((k === 'duration' || k === 'delay') && !Number.isFinite(v as number)) continue;
      (a as any)[k] = v;
    }
    s.isCustomAnimation = true; this.touch({ replay: true });
  }
  animationClass(s: S | null | undefined): string {
    const a = s?.animation;
    return this.isAnimationPlaying && a && a.preset !== 'none' ? `anim-${a.preset} anim-intensity-${a.intensity || 'normal'}` : '';
  }
  triggerAnimationPreview(): void {
    this.isAnimationPlaying = false; this.cdr.markForCheck();
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => { this.isAnimationPlaying = true; this.cdr.markForCheck(); }, 50);
  }

  /** CSS vars cho container section (nền + nút + animation) */
  containerStyle(s: S | null | undefined): Record<string, string> {
    if (!s) return {};
    const st: Record<string, string> = {};
    const bg = s.colors?.backgroundColor || s.settings?.bgColor; if (bg) st['background-color'] = bg;
    const c = s.colors ?? {};
    if (c.buttonTextColor) st['--sec-btn-color'] = c.buttonTextColor;
    if (c.buttonBackgroundColor) st['--sec-btn-bg'] = c.buttonBackgroundColor;
    if (c.buttonHoverTextColor) st['--sec-btn-hover-color'] = c.buttonHoverTextColor;
    if (c.buttonHoverBackgroundColor) st['--sec-btn-hover-bg'] = c.buttonHoverBackgroundColor;
    const a = s.animation;
    if (a && a.preset !== 'none') {
      const d = a.duration && a.duration > 0 ? `${a.duration}ms` : '750ms';
      const dl = a.delay != null && a.delay >= 0 ? `${a.delay}ms` : '0ms';
      Object.assign(st, { 'animation-duration': d, 'animation-delay': dl, '--anim-duration': d, '--anim-delay': dl });
    }
    return st;
  }

  // ═════════ Upload (1 pipeline cho desktop / mobile / slide) ═════════
  private validateImage(f: File): string | null {
    if (!IMG_TYPES.has(f.type)) return `File "${f.name}" không hợp lệ. Chỉ nhận JPG, PNG, WEBP, GIF, SVG.`;
    if (f.size > MAX_IMG) return `File "${f.name}" quá lớn (tối đa 10MB).`;
    return null;
  }
  extractUploadedUrl(res: any): string {
    if (!res) return '';
    if (typeof res === 'string') return /^(https?:)?\//.test(res) ? res : '';
    return res.secure_url || res.url || (Array.isArray(res.all) && res.all.length ? res.all[res.all.length - 1] : '') || '';
  }
  protected upload(file: File): Observable<string> {
    const err = this.validateImage(file);
    if (err) return throwError(() => new Error(err));
    return this.api.uploadImage({ fileToUpload: file, titleUrl: '' }).pipe(
      map((res: any) => {
        const url = this.extractUploadedUrl(res);
        if (!url) throw new Error(res?.error?.message || res?.error || 'Máy chủ không trả về URL ảnh hợp lệ');
        return url;
      }),
      takeUntil(this.destroy$));
  }
  onFileSelected(e: Event, target: 'desktop' | 'mobile'): void {
    const input = e.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file || !this.selectedSection) return;
    const sec = this.selectedSection;
    this.uploading[target] = true; this.cdr.markForCheck();
    this.upload(file).pipe(finalize(() => { this.uploading[target] = false; this.cdr.markForCheck(); })).subscribe({
      next: (url) => {
        (sec.media ??= {})[target] = { url, alt: file.name.replace(/\.[^/.]+$/, '') };
        this.notify.success(`Đã tải ảnh ${target} lên máy chủ`); this.touch({ replay: true });
      },
      error: (er) => this.notify.error(`Tải ảnh ${target} thất bại: ${er.message}`),
    });
  }
  onRemoveImage(target: 'desktop' | 'mobile'): void {
    if (!this.selectedSection?.media) return;
    this.selectedSection.media[target] = null;
    this.notify.success(`Đã gỡ ảnh ${target}`); this.touch({ replay: true });
  }
  /** Tải nhiều file song song, có giới hạn đồng thời = 3 */
  async uploadSlides(files: FileList | File[]): Promise<void> {
    const sec = this.selectedSection; if (!sec) return;
    const list = Array.from(files); this.uploading.carousel = true; this.cdr.markForCheck();
    const queue = [...list];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        try {
          const url = await new Promise<string>((ok, ko) => this.upload(f!).subscribe({ next: ok, error: ko }));
          this.carousel.add(sec, { url, alt: f.name.replace(/\.[^/.]+$/, '') });
        } catch (er: any) { this.notify.error(er.message); }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    this.uploading.carousel = false; this.touch({ replay: true, targets: true });
  }

  // ═════════ Typography + Color theo TARGET (thay cho 2 hệ "element" cũ ở About) ═════════
  targetGroups: { sectionId: string; sectionName: string; targets: ConfigurableTypographyTarget[] }[] = [];
  allTargets: ConfigurableTypographyTarget[] = [];
  activeTarget: ConfigurableTypographyTarget | null = null;
  colorErrors: Record<string, string> = {};
  private targetsDirty = true;

  protected invalidateTargets(): void { this.targetsDirty = true; this.rebuildTargets(); }
  /** Chỉ dựng lại khi cấu trúc đổi (thêm/xoá/sort/slide) — KHÔNG chạy mỗi lần gõ chữ. */
  private rebuildTargets(): void {
    if (!this.targetsDirty) return;
    this.targetsDirty = false;
    this.targetGroups = []; this.allTargets = [];
    for (const s of this.sections) {
      const def = SECTION_REGISTRY[s.type]; if (!def || def.features.spacer) continue;
      const name = s.name || def.name; const targets: ConfigurableTypographyTarget[] = [];
      const base = { sectionId: s.id, sectionName: name, sectionType: s.type };
      const isCarousel = s.layout?.variant === 'carousel' && def.features.carousel;

      if (isCarousel) {
        (s.media.carouselSlides ?? []).forEach((sl, i) => {
          for (const [fk, label, tk, ck] of [['title', 'Tiêu đề slide', 'heading', 'titleColor'], ['description', 'Mô tả slide', 'body', 'descriptionColor']] as const) {
            targets.push({ ...base, id: `${s.id}:slide_${sl.id}:${fk}`, slideId: sl.id, slideIndex: i, slideTitle: sl.title,
              fieldKey: fk, fieldLabel: label, typoElementKey: tk, colorKey: ck as ColorKey, isSlide: true,
              groupLabel: `Carousel / Slide ${i + 1}`, fullPathLabel: `Carousel / Slide ${i + 1} → ${label}` });
          }
        });
      }
      for (const f of getFieldsForType(s.type)) {
        if (isCarousel && (f.key === 'title' || f.key === 'description')) continue;
        targets.push({ ...base, id: `${s.id}:${f.key}`, fieldKey: f.key, fieldLabel: f.label, typoElementKey: f.typoKey,
          colorKey: f.colorKey, isButton: f.typoKey === 'button', groupLabel: name, fullPathLabel: `${name} → ${f.label}` });
      }
      this.targetGroups.push({ sectionId: s.id, sectionName: name, targets });
      this.allTargets.push(...targets);
    }
  }
  protected syncActiveTarget(): void {
    this.rebuildTargets();
    const sid = this.selectedSection?.id;
    if (this.activeTarget && this.activeTarget.sectionId === sid) return;
    this.activeTarget = this.allTargets.find((t) => t.sectionId === sid) ?? this.allTargets[0] ?? null;
  }
  onSelectTarget(id: string): void {
    this.activeTarget = this.allTargets.find((t) => t.id === id) ?? null;
    const sec = this.sections.find((s) => s.id === this.activeTarget?.sectionId);
    if (sec && sec !== this.selectedSection) this.selectSection(sec);
    this.cdr.markForCheck();
  }
  targetsOf(sectionId: string) { return this.targetGroups.find((g) => g.sectionId === sectionId)?.targets ?? []; }

  private sectionOf(t: ConfigurableTypographyTarget): S | undefined { return this.sections.find((s) => s.id === t.sectionId); }
  private slideOf(t: ConfigurableTypographyTarget) { return this.sectionOf(t)?.media.carouselSlides?.find((x) => x.id === t.slideId); }
  /** Key typography thực tế được lưu: slide dùng 'title'|'description', section dùng typoElementKey */
  private typoSlot(t: ConfigurableTypographyTarget): string { return t.isSlide ? t.fieldKey : t.typoElementKey; }

  targetTypography(t = this.activeTarget): TypographyConfig {
    if (!t) return {};
    const s = this.sectionOf(t); if (!s) return {};
    const def = this.cfg.defaultTypography(s.type) as any;
    const custom = t.isSlide ? this.slideOf(t)?.typography : (s.typography as any);
    const slot = this.typoSlot(t);
    return { ...(def?.[t.typoElementKey] ?? {}), ...(custom?.[slot] ?? {}) };
  }
  patchTargetTypography(patch: Partial<TypographyConfig>): void {
    const t = this.activeTarget; if (!t) return;
    const s = this.sectionOf(t); if (!s) return;
    const slot = this.typoSlot(t);
    const holder: any = t.isSlide ? (this.slideOf(t)!.typography ??= {}) : (s.typography ??= {});
    holder[slot] = { ...(holder[slot] ?? {}), ...patch };
    if (!t.isSlide) s.typography!.preset = 'custom';
    this.touch();
  }
  targetColor(t = this.activeTarget): string {
    if (!t) return '';
    const s = this.sectionOf(t); if (!s) return '';
    const src: any = t.isSlide ? this.slideOf(t)?.colors : s.colors;
    return src?.[t.colorKey] ?? (this.cfg.defaultColors(s.type) as any)[t.colorKey] ?? '';
  }
  /** Hex hợp lệ (#abc / #aabbcc, thêm '#' nếu thiếu); trả null nếu sai. */
  normalizeHex(v: string): string | null {
    const x = (v ?? '').trim(); const h = x.startsWith('#') ? x : '#' + x;
    return HEX_RE.test(h) ? h.toLowerCase() : null;
  }
  setTargetColor(raw: string): void {
    const t = this.activeTarget; if (!t) return;
    const hex = this.normalizeHex(raw);
    if (!hex) { this.colorErrors[t.id] = 'Mã màu không hợp lệ (vd: #1a1a1a)'; this.cdr.markForCheck(); return; }
    delete this.colorErrors[t.id];
    const s = this.sectionOf(t)!;
    const holder: any = t.isSlide ? (this.slideOf(t)!.colors ??= {}) : (s.colors ??= {});
    holder[t.colorKey] = hex; this.touch();
  }
  resetTarget(what: 'typography' | 'color' | 'both' = 'both'): void {
    const t = this.activeTarget; if (!t) return;
    const s = this.sectionOf(t)!; const slide = t.isSlide ? this.slideOf(t) : null;
    if (what !== 'color') delete ((slide?.typography ?? s.typography) as any)?.[this.typoSlot(t)];
    if (what !== 'typography') delete ((slide?.colors ?? s.colors) as any)?.[t.colorKey];
    delete this.colorErrors[t.id]; this.touch();
  }
  /** Áp preset typography cho TẤT CẢ section (giữ màu). */
  applyTypographyPresetToAll(preset: SectionTypography): void {
    for (const s of this.sections) s.typography = { ...structuredClone(preset), preset: preset.preset };
    this.notify.success('Đã áp dụng preset cho toàn bộ phân đoạn'); this.touch();
  }
  colorProps(s: S | null) { return s ? getColorPropsForType(s.type) : []; }
}
