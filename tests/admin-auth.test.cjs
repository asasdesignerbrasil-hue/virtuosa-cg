const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../dashboard/admin.js'), 'utf8')
  .replace(/^import[^\n]+\n/, '');
const session = { user: { id: 'test-admin', email: 'admin@example.invalid' } };

async function createHarness(initialSession = null, search = '') {
  const elements = new Map();
  const deferred = [];
  const calls = { channels: 0, removed: 0, updated: 0, recovery: null };
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
    querySelector: selector => element(selector), querySelectorAll: () => []
  };
  let activeSession = initialSession;
  let authCallback;
  let signInError = null;
  const query = {
    select() { return this; }, eq() { return this; }, in() { return this; },
    order() { return this; }, gte() { return this; },
    single() { return Promise.resolve({ data: { value: '' }, error: null }); },
    then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); }
  };
  const client = {
    from: () => query,
    channel() {
      calls.channels++;
      return { on() { return this; }, subscribe() { return this; } };
    },
    removeChannel() { calls.removed++; },
    auth: {
      getSession: async () => ({ data: { session: activeSession }, error: null }),
      onAuthStateChange(callback) { authCallback = callback; },
      async signInWithPassword(credentials) {
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
    createClient: () => client, document, URL, URLSearchParams,
    location: { search, hash: '', pathname: '/dashboard/admin.html', href: `https://virtuosacg.store/dashboard/admin.html${search}` },
    history: { replaceState() {} }, setTimeout: callback => deferred.push(callback),
    console: { log() {}, error() {} }, alert(message) { throw new Error(message); }
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
    async fire(id, eventName = 'click') {
      await Promise.all(element(id).listeners[eventName].map(callback => callback({ preventDefault() {} })));
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
