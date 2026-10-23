CREATE TABLE "poll_settings" (
	"id" text PRIMARY KEY DEFAULT 'main',
	"comments_public" boolean DEFAULT false NOT NULL,
	CONSTRAINT "single_poll_settings" CHECK ("id" = 'main')
);
