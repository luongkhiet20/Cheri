const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'Node',
  experimentalDecorators: true,
  target: 'ES2022',
});
require('ts-node/register/transpile-only');
require('@angular/compiler');

function createComponent() {
  const tsPath = path.join(__dirname, 'scroll-to-top.component.ts');
  assert.ok(fs.existsSync(tsPath), 'ScrollToTopComponent file must exist');
  const { ScrollToTopComponent } = require('./scroll-to-top.component.ts');
  return new ScrollToTopComponent();
}

test('Component files exist with proper HTML, CSS, and TS structure', () => {
  assert.ok(fs.existsSync(path.join(__dirname, 'scroll-to-top.component.ts')), 'TS file exists');
  assert.ok(fs.existsSync(path.join(__dirname, 'scroll-to-top.component.html')), 'HTML file exists');
  assert.ok(fs.existsSync(path.join(__dirname, 'scroll-to-top.component.css')), 'CSS file exists');

  const html = fs.readFileSync(path.join(__dirname, 'scroll-to-top.component.html'), 'utf8');
  assert.ok(html.includes('aria-label="Cuộn lên đầu trang"'), 'HTML has correct aria-label');
  assert.ok(html.includes('<svg'), 'HTML includes inline SVG icon');
  assert.ok(html.includes('scroll-to-top-btn'), 'HTML uses scroll-to-top-btn class');

  const css = fs.readFileSync(path.join(__dirname, 'scroll-to-top.component.css'), 'utf8');
  assert.ok(css.includes('#74070e') || css.includes('#74070E'), 'CSS contains brand color #74070E');
  assert.ok(css.includes('34px'), 'CSS specifies button dimensions in 32-36px range');
  assert.ok(css.includes('50%'), 'CSS specifies perfect circle (50%)');
  assert.ok(css.includes('#4a4a4a') || css.includes('#921a22'), 'CSS specifies background color');
  assert.ok(css.includes('@media (max-width: 767.98px)'), 'CSS hides component on mobile <= 767px');
  assert.ok(css.includes('display: none !important'), 'CSS hides completely on mobile');
});

test('Component starts hidden by default (isVisible = false)', () => {
  const comp = createComponent();
  assert.equal(comp.isVisible, false);
});

test('checkScrollPosition keeps button hidden on mobile viewport (<= 767px)', () => {
  const comp = createComponent();

  // Mock global window
  const originalWindow = global.window;
  const originalDoc = global.document;

  try {
    global.window = {
      innerWidth: 375,
      pageYOffset: 1000,
      scrollTo: () => {},
    };
    global.document = {
      documentElement: { clientWidth: 375, scrollTop: 1000 },
      body: { scrollTop: 1000 },
      querySelector: () => null,
    };

    comp.checkScrollPosition();
    assert.equal(comp.isVisible, false, 'Button should not be visible on mobile regardless of scroll');
  } finally {
    global.window = originalWindow;
    global.document = originalDoc;
  }
});

test('checkScrollPosition shows button when scrolled > 250px on desktop and hides when <= 250px', () => {
  const comp = createComponent();

  const originalWindow = global.window;
  const originalDoc = global.document;

  try {
    global.window = {
      innerWidth: 1200,
      pageYOffset: 100,
      scrollTo: () => {},
    };
    global.document = {
      documentElement: { clientWidth: 1200, scrollTop: 100 },
      body: { scrollTop: 100 },
      querySelector: () => null,
    };

    comp.checkScrollPosition();
    assert.equal(comp.isVisible, false, 'Button should stay hidden when scrolled <= 250px');

    // Cuộn xuống 500px (> 250px)
    global.window.pageYOffset = 500;
    global.document.documentElement.scrollTop = 500;
    comp.checkScrollPosition();
    assert.equal(comp.isVisible, true, 'Button should appear when scrolled > 250px');

    // Cuộn ngược lại đầu trang (0px)
    global.window.pageYOffset = 0;
    global.document.documentElement.scrollTop = 0;
    comp.checkScrollPosition();
    assert.equal(comp.isVisible, false, 'Button should hide when scrolled back to top');
  } finally {
    global.window = originalWindow;
    global.document = originalDoc;
  }
});

test('scrollToTop invokes window.scrollTo with smooth behavior and scrolls .main-scroll-wrap', () => {
  const comp = createComponent();

  let windowScrolledTo = null;
  let wrapScrolledTo = null;

  const originalWindow = global.window;
  const originalDoc = global.document;

  try {
    global.window = {
      scrollTo: (opts) => { windowScrolledTo = opts; }
    };
    global.document = {
      querySelector: (selector) => {
        if (selector === '.main-scroll-wrap') {
          return {
            scrollTo: (opts) => { wrapScrolledTo = opts; }
          };
        }
        return null;
      },
      documentElement: { scrollTo: () => {} },
      body: { scrollTo: () => {} }
    };

    comp.scrollToTop();
    assert.deepEqual(windowScrolledTo, { top: 0, behavior: 'smooth' }, 'window.scrollTo should be smooth to top');
    assert.deepEqual(wrapScrolledTo, { top: 0, behavior: 'smooth' }, '.main-scroll-wrap should be smooth to top');
  } finally {
    global.window = originalWindow;
    global.document = originalDoc;
  }
});
