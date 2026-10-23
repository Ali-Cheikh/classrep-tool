import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = (await readFile(new URL('../src/admin.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
const html = await readFile(new URL('../public/admin.html', import.meta.url), 'utf8');

async function page({ callback = null, callbackError = false, sendError = null, authorized = true } = {}) {
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, {
    hidden: true, disabled: false, value: '', textContent: '', checked: false,
    listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; },
  }]));
  const calls = [];
  const context = vm.createContext({
    document: { getElementById: id => { assert.ok(elements.has(id), `Missing element ${id}`); return elements.get(id); } },
    crypto: webcrypto,
    history: { replaceState() {} },
    handleAuthCallback: async () => { if (callbackError) throw new Error('expired'); return callback; },
    getUser: async () => callback ? { email: 'isb@alicheikh.tn' } : null,
    updateUser: async ({ password }) => { assert.ok(password.length >= 32); calls.push('recovery completed'); },
    acceptInvite: async (token, password) => { assert.equal(token, 'invitation'); assert.ok(password.length >= 32); calls.push('invite accepted'); },
    sendSignInEmail: async email => { calls.push(email); if (sendError) throw sendError; },
    fetch: async () => ({ ok: authorized, status: authorized ? 200 : 403, json: async () => authorized ? { commentsPublic: false } : { error: 'Owner only' } }),
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { elements, calls, submit: () => elements.get('login-form').listeners.submit({ preventDefault() {} }) };
}

test('email-only page sends normalized owner email and allows resending', async () => {
  const { elements, calls, submit } = await page();
  assert.equal(elements.get('login-panel').hidden, false);
  elements.get('email').value = ' ISB@ALICHEIKH.TN ';
  await submit();
  assert.deepEqual(calls, ['isb@alicheikh.tn']);
  assert.match(elements.get('status').textContent, /Check your inbox/);
  assert.equal(elements.get('send-link').disabled, false);
  assert.equal(elements.has('password'), false);
});

test('other emails cannot request owner login through the form', async () => {
  const { elements, calls, submit } = await page();
  elements.get('email').value = 'other@example.test';
  await submit();
  assert.deepEqual(calls, []);
  assert.match(elements.get('status').textContent, /owner email/);
});

for (const type of ['recovery', 'confirmation', 'invite']) {
  test(`${type} email opens admin controls without a password prompt`, async () => {
    const { elements, calls } = await page({ callback: { type, token: 'invitation' } });
    assert.equal(elements.get('admin-panel').hidden, false);
    assert.equal(elements.get('login-panel').hidden, true);
    if (type === 'recovery') assert.deepEqual(calls, ['recovery completed']);
    if (type === 'invite') assert.deepEqual(calls, ['invite accepted']);
  });
}

test('expired links show an actionable retry and hide private controls', async () => {
  const { elements } = await page({ callbackError: true });
  assert.equal(elements.get('admin-panel').hidden, true);
  assert.equal(elements.get('login-panel').hidden, false);
  assert.match(elements.get('status').textContent, /Request a new link/);
});

test('rate limits let the owner retry instead of leaving the form disabled', async () => {
  const { elements, submit } = await page({ sendError: { status: 429 } });
  elements.get('email').value = 'isb@alicheikh.tn';
  await submit();
  assert.match(elements.get('status').textContent, /wait a minute/);
  assert.equal(elements.get('send-link').disabled, false);
});

test('a denied server response never reveals admin controls', async () => {
  const { elements } = await page({ callback: { type: 'confirmation' }, authorized: false });
  assert.equal(elements.get('admin-panel').hidden, true);
});

test('uncertain delivery tells the owner to use an email that already arrived', async () => {
  const { elements, submit } = await page({ sendError: new TypeError('Network error') });
  elements.get('email').value = 'isb@alicheikh.tn';
  await submit();
  assert.match(elements.get('status').textContent, /If a Netlify reset-password email arrived, open its link/);
  assert.equal(elements.get('send-link').disabled, false);
});
