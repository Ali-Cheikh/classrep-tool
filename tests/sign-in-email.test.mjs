import test from 'node:test';
import assert from 'node:assert/strict';
import { sendSignInEmail } from '../src/sign-in-email.js';

for (const [label, status, body, contentType] of [
  ['empty JSON response', 200, '', 'application/json'],
  ['JSON object', 200, '{}', 'application/json'],
  ['no content', 204, null, null],
  ['text response', 200, '', 'text/plain'],
]) {
  test(`email delivery accepts a successful ${label}`, async t => {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, '/.netlify/identity/recover');
      assert.equal(options.method, 'POST');
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(options.body), { email: 'owner@example.test' });
      return new Response(body, { status, headers: contentType ? { 'Content-Type': contentType } : {} });
    });
    await sendSignInEmail('owner@example.test');
  });
}

for (const [status, body] of [[429, ''], [503, '<html>Unavailable</html>'], [422, '{}']]) {
  test(`email delivery preserves HTTP ${status} regardless of error body format`, async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response(body, { status }));
    await assert.rejects(sendSignInEmail('owner@example.test'), error => error.status === status);
  });
}

test('network failures remain failures and do not claim delivery succeeded', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network error'); });
  await assert.rejects(sendSignInEmail('owner@example.test'), TypeError);
});
