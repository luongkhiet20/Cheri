const { build } = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');

const root = process.cwd();
const widgetDir = path.join(root, 'client/src/app/user/shared/chat-widget');
const artifactDir = path.join(root, '.superpowers/sdd/2026-10-20-cheri-chatbot');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  const bundle = await build({
    stdin: { contents: `import '@angular/compiler'; import {provideZonelessChangeDetection} from '@angular/core'; import {bootstrapApplication} from '@angular/platform-browser'; import {ChatWidgetComponent} from './client/src/app/user/shared/chat-widget/chat-widget.component'; import {ChatService} from './client/src/app/services/chat.service'; import {of} from 'rxjs'; bootstrapApplication(ChatWidgetComponent,{providers:[provideZonelessChangeDetection(),{provide:ChatService,useValue:{send:()=>of({status:'general',reply:'Chéri xin chào, mình có thể hỗ trợ bạn về thời trang và sản phẩm.',products:[],policies:[]})}}]});`, resolveDir: root, loader: 'ts' },
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022',
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } },
    plugins: [{ name: 'inline-widget-resources', setup(plugin) {
      plugin.onLoad({ filter: /chat-widget\.component\.ts$/ }, () => ({
        contents: fs.readFileSync(path.join(widgetDir, 'chat-widget.component.ts'), 'utf8')
          .replace("templateUrl: './chat-widget.component.html'", `template: ${JSON.stringify(fs.readFileSync(path.join(widgetDir, 'chat-widget.component.html'), 'utf8'))}`)
          .replace("styleUrls: ['./chat-widget.component.css']", `styles: [${JSON.stringify(fs.readFileSync(path.join(widgetDir, 'chat-widget.component.css'), 'utf8'))}]`),
        loader: 'ts', resolveDir: widgetDir,
      }));
    } }],
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/widget.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f5eee7;font-family:Arial,sans-serif}' + fs.readFileSync(path.join(root, 'node_modules/@angular/cdk/overlay-prebuilt.css'), 'utf8') + '</style></head><body><app-chat-widget></app-chat-widget><script src="/widget.js"></script></body></html>'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  fs.mkdirSync(artifactDir, { recursive: true });
  const profile = fs.mkdtempSync(path.join(artifactDir, 'browser-profile-'));
  const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--disable-gpu', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let stderr = '';
      const timer = setTimeout(() => reject(new Error('Chrome startup timed out')), 20000);
      browser.once('error', reject);
      browser.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
        const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    const tabs = await (await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();
    socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const waiting = new Map();
    const requests = [];
    const errors = [];
    socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Network.requestWillBeSent') requests.push(data.params.request.url);
      if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
      if (data.id && waiting.has(data.id)) {
        const pending = waiting.get(data.id); waiting.delete(data.id); clearTimeout(pending.timer);
        data.error ? pending.reject(new Error(JSON.stringify(data.error))) : pending.resolve(data.result);
      }
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
      waiting.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const until = async (expression) => {
      for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await pause(50); }
      throw new Error(`Condition not reached: ${expression}`);
    };
    await command('Network.enable'); await command('Runtime.enable'); await command('Page.enable');
    const viewport = (width, height) => command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await viewport(1366, 900);
    await command('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await until("!!document.querySelector('.chat-launcher')");
    await evaluate("document.querySelector('.chat-launcher').click()");
    await until("document.activeElement.id === 'cheri-chat-input'");
    const send = async (text) => {
      await evaluate(`(()=>{const input=document.querySelector('textarea');input.value=${JSON.stringify(text)};input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form').requestSubmit();})()`);
      await pause(75);
    };
    await send('  Tôi muốn hỏi về kích cỡ.  ');
    await until("document.querySelectorAll('.from-user').length === 1");
    await send('<img src=x onerror=alert(1)>');
    assert.equal(await evaluate("document.querySelectorAll('.chat-message img').length"), 0);
    assert.equal(await evaluate("document.querySelectorAll('.from-user').length"), 2);
    await evaluate("document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await until("!document.querySelector('[role=dialog]') && document.activeElement.classList.contains('chat-launcher')");
    await evaluate("document.querySelector('.chat-launcher').click()");
    await until("document.querySelectorAll('.from-user').length === 2");
    const bounds = () => evaluate("(()=>{const r=document.querySelector('.chat-panel').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};})()");
    for (const [width, height] of [[1366, 900], [390, 844], [640, 360]]) {
      await viewport(width, height); await pause(100);
      const r = await bounds();
      assert.ok(r.left >= 0 && r.right <= r.width && r.top >= 0 && r.bottom <= r.height, JSON.stringify(r));
    }
    const regressions = [];
    const shortLogHeight = await evaluate("document.querySelector('.chat-messages').clientHeight");
    console.log('Short viewport message area:', shortLogHeight);
    await send('Lời nhắn trên màn hình thấp');
    const lastMessageReadable = await evaluate("(()=>{const p=document.querySelector('.chat-message:last-child p');const range=document.createRange();range.selectNodeContents(p);const log=document.querySelector('.chat-messages').getBoundingClientRect();return Array.from(range.getClientRects()).some(r=>r.top>=log.top && r.bottom<=log.bottom);})()");
    if (!lastMessageReadable) regressions.push('latest message text is clipped in a short viewport');
    for (const zIndex of [990, 1000]) {
      const modalAboveChat = await evaluate(`(()=>{const overlay=document.createElement('div');overlay.className='cdk-overlay-container';overlay.style.zIndex='${zIndex}';const backdrop=document.createElement('div');backdrop.className='cdk-overlay-backdrop cdk-overlay-backdrop-showing';overlay.append(backdrop);document.body.append(overlay);const r=document.querySelector('.chat-panel').getBoundingClientRect();const top=document.elementFromPoint(r.right-20,r.top+20);const pass=!!top.closest('.cdk-overlay-backdrop');overlay.remove();return pass;})()`);
      if (!modalAboveChat) regressions.push(`chat covers modal at z-index ${zIndex}`);
    }
    await command('Emulation.setEmulatedMedia', { media: 'print' });
    if (!await evaluate("getComputedStyle(document.querySelector('app-chat-widget')).display === 'none'")) regressions.push('chat remains visible when printing');
    await command('Emulation.setEmulatedMedia', { media: 'screen' });
    await evaluate("document.querySelector('.chat-launcher').click()");
    await until("!document.querySelector('[role=dialog]')");
    await command('Emulation.setEmulatedMedia', { media: 'print' });
    if (!await evaluate("getComputedStyle(document.querySelector('app-chat-widget')).display === 'none'")) regressions.push('collapsed launcher remains visible when printing');
    await command('Emulation.setEmulatedMedia', { media: 'screen' });
    await evaluate("document.querySelector('.chat-launcher').click()");
    await until("!!document.querySelector('[role=dialog]')");
    assert.deepEqual(regressions, [], 'chat must respect modal stacking and printing');
    await viewport(390, 844); await pause(100);
    const mobile = await command('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'chat-mobile.png'), Buffer.from(mobile.data, 'base64'));
    await viewport(1366, 900); await pause(100);
    const desktop = await command('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'chat-desktop.png'), Buffer.from(desktop.data, 'base64'));
    assert.equal(await evaluate('localStorage.length'), 0);
    assert.equal(await evaluate('sessionStorage.length'), 0);
    assert.ok(requests.every((url) => url.startsWith(`http://127.0.0.1:${server.address().port}/`)), JSON.stringify(requests));
    assert.deepEqual(errors, []);
    await command('Page.reload');
    await until("!!document.querySelector('.chat-launcher') && !document.querySelector('[role=dialog]')");
    await evaluate("document.querySelector('.chat-launcher').click()");
    await until("document.querySelectorAll('.chat-message').length === 1");
    console.log('Browser checks passed: desktop, mobile, short viewport, modal stacking, print suppression, focus, Escape, local messages, escaped HTML, no storage/API, reload reset.');
    await command('Browser.close').catch(() => {});
  } finally {
    socket?.close(); browser.kill(); await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
