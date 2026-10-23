import type { Config } from '@netlify/functions';
import { desc, sql } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { votes } from '../../db/schema.js';
import { commentsArePublic } from '../../lib/settings.js';

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
  }

  let submission: { email: string; name: string; vote: string; comment: string } | undefined;
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); }
    catch { return json({ error: 'Please send a valid vote.' }, 400); }
    if (!body || typeof body !== 'object') return json({ error: 'Please send a valid vote.' }, 400);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (!name || name.length > 150 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !['Approve', 'Disapprove'].includes(body.vote) || comment.length > 300 ||
        (body.comment != null && typeof body.comment !== 'string')) {
      return json({ error: 'Choose a vote and enter a valid name, email, and comment (up to 300 characters).' }, 400);
    }
    submission = { email, name, vote: body.vote, comment };
  }

  try {
    const db = getDb();
    if (submission) {
      await db.insert(votes).values(submission).onConflictDoUpdate({
        target: votes.email,
        set: { name: submission.name, vote: submission.vote, comment: submission.comment, updatedAt: new Date() },
      });
      return json({ ok: true });
    }
    const commentsPublic = await commentsArePublic(db);
    const [totals] = await db.select({
      approve: sql<number>`count(*) filter (where ${votes.vote} = 'Approve')::int`,
      disapprove: sql<number>`count(*) filter (where ${votes.vote} = 'Disapprove')::int`,
    }).from(votes);
    // Private comments are not selected or included in the public response.
    const comments = commentsPublic
      ? await db.select({ vote: votes.vote, comment: votes.comment }).from(votes).orderBy(desc(votes.updatedAt))
      : [];
    return json({
      approve: totals.approve,
      disapprove: totals.disapprove,
      commentsPublic,
      comments: comments.filter(row => row.comment.length > 0),
    });
  } catch {
    return json({ error: 'Voting is temporarily unavailable. Please try again shortly.' }, 503);
  }
};

export const config: Config = { path: '/api/vote' };
