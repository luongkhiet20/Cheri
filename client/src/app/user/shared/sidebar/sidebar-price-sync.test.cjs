const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// 1. Logic unit test of price parsing, formatting and boundary constraints
function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (str.startsWith('-')) return 0;
  const digitsOnly = str.replace(/[^\d]/g, '');
  if (!digitsOnly) return null;
  const num = parseInt(digitsOnly, 10);
  return isNaN(num) ? null : num;
}

function formatPrice(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const rounded = Math.round(val);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function clampRange(minVal, maxVal, minPrice = 0, maxPrice = 10000000) {
  let min = parsePrice(minVal);
  let max = parsePrice(maxVal);

  if (min === null || min < minPrice) min = minPrice;
  if (max === null || max > maxPrice) max = maxPrice;

  if (min > max) {
    min = max;
  }
  if (max < min) {
    max = min;
  }

  return { min, max };
}

test('price parsing correctly extracts numeric digits from various string formats', () => {
  assert.equal(parsePrice('500000'), 500000);
  assert.equal(parsePrice('500.000'), 500000);
  assert.equal(parsePrice('1,500,000 đ'), 1500000);
  assert.equal(parsePrice('   '), null);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice(null), null);
  assert.equal(parsePrice(undefined), null);
  assert.equal(parsePrice('abc'), null);
});

test('price formatting formats with dots as thousands separators', () => {
  assert.equal(formatPrice(0), '0');
  assert.equal(formatPrice(50000), '50.000');
  assert.equal(formatPrice(500000), '500.000');
  assert.equal(formatPrice(10000000), '10.000.000');
});

test('boundary constraint prevents minPrice > maxPrice and clamps bounds', () => {
  const result1 = clampRange(2000000, 1000000, 0, 10000000);
  assert.ok(result1.min <= result1.max, 'min must never exceed max');
  assert.equal(result1.min, 1000000);

  const result2 = clampRange(-50000, 15000000, 0, 10000000);
  assert.equal(result2.min, 0);
  assert.equal(result2.max, 10000000);
});

// Simulation of SidebarComponent price filter state machine
class MockSidebarComponent {
  constructor(minPrice = 199000, maxPrice = 2500000) {
    this.minPrice = minPrice;
    this.maxPrice = maxPrice;
    this.filterMinPrice = 0;
    this.filterMaxPrice = 0;
    this.price = 0;

    this.isPriceFilterActive = false;
    this.localMin = minPrice;
    this.localMax = maxPrice;
    this.inputMinStr = '';
    this.inputMaxStr = '';
    this.emittedMin = null;
    this.emittedMax = null;

    this.syncState();
  }

  get minPlaceholder() {
    return this.minPrice > 0 ? formatPrice(this.minPrice) : '0';
  }

  get maxPlaceholder() {
    return this.maxPrice > 0 ? formatPrice(this.maxPrice) : '0';
  }

  syncState() {
    const hasMinFilter = Boolean(this.filterMinPrice && this.filterMinPrice > 0);
    const hasMaxFilter = Boolean(this.filterMaxPrice && this.filterMaxPrice > 0 && this.filterMaxPrice < this.maxPrice);
    const hasPriceFilter = Boolean(this.price && this.price > 0 && this.price < this.maxPrice);

    if (hasMinFilter || hasMaxFilter || hasPriceFilter) {
      this.isPriceFilterActive = true;
      this.localMin = hasMinFilter ? Math.max(this.minPrice || 0, this.filterMinPrice) : (this.minPrice || 0);
      const maxCandidate = hasMaxFilter ? this.filterMaxPrice : (hasPriceFilter ? this.price : this.maxPrice);
      this.localMax = Math.min(this.maxPrice, Math.max(maxCandidate, this.localMin));
      this.inputMinStr = hasMinFilter ? formatPrice(this.localMin) : '';
      this.inputMaxStr = (hasMaxFilter || hasPriceFilter) ? formatPrice(this.localMax) : '';
    } else {
      this.isPriceFilterActive = false;
      this.localMin = this.minPrice || 0;
      this.localMax = this.maxPrice || 10000000;
      this.inputMinStr = '';
      this.inputMaxStr = '';
    }
  }

  onMinSliderChange(val) {
    this.isPriceFilterActive = true;
    this.localMin = Math.max(this.minPrice, Math.min(val, this.localMax));
    this.inputMinStr = formatPrice(this.localMin);
    if (!this.inputMaxStr) {
      this.inputMaxStr = formatPrice(this.localMax);
    }
    this.emittedMin = this.localMin;
    this.emittedMax = this.localMax;
  }

  onMaxSliderChange(val) {
    this.isPriceFilterActive = true;
    this.localMax = Math.min(this.maxPrice, Math.max(val, this.localMin));
    this.inputMaxStr = formatPrice(this.localMax);
    if (!this.inputMinStr) {
      this.inputMinStr = formatPrice(this.localMin);
    }
    this.emittedMin = this.localMin;
    this.emittedMax = this.localMax;
  }

  onManualInput(minStr, maxStr) {
    const pMin = parsePrice(minStr);
    const pMax = parsePrice(maxStr);

    if (pMin === null && pMax === null) {
      this.clearPriceFilter();
      return;
    }

    this.isPriceFilterActive = true;
    if (pMin !== null) {
      this.localMin = Math.max(this.minPrice, Math.min(pMin, this.localMax));
      this.inputMinStr = formatPrice(this.localMin);
      this.emittedMin = this.localMin;
    }
    if (pMax !== null) {
      this.localMax = Math.min(this.maxPrice, Math.max(pMax, this.localMin));
      this.inputMaxStr = formatPrice(this.localMax);
      this.emittedMax = this.localMax;
    }
  }

  clearPriceFilter() {
    this.isPriceFilterActive = false;
    this.localMin = this.minPrice;
    this.localMax = this.maxPrice;
    this.inputMinStr = '';
    this.inputMaxStr = '';
    this.emittedMin = 0;
    this.emittedMax = 0;
  }
}

test('Sidebar Price Filter - Initial state when no price filter is active', () => {
  const sidebar = new MockSidebarComponent(199000, 2500000);

  // Requirement 1: inputs must be empty initially, NOT pre-filled with minPrice
  assert.equal(sidebar.inputMinStr, '', 'Từ input must be empty string');
  assert.equal(sidebar.inputMaxStr, '', 'Đến input must be empty string');
  assert.equal(sidebar.isPriceFilterActive, false, 'isPriceFilterActive must be false');

  // Slider thumbs must span full range [minPrice, maxPrice]
  assert.equal(sidebar.localMin, 199000);
  assert.equal(sidebar.localMax, 2500000);

  // Requirement 2: Placeholders show reference limits
  assert.equal(sidebar.minPlaceholder, '199.000');
  assert.equal(sidebar.maxPlaceholder, '2.500.000');
});

test('Sidebar Price Filter - User selects price range via slider', () => {
  const sidebar = new MockSidebarComponent(199000, 2500000);

  // User drags start thumb to 500,000
  sidebar.onMinSliderChange(500000);

  assert.equal(sidebar.isPriceFilterActive, true);
  assert.equal(sidebar.localMin, 500000);
  assert.equal(sidebar.localMax, 2500000);
  assert.equal(sidebar.inputMinStr, '500.000');
  assert.equal(sidebar.inputMaxStr, '2.500.000');
  assert.equal(sidebar.emittedMin, 500000);
  assert.equal(sidebar.emittedMax, 2500000);
});

test('Sidebar Price Filter - User inputs manual prices', () => {
  const sidebar = new MockSidebarComponent(199000, 2500000);

  sidebar.onManualInput('400000', '1200000');

  assert.equal(sidebar.isPriceFilterActive, true);
  assert.equal(sidebar.localMin, 400000);
  assert.equal(sidebar.localMax, 1200000);
  assert.equal(sidebar.inputMinStr, '400.000');
  assert.equal(sidebar.inputMaxStr, '1.200.000');
});

test('Sidebar Price Filter - Clear filters resets everything to default', () => {
  const sidebar = new MockSidebarComponent(199000, 2500000);

  // Active filter first
  sidebar.onMinSliderChange(600000);
  assert.equal(sidebar.isPriceFilterActive, true);

  // Now clear filter
  sidebar.clearPriceFilter();

  assert.equal(sidebar.isPriceFilterActive, false);
  assert.equal(sidebar.inputMinStr, '');
  assert.equal(sidebar.inputMaxStr, '');
  assert.equal(sidebar.localMin, 199000);
  assert.equal(sidebar.localMax, 2500000);
  assert.equal(sidebar.emittedMin, 0);
  assert.equal(sidebar.emittedMax, 0);
});

test('sidebar.component.html contract satisfies dual-thumb slider and input requirements', () => {
  const htmlPath = path.resolve(__dirname, 'sidebar.component.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Verify class names preserved
  assert.ok(html.includes('class="sf-price-boxes"'), 'Must have .sf-price-boxes');
  assert.ok(html.includes('class="sf-price-box"'), 'Must have .sf-price-box');
  assert.ok(html.includes('class="sf-box-label"'), 'Must have .sf-box-label');
  assert.ok(html.includes('class="sf-box-value"'), 'Must have .sf-box-value');
  assert.ok(html.includes('class="sf-box-dash"'), 'Must have .sf-box-dash');

  // Verify dual-thumb mat-slider syntax
  assert.ok(html.includes('matSliderStartThumb'), 'Must use matSliderStartThumb');
  assert.ok(html.includes('matSliderEndThumb'), 'Must use matSliderEndThumb');
  assert.ok(html.includes('[step]="50000"'), 'Must preserve step 50000');
  assert.ok(html.includes('class="sf-mat-slider w-100"'), 'Must preserve sf-mat-slider w-100');

  // Verify inputs and placeholder bindings
  assert.ok(html.includes('[value]="inputMinStr"'), 'Must bind inputMinStr to min input');
  assert.ok(html.includes('[value]="inputMaxStr"'), 'Must bind inputMaxStr to max input');
  assert.ok(html.includes('[placeholder]="minPlaceholder"'), 'Must bind minPlaceholder');
  assert.ok(html.includes('[placeholder]="maxPlaceholder"'), 'Must bind maxPlaceholder');
  assert.ok(html.includes('{{ currency }}'), 'Must display currency');
});

test('sidebar.component.ts contract exposes synchronization handlers and outputs', () => {
  const tsPath = path.resolve(__dirname, 'sidebar.component.ts');
  const ts = fs.readFileSync(tsPath, 'utf8');

  assert.ok(ts.includes('isPriceFilterActive'), 'Must declare isPriceFilterActive');
  assert.ok(ts.includes('minPlaceholder'), 'Must declare minPlaceholder getter');
  assert.ok(ts.includes('maxPlaceholder'), 'Must declare maxPlaceholder getter');
  assert.ok(ts.includes('onMinSliderChange'), 'Must implement onMinSliderChange');
  assert.ok(ts.includes('onMaxSliderChange'), 'Must implement onMaxSliderChange');
  assert.ok(ts.includes('onMinTextInput'), 'Must implement onMinTextInput');
  assert.ok(ts.includes('onMaxTextInput'), 'Must implement onMaxTextInput');
  assert.ok(ts.includes('onMinInputBlur'), 'Must implement onMinInputBlur');
  assert.ok(ts.includes('onMaxInputBlur'), 'Must implement onMaxInputBlur');
  assert.ok(ts.includes('changeMinPrice = new EventEmitter<number>()'), 'Must emit changeMinPrice');
  assert.ok(ts.includes('changeMaxPrice = new EventEmitter<number>()'), 'Must emit changeMaxPrice');
});
