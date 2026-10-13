const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../dashboard/admin.js'), 'utf8')
  .replace(/^import[^\n]+\n/gm, '');
const session = { user: { id: 'test-admin', email: 'admin@example.invalid' } };

async function createHarness(initialSession = null, search = '', settings = {}) {
  const { escapeHtml } = await import('../src/js/order-utils.mjs');
  const elements = new Map();
  const deferred = [];
  const calls = { channels: 0, removed: 0, updated: 0, recovery: null, captchaResets: 0, authAttempts: 0, alerts: [], stockUpdates: [], stockFilters: [] };
  const views = ['login', 'dashboard', 'produtos', 'novo', 'config', 'reset'];
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        hidden: views.some(view => id === `${view}-view`) && id !== 'login-view',
        value: '', disabled: false, textContent: '', innerHTML: '',
        listeners: {}, dataset: {},
        classList: {
          add: name => classes.add(name), remove: name => classes.delete(name),
          contains: name => classes.has(name),
          toggle(name, force) {
            const add = force ?? !classes.has(name);
            if (add) classes.add(name); else classes.delete(name);
          }
        },
        addEventListener(name, callback) {
          (this.listeners[name] ??= []).push(callback);
        },
        reportValidity() { return Boolean(this.value); },
        reset() {}, appendChild() {}
      });
    }
    return elements.get(id);
  }
  const document = {
    body: element('body'), getElementById: element, createElement: element,
    querySelector: selector => element(selector), querySelectorAll: () => [],
    head: { appendChild(script) { script.listeners.load?.forEach(callback => callback()); } }
  };
  let activeSession = initialSession;
  let authCallback;
  let signInError = null;
  function queryFor(table) {
    let values;
    return {
      select() { return this; }, in() { return this; }, order() { return this; }, gte() { return this; },
      eq(column, value) { if (values) calls.stockFilters.push([column, value]); return this; },
      is(column, value) { if (values) calls.stockFilters.push([column, value]); return this; },
      update(payload) { values = payload; calls.stockUpdates.push(payload); return this; },
      single() { return Promise.resolve({ data: { value: '' }, error: null }); },
      maybeSingle() {
        if (values) return Promise.resolve({ data: settings.stockConflict ? null : { id: 19, ...values }, error: settings.stockError || null });
        return Promise.resolve({ data: table === 'configuracoes' && settings.captchaSiteKey ? { value: settings.captchaSiteKey } : null, error: null });
      },
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); }
    };
  }
  const client = {
    from: queryFor,
    channel() {
      calls.channels++;
      return { on() { return this; }, subscribe() { return this; } };
    },
    removeChannel() { calls.removed++; },
    auth: {
      getSession: async () => ({ data: { session: activeSession }, error: null }),
      onAuthStateChange(callback) { authCallback = callback; },
      async signInWithPassword(credentials) {
        calls.authAttempts++;
        calls.credentials = credentials;
        if (signInError) return { error: signInError };
        activeSession = session;
        return { data: { session }, error: null };
      },
      async resetPasswordForEmail(email, options) {
        calls.recovery = { email, options };
        return { error: null };
      },
      async updateUser() { calls.updated++; return { error: null }; },
      async signOut() { activeSession = null; return { error: null }; }
    }
  };
  const context = vm.createContext({
    createClient: () => client, escapeHtml, document, URL, URLSearchParams,
    window: {
      turnstile: {
        render(container, options) {
          if (settings.renderError) throw new Error('Widget unavailable');
          calls.captchaOptions = options;
          return 'widget-id';
        },
        reset() { calls.captchaResets++; }
      }
    },
    location: { search, hash: '', pathname: '/dashboard/admin.html', href: `https://virtuosacg.store/dashboard/admin.html${search}` },
    history: { replaceState() {} }, setTimeout: callback => deferred.push(callback),
    console: { log() {}, error() {} }, alert(message) { calls.alerts.push(message); }
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return {
    element, calls,
    setSignInError(error) { signInError = error; },
    async event(eventName, nextSession) {
      activeSession = nextSession;
      authCallback(eventName, nextSession);
      deferred.splice(0).forEach(callback => callback());
      await new Promise(resolve => setImmediate(resolve));
    },
    async fire(id, eventName = 'click', event = {}) {
      await Promise.all(element(id).listeners[eventName].map(callback => callback({ preventDefault() {}, ...event })));
      await new Promise(resolve => setImmediate(resolve));
    }
  };
}

test('restores a session and opens the dashboard', async () => {
  const h = await createHarness(session);
  assert.equal(h.element('login-view').hidden, true);
  assert.equal(h.element('dashboard-view').hidden, false);
  assert.equal(h.element('body').classList.contains('is-logged-in'), true);
  assert.equal(h.calls.channels, 1);
});

test('invalid credentials and network failures release the login button', async () => {
  const h = await createHarness();
  h.setSignInError({ code: 'invalid_credentials' });
  await h.fire('login-form', 'submit');
  assert.equal(h.element('auth-feedback').textContent, 'E-mail ou senha incorretos.');
  assert.equal(h.element('btn-login').disabled, false);
  h.setSignInError({ message: 'Failed to fetch' });
  await h.fire('login-form', 'submit');
  assert.match(h.element('auth-feedback').textContent, /conexão/);
  assert.equal(h.element('btn-login').disabled, false);
});

test('successful login trims email and refresh keeps the current view and channel', async () => {
  const h = await createHarness();
  h.element('login-email').value = ' admin@example.invalid ';
  h.element('login-pass').value = 'test-password';
  await h.fire('login-form', 'submit');
  assert.equal(h.calls.credentials.email, 'admin@example.invalid');
  assert.equal(h.element('dashboard-view').hidden, false);
  assert.equal(h.element('login-pass').value, '');
  h.element('dashboard-view').hidden = true;
  h.element('produtos-view').hidden = false;
  await h.event('TOKEN_REFRESHED', session);
  assert.equal(h.element('produtos-view').hidden, false);
  assert.equal(h.calls.channels, 1);
  await h.event('SIGNED_OUT', null);
  assert.equal(h.element('login-view').hidden, false);
  assert.equal(h.calls.removed, 1);
});

test('recovery uses the current origin and shows the password form', async () => {
  const h = await createHarness();
  h.element('login-email').value = ' admin@example.invalid ';
  await h.fire('forgot-password');
  assert.equal(h.calls.recovery.email, 'admin@example.invalid');
  assert.equal(h.calls.recovery.options.redirectTo, 'https://virtuosacg.store/dashboard/admin.html?recovery=1');
  await h.event('PASSWORD_RECOVERY', session);
  assert.equal(h.element('reset-view').hidden, false);
  assert.equal(h.element('login-view').hidden, true);
  assert.equal(h.element('body').classList.contains('is-logged-out'), true);
});

test('password mismatch prevents update and matching passwords open the dashboard', async () => {
  const h = await createHarness(session, '?recovery=1');
  h.element('new-password').value = 'new-password';
  h.element('confirm-password').value = 'another-password';
  await h.fire('reset-form', 'submit');
  assert.equal(h.calls.updated, 0);
  h.element('confirm-password').value = 'new-password';
  await h.fire('reset-form', 'submit');
  assert.equal(h.calls.updated, 1);
  assert.equal(h.element('dashboard-view').hidden, false);
  assert.equal(h.element('reset-view').hidden, true);
});

test('logout and an expired recovery link return to login', async () => {
  const h = await createHarness(session);
  await h.fire('logout');
  assert.equal(h.element('login-view').hidden, false);
  assert.equal(h.calls.removed, 1);
  const expired = await createHarness(null, '?recovery=1');
  assert.equal(expired.element('reset-view').hidden, true);
  assert.match(expired.element('auth-feedback').textContent, /expirou/);
});

test('Turnstile blocks authentication without a token and forwards a verified token', async () => {
  const h = await createHarness(null, '', { captchaSiteKey: 'test-public-widget' });
  await h.fire('login-form', 'submit');
  assert.equal(h.calls.authAttempts, 0);
  assert.match(h.element('auth-feedback').textContent, /verificação de segurança/);
  h.calls.captchaOptions.callback('test-captcha-token');
  await h.fire('login-form', 'submit');
  assert.equal(h.calls.credentials.options.captchaToken, 'test-captcha-token');
  assert.equal(h.element('dashboard-view').hidden, false);
  assert.ok(h.calls.captchaResets > 0);
});

test('expired CAPTCHA prevents password recovery and a new token is passed to Supabase', async () => {
  const h = await createHarness(null, '', { captchaSiteKey: 'test-public-widget' });
  h.element('login-email').value = 'admin@example.invalid';
  h.calls.captchaOptions.callback('expired-token');
  h.calls.captchaOptions['expired-callback']();
  await h.fire('forgot-password');
  assert.equal(h.calls.recovery, null);
  h.calls.captchaOptions.callback('new-test-token');
  await h.fire('forgot-password');
  assert.equal(h.calls.recovery.options.captchaToken, 'new-test-token');
});

test('CAPTCHA refresh preserves login errors and password recovery confirmation', async () => {
  const h = await createHarness(null, '', { captchaSiteKey: 'test-public-widget' });
  h.setSignInError({ code: 'invalid_credentials' });
  h.calls.captchaOptions.callback('first-token');
  await h.fire('login-form', 'submit');
  h.calls.captchaOptions.callback('refreshed-token');
  assert.equal(h.element('auth-feedback').textContent, 'E-mail ou senha incorretos.');
  h.element('login-email').value = 'admin@example.invalid';
  await h.fire('forgot-password');
  h.calls.captchaOptions.callback('next-token');
  assert.match(h.element('auth-feedback').textContent, /Confira seu e-mail/);
});

test('unavailable widget prevents an unprotected login attempt', async () => {
  const h = await createHarness(null, '', { captchaSiteKey: 'test-public-widget', renderError: true });
  await h.fire('login-form', 'submit');
  assert.equal(h.calls.authAttempts, 0);
  assert.match(h.element('auth-feedback').textContent, /não carregou/);
  assert.equal(h.element('btn-login').disabled, false);
});

async function saveStock(h, value, originalStock = '5') {
  const input = h.element('stock-input');
  input.value = value;
  input.dataset.originalStock = originalStock;
  input.reportValidity = () => true;
  const feedback = h.element('stock-feedback');
  const row = { querySelector: selector => selector === '.stock-quantity' ? input : feedback };
  const button = { dataset: { id: '19', action: 'stock' }, closest: () => row };
  await h.fire('produtos-list', 'click', { target: { closest: () => button } });
  return { input, feedback, button };
}

test('stock saves validate integers and guard against concurrent stock changes', async () => {
  const h = await createHarness(session);
  await saveStock(h, '-1');
  await saveStock(h, '1.5');
  assert.equal(h.calls.stockUpdates.length, 0);
  const { input, feedback, button } = await saveStock(h, '3');
  assert.equal(h.calls.stockUpdates[0].stock, 3);
  assert.deepEqual(h.calls.stockFilters, [['id', '19'], ['stock', 5]]);
  assert.equal(input.dataset.originalStock, '3');
  assert.equal(feedback.textContent, 'Estoque atualizado.');
  assert.equal(button.disabled, false);
});

test('concurrent stock conflict reports a retry and does not pretend success', async () => {
  const h = await createHarness(session, '', { stockConflict: true });
  const { input, feedback } = await saveStock(h, '3');
  assert.equal(input.dataset.originalStock, '5');
  assert.equal(feedback.textContent, '');
  assert.match(h.calls.alerts[0], /outra sessão/);
});
