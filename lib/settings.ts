import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { pollSettings } from '../db/schema.js';

export async function commentsArePublic(db = getDb()) {
  const [settings] = await db.select({ commentsPublic: pollSettings.commentsPublic })
    .from(pollSettings).where(eq(pollSettings.id, 'main'));
  return settings?.commentsPublic === true;
}
