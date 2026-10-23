import type { Config } from '@netlify/functions';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { desc } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { pollSettings, votes } from '../../db/schema.js';
import { commentsArePublic } from '../../lib/settings.js';
import { votesCsv } from '../../lib/csv.js';

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
}

export default async (req: Request) => {
  const user = await getUser();
  if (!user) return json({ error: 'Sign in to your admin account.' }, 401);
  // Only server-controlled app metadata grants access. User metadata is never trusted.
  if (!user.roles?.includes('admin')) return json({ error: 'This account does not have admin access.' }, 403);

  const path = new URL(req.url).pathname;
  const exportCsv = path === '/api/admin/export';
  if ((exportCsv && req.method !== 'GET') || (!exportCsv && !['GET', 'PUT'].includes(req.method))) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: exportCsv ? 'GET' : 'GET, PUT', 'Cache-Control': 'no-store' } });
  }
  if (req.method === 'PUT') {
    try { verifyRequestOrigin(req); }
    catch { return json({ error: 'Request origin is not allowed.' }, 403); }
    let body;
    try { body = await req.json(); }
    catch { return json({ error: 'Send a valid comments setting.' }, 400); }
    if (typeof body?.commentsPublic !== 'boolean') return json({ error: 'Comments must be on or off.' }, 400);
    try {
      const db = getDb();
      await db.insert(pollSettings).values({ id: 'main', commentsPublic: body.commentsPublic })
        .onConflictDoUpdate({ target: pollSettings.id, set: { commentsPublic: body.commentsPublic } });
      return json({ commentsPublic: body.commentsPublic });
    } catch { return json({ error: 'Could not save the setting. Please try again.' }, 503); }
  }
  try {
    const db = getDb();
    if (exportCsv) {
      const rows = await db.select().from(votes).orderBy(desc(votes.updatedAt));
      return new Response(votesCsv(rows), { headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="midterm-votes.csv"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        Vary: 'Cookie, Authorization',
      } });
    }
    return json({ commentsPublic: await commentsArePublic(db) });
  } catch { return json({ error: 'Admin data is temporarily unavailable.' }, 503); }
};

export const config: Config = { path: ['/api/admin/settings', '/api/admin/export'] };
