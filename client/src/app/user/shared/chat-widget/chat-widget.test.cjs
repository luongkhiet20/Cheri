const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS', moduleResolution: 'Node', experimentalDecorators: true, target: 'ES2022',
});
require('ts-node/register/transpile-only');
require('@angular/compiler');

function createWidget() {
  assert.ok(fs.existsSync(path.join(__dirname, 'chat-widget.component.ts')), 'Chat widget component must exist');
  const { ChatWidgetComponent } = require('./chat-widget.component.ts');
  return new ChatWidgetComponent();
}

test('chat starts collapsed with a greeting and no persisted user messages', () => {
  const widget = createWidget();
  assert.equal(widget.isOpen(), false);
  assert.equal(widget.draft, '');
  assert.equal(widget.messages().length, 1);
  assert.equal(widget.messages()[0].sender, 'store');
  widget.draft = 'Xin chào';
  widget.sendMessage();
  assert.equal(createWidget().messages().length, 1);
});

test('open focuses the composer and close restores the launcher while preserving local state', () => {
  const widget = createWidget();
  let composerFocus = 0;
  let launcherFocus = 0;
  widget.launcher = { nativeElement: { focus: () => launcherFocus++ } };
  widget.openChat();
  widget.composer = { nativeElement: { focus: () => composerFocus++ } };
  widget.draft = 'Giữ nội dung đang nhập';
  assert.equal(widget.isOpen(), true);
  assert.equal(composerFocus, 1);
  widget.closeChat();
  assert.equal(widget.isOpen(), false);
  assert.equal(launcherFocus, 1);
  widget.openChat();
  assert.equal(widget.draft, 'Giữ nội dung đang nhập');
});

test('send adds only the trimmed local Vietnamese message and clears the composer', () => {
  const widget = createWidget();
  const previous = widget.messages();
  widget.draft = '  Tôi muốn hỏi về kích cỡ.  ';
  widget.sendMessage();
  assert.equal(previous.length, 1);
  assert.equal(widget.messages().length, 2);
  assert.equal(widget.messages()[1].sender, 'user');
  assert.equal(widget.messages()[1].text, 'Tôi muốn hỏi về kích cỡ.');
  assert.equal(widget.draft, '');
  assert.notEqual(widget.messages()[0].id, widget.messages()[1].id);
});

test('blank and overlong messages are rejected without altering the greeting', () => {
  const widget = createWidget();
  for (const draft of [' \n\t ', 'a'.repeat(1001)]) {
    widget.draft = draft;
    widget.sendMessage();
    assert.equal(widget.messages().length, 1);
    assert.equal(widget.draft, draft);
  }
  widget.draft = 'a'.repeat(1000);
  widget.sendMessage();
  assert.equal(widget.messages().length, 2);
});

test('Enter sends but Shift+Enter and IME composition keep the draft', () => {
  const widget = createWidget();
  let prevented = 0;
  widget.draft = 'Áo dài';
  const event = { shiftKey: false, isComposing: false, preventDefault: () => prevented++ };
  widget.onEnter({ ...event, shiftKey: true });
  widget.onEnter({ ...event, isComposing: true });
  assert.equal(widget.messages().length, 1);
  assert.equal(prevented, 0);
  widget.onEnter(event);
  assert.equal(widget.messages()[1].text, 'Áo dài');
  assert.equal(prevented, 1);
});

test('Escape collapses an open chat and leaves unrelated keys untouched when closed', () => {
  const widget = createWidget();
  let handled = 0;
  const event = { preventDefault: () => handled++, stopPropagation: () => handled++ };
  widget.onEscape(event);
  assert.equal(handled, 0);
  widget.openChat();
  widget.onEscape(event);
  assert.equal(widget.isOpen(), false);
  assert.equal(handled, 2);
});

test('new messages scroll to the latest bubble after the view updates', () => {
  const widget = createWidget();
  const list = { scrollHeight: 480, scrollTop: 0 };
  widget.messageList = { nativeElement: list };
  widget.draft = 'Một tin nhắn mới';
  widget.sendMessage();
  widget.ngAfterViewChecked();
  assert.equal(list.scrollTop, 480);
  list.scrollTop = 100;
  widget.ngAfterViewChecked();
  assert.equal(list.scrollTop, 100, 'later checks must not override manual scrolling');
});

test('clicking outside an open chat collapses it without stealing focus, while clicking inside leaves it open', () => {
  const widget = createWidget();
  const insideElement = { id: 'chat-inner' };
  const outsideElement = { id: 'outside-body' };
  const hostElement = {
    contains: (node) => node === insideElement,
  };
  widget.elementRef = { nativeElement: hostElement };

  // When chat is closed, clicking outside does nothing
  widget.onDocumentClick({ target: outsideElement });
  assert.equal(widget.isOpen(), false);

  // Open chat
  widget.openChat();
  assert.equal(widget.isOpen(), true);

  // Click inside chat: remains open
  widget.onDocumentClick({ target: insideElement });
  assert.equal(widget.isOpen(), true);

  // Click inside with composedPath: remains open
  widget.onDocumentClick({
    target: insideElement,
    composedPath: () => [insideElement, hostElement],
  });
  assert.equal(widget.isOpen(), true);

  // Click outside chat: closes, without stealing focus to launcher
  let launcherFocused = 0;
  widget.launcher = { nativeElement: { focus: () => launcherFocused++ } };
  widget.onDocumentClick({
    target: outsideElement,
    composedPath: () => [outsideElement, { id: 'body' }],
  });
  assert.equal(widget.isOpen(), false);
  assert.equal(launcherFocused, 0, 'Clicking outside must not steal focus to launcher');
});

async function renderShell(isDashboard, openMessage) {
  const { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild, provideZonelessChangeDetection, ɵresolveComponentResources } = require('@angular/core');
  const { CommonModule } = require('@angular/common');
  const { bootstrapApplication } = require('@angular/platform-browser');
  const { renderApplication, provideServerRendering } = require('@angular/platform-server');
  const { ChatWidgetComponent } = require('./chat-widget.component.ts');
  await ɵresolveComponentResources((url) => Promise.resolve(fs.readFileSync(path.join(__dirname, url), 'utf8')));
  class ShellPreview {
    isDashboard = isDashboard;
    onScrolling() {}
    onActivate() {}
    onDeactivate() {}
  }
  ViewChild(ChatWidgetComponent)(ShellPreview.prototype, 'widget');
  Component({
    selector: 'chat-shell-test', standalone: true, imports: [CommonModule, ChatWidgetComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    template: fs.readFileSync(path.resolve(__dirname, '../../../app.component.html'), 'utf8'),
  })(ShellPreview);
  return renderApplication(async () => {
    const app = await bootstrapApplication(ShellPreview, { providers: [provideZonelessChangeDetection(), provideServerRendering()] });
    if (openMessage !== undefined) {
      app.components[0].instance.widget.openChat();
      app.components[0].instance.widget.draft = openMessage;
      app.components[0].instance.widget.sendMessage();
      app.tick();
    }
    return app;
  }, { document: '<html><body><chat-shell-test></chat-shell-test></body></html>', url: 'http://localhost/' });
}

test('the real storefront shell renders the chat launcher', async () => {
  assert.match(await renderShell(false), /aria-label="Mở trò chuyện cùng Chéri"/);
});

test('the real admin shell renders no chat widget or controls', async () => {
  assert.doesNotMatch(await renderShell(true), /<app-chat-widget|cheri-chat-panel|Mở trò chuyện cùng Chéri/);
});

test('open chat renders accessible controls and escapes HTML-looking messages during SSR', async () => {
  const html = await renderShell(false, '<img src=x onerror=alert(1)>');
  assert.match(html, /role="dialog"/);
  assert.match(html, /role="log"/);
  assert.match(html, /aria-label="Gửi lời nhắn"/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror/);
});
