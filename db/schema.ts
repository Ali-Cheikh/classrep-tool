import { pgTable, text, timestamp, check, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const votes = pgTable('votes', {
  email: text().primaryKey(),
  name: text().notNull(),
  vote: text().notNull(),
  comment: text().notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [check('valid_vote', sql`${table.vote} in ('Approve', 'Disapprove')`)]);

// A single row holds the poll-wide privacy setting. Missing row means private.
export const pollSettings = pgTable('poll_settings', {
  id: text().primaryKey().default('main'),
  commentsPublic: boolean('comments_public').notNull().default(false),
}, (table) => [check('single_poll_settings', sql`${table.id} = 'main'`)]);
