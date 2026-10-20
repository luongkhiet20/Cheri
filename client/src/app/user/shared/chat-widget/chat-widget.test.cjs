const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS', moduleResolution: 'Node', experimentalDecorators: true, target: 'ES2022',
});
require('ts-node/register/transpile-only');
require('@angular/compiler');
const { of, throwError, Subject } = require('rxjs');
const { ChatService } = require('../../../services/chat.service.ts');

function createWidget(chatService = { send: () => new Subject() }) {
  assert.ok(fs.existsSync(path.join(__dirname, 'chat-widget.component.ts')), 'Chat widget component must exist');
  const { ChatWidgetComponent } = require('./chat-widget.component.ts');
  return new ChatWidgetComponent(chatService);
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

async function renderShell(isDashboard, openMessage) {
  const { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild, provideZonelessChangeDetection, ɵresolveComponentResources } = require('@angular/core');
  const { CommonModule } = require('@angular/common');
  const { bootstrapApplication } = require('@angular/platform-browser');
  const { renderApplication, provideServerRendering } = require('@angular/platform-server');
  const { ChatWidgetComponent } = require('./chat-widget.component.ts');
  const { ChatService } = require('../../../services/chat.service.ts');
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
    const app = await bootstrapApplication(ShellPreview, {
      providers: [
        provideZonelessChangeDetection(), provideServerRendering(),
        { provide: ChatService, useValue: { send: () => of({ reply: 'Chéri sẵn sàng hỗ trợ.', products: [] }) } },
      ],
    });
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
  assert.match(await renderShell(false), /aria-label="Mở tư vấn cùng Chéri"/);
});

test('the real admin shell renders no chat widget or controls', async () => {
  assert.doesNotMatch(await renderShell(true), /<app-chat-widget|cheri-chat-panel|Mở tư vấn cùng Chéri/);
});

test('open chat renders accessible controls and escapes HTML-looking messages during SSR', async () => {
  const html = await renderShell(false, '<img src=x onerror=alert(1)>');
  assert.match(html, /role="dialog"/);
  assert.match(html, /role="log"/);
  assert.match(html, /Tư vấn cùng Chéri/);
  assert.match(html, /Chatbot Chéri chỉ hỗ trợ tham khảo về thời trang, sản phẩm và dịch vụ/);
  assert.match(html, /✨ Chào bạn!/);
  assert.match(html, />Tư vấn</);
  assert.match(html, /aria-label="Gửi lời nhắn"/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror/);
});

test('a successful reply reaches the widget and sends no greeting in history', () => {
  let sent;
  const widget = createWidget({ send: (request) => { sent = request; return of({ reply: 'Chéri chào bạn.', products: [] }); } });
  widget.draft = 'Xin chào';
  widget.sendMessage();
  assert.equal(sent.message, 'Xin chào');
  assert.deepEqual(sent.history, []);
  assert.equal(widget.messages().length, 3);
  assert.equal(widget.messages()[2].sender, 'store');
  assert.equal(widget.messages()[2].text, 'Chéri chào bạn.');
  assert.equal(widget.isSending(), false);
});

test('a failed request can be retried without duplicating the user message', () => {
  const sent = [];
  const widget = createWidget({ send: (request) => {
    sent.push(request);
    return sent.length === 1
      ? throwError(() => new Error('provider details must not appear in the widget'))
      : of({ reply: 'Bạn có thể chọn màu đen.', products: [] });
  } });
  widget.draft = '  Gợi ý giúp tôi  ';
  widget.sendMessage();
  assert.match(widget.errorMessage(), /thử lại/i);
  assert.equal(widget.isSending(), false);
  const messagesBeforeRetry = widget.messages().length;
  widget.retryMessage();
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(widget.messages().length, messagesBeforeRetry + 1);
  assert.equal(widget.messages().filter((message) => message.sender === 'user').length, 1);
  assert.doesNotMatch(widget.errorMessage(), /provider details/i);
  assert.equal(widget.messages().at(-1).text, 'Bạn có thể chọn màu đen.');
});

test('sending is single-flight, preserves a new draft, and closing leaves the request alive', () => {
  let observer;
  let cancelled = 0;
  const widget = createWidget({ send: () => ({ subscribe(value) {
    observer = value;
    return { closed: false, unsubscribe() { cancelled++; } };
  } }) });
  widget.draft = 'Đầu tiên';
  widget.sendMessage();
  widget.draft = 'Tin mới';
  widget.sendMessage();
  assert.equal(widget.messages().filter((message) => message.sender === 'user').length, 1);
  widget.closeChat();
  assert.equal(cancelled, 0);
  observer.next({ reply: 'Đã nhận.', products: [] });
  observer.complete();
  assert.equal(widget.draft, 'Tin mới');
  assert.equal(widget.isSending(), false);
});

test('response rendering rejects external product paths and non-HTTP images', () => {
  const widget = createWidget({ send: () => of({ reply: '<b>plain text</b>', products: [
    { id: 'safe', title: 'Váy', path: '/vi/product/vay-den', imageUrl: 'javascript:alert(1)', price: 200000 },
    { id: 'unsafe', title: 'Lừa đảo', path: '//evil.example', imageUrl: 'https://evil.example/image.jpg', price: -2 },
  ] }) });
  widget.draft = 'Gợi ý';
  widget.sendMessage();
  assert.equal(widget.messages().at(-1).text, '<b>plain text</b>');
  assert.deepEqual(widget.messages().at(-1).products, [
    { id: 'safe', title: 'Váy', path: '/vi/product/vay-den', price: 200000 },
  ]);
});

test('destroying the widget cancels an active HTTP subscription', () => {
  let unsubscribed = 0;
  const widget = createWidget({ send: () => ({ subscribe() {
    return { closed: false, unsubscribe() { unsubscribed++; } };
  } }) });
  widget.draft = 'Gửi';
  widget.sendMessage();
  widget.ngOnDestroy();
  assert.equal(unsubscribed, 1);
});
