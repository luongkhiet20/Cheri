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
