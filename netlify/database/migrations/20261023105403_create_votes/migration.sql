CREATE TABLE "votes" (
	"email" text PRIMARY KEY,
	"name" text NOT NULL,
	"vote" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_vote" CHECK ("vote" in ('Approve', 'Disapprove'))
);
