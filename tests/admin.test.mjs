import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import admin from '../netlify/functions/admin.mts';
import vote from '../netlify/functions/vote.mts';
import { csvCell, votesCsv } from '../lib/csv.js';
import { state, reset } from './fixtures/state.mjs';

beforeEach(reset);
const request = (path, method = 'GET', body, origin = 'https://poll.example') => new Request('https://poll.example' + path, {
  method, headers: { Origin: origin, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const fixture = { name: 'Student', email: 'student@example.test', vote: 'Approve', comment: 'Private comment', updatedAt: new Date('2026-10-23T00:00:00Z') };
const signIn = () => { state.user = { roles: ['admin'] }; };

test('anonymous and non-admin accounts cannot read settings, export, or change privacy', async () => {
  for (const user of [null, { roles: [] }, { roles: [], userMetadata: { roles: ['admin'] } }]) {
    state.user = user;
    for (const [path, method, body] of [
      ['/api/admin/settings', 'GET'], ['/api/admin/export', 'GET'],
      ['/api/admin/settings', 'PUT', { commentsPublic: true }],
    ]) {
      const result = await admin(request(path, method, body));
      assert.equal(result.status, user ? 403 : 401);
      assert.equal(result.headers.get('cache-control'), 'private, no-store');
    }
  }
  assert.equal(state.queries.length, 0);
  assert.equal(state.commentsPublic, undefined);
});

test('comments default to private even with existing submissions', async () => {
  state.rows = [fixture];
  const response = await vote(request('/api/vote'));
  assert.deepEqual(await response.json(), { approve: 1, disapprove: 0, commentsPublic: false, comments: [] });
  assert.equal(state.queries.some(query => query.fields?.comment), false);
});

test('admin can persist visibility on and off, and public results honor it', async () => {
  signIn();
  state.rows = [fixture, { ...fixture, email: 'another@example.test', comment: '', vote: 'Disapprove' }];
  assert.deepEqual(await (await admin(request('/api/admin/settings'))).json(), { commentsPublic: false });
  for (const setting of [true, false]) {
    const response = await admin(request('/api/admin/settings', 'PUT', { commentsPublic: setting }));
    assert.equal(response.status, 200);
    assert.equal(state.commentsPublic, setting);
    const publicResult = await (await vote(request('/api/vote'))).json();
    assert.equal(publicResult.commentsPublic, setting);
    assert.deepEqual(publicResult.comments, setting ? [{ vote: 'Approve', comment: 'Private comment' }] : []);
    assert.equal(JSON.stringify(publicResult).includes(fixture.email), false);
    assert.equal(JSON.stringify(publicResult).includes(fixture.name), false);
  }
});

test('privacy updates reject cross-origin requests, missing Origin, malformed JSON and non-booleans', async () => {
  signIn();
  assert.equal((await admin(request('/api/admin/settings', 'PUT', { commentsPublic: true }, 'https://other.example'))).status, 403);
  const noOrigin = request('/api/admin/settings', 'PUT', { commentsPublic: true });
  noOrigin.headers.delete('Origin');
  assert.equal((await admin(noOrigin)).status, 403);
  for (const body of [{ commentsPublic: 'false' }, {}, null]) {
    assert.equal((await admin(request('/api/admin/settings', 'PUT', body))).status, 400);
  }
  const badJson = new Request('https://poll.example/api/admin/settings', { method: 'PUT', headers: { Origin: 'https://poll.example' }, body: '{' });
  assert.equal((await admin(badJson)).status, 400);
  assert.equal(state.commentsPublic, undefined);
});

test('CSV contains private comments for admin even when public comments are off', async () => {
  signIn();
  state.commentsPublic = false;
  state.rows = [fixture];
  const response = await admin(request('/api/admin/export'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/csv/);
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const csv = await response.text();
  assert.match(csv, /student@example.test/);
  assert.match(csv, /Private comment/);
  assert.match(csv, /2026-10-23T00:00:00.000Z/);
});

test('CSV safely quotes commas, quotes, newlines and spreadsheet formulas; empty export has headers', () => {
  assert.equal(csvCell('one,"two"\nthree'), '"one,""two""\nthree"');
  for (const value of ['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '  =1']) {
    assert.equal(csvCell(value).startsWith('"\''), true);
  }
  assert.equal(votesCsv([]).split('\r\n').length, 2);
  assert.match(votesCsv([]), /Name.*Email.*Vote.*Comment/);
});

test('database failures never expose comments or personal data', async () => {
  state.rows = [fixture];
  state.fail = true;
  const response = await vote(request('/api/vote'));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('Private comment'), false);
  signIn();
  assert.equal((await admin(request('/api/admin/export'))).status, 503);
  assert.equal((await admin(request('/api/admin/settings', 'PUT', {commentsPublic:true}))).status, 503);
});

test('voting still validates and updates an existing normalized email', async () => {
  const submission = { name: 'Student', email: ' Student@Example.test ', vote: 'Approve', comment: 'A comment' };
  assert.equal((await vote(request('/api/vote', 'POST', submission))).status, 200);
  assert.equal((await vote(request('/api/vote', 'POST', { ...submission, vote: 'Disapprove' }))).status, 200);
  assert.equal(state.rows.length, 1);
  assert.equal(state.rows[0].vote, 'Disapprove');
  assert.equal(state.rows[0].email, 'student@example.test');
  assert.equal((await vote(request('/api/vote', 'POST', {...submission, comment:'x'.repeat(301)}))).status, 400);
});
