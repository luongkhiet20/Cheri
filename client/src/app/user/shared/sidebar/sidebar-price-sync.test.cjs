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

  // Verify inputs and currency
  assert.ok(html.includes('inputMinStr'), 'Must bind inputMinStr to min input');
  assert.ok(html.includes('inputMaxStr'), 'Must bind inputMaxStr to max input');
  assert.ok(html.includes('{{ currency }}'), 'Must display currency');
});

test('sidebar.component.ts contract exposes synchronization handlers and outputs', () => {
  const tsPath = path.resolve(__dirname, 'sidebar.component.ts');
  const ts = fs.readFileSync(tsPath, 'utf8');

  assert.ok(ts.includes('onMinSliderChange'), 'Must implement onMinSliderChange');
  assert.ok(ts.includes('onMaxSliderChange'), 'Must implement onMaxSliderChange');
  assert.ok(ts.includes('onMinTextInput'), 'Must implement onMinTextInput');
  assert.ok(ts.includes('onMaxTextInput'), 'Must implement onMaxTextInput');
  assert.ok(ts.includes('onMinInputBlur'), 'Must implement onMinInputBlur');
  assert.ok(ts.includes('onMaxInputBlur'), 'Must implement onMaxInputBlur');
  assert.ok(ts.includes('changeMinPrice = new EventEmitter<number>()'), 'Must emit changeMinPrice');
  assert.ok(ts.includes('changeMaxPrice = new EventEmitter<number>()'), 'Must emit changeMaxPrice');
});
