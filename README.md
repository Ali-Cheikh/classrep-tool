# Midterm schedule vote

A class poll with persistent vote storage in Netlify Database. The static page is in `public/`; `netlify/functions/vote.mts` serves `/api/vote`.

Votes are keyed by trimmed, lowercase email. Resubmitting updates the existing vote. Email ownership is not verified. Names and emails are never returned in public results. Comments are saved for the admin and hidden publicly by default. When the admin enables public comments, all non-empty comments appear without names or emails.

## Private admin access

Visit `/admin.html`, enter **isb@alicheikh.tn**, and select **Email me a sign-in link**. Open the newest Netlify email to sign in. Netlify uses its recovery email for this flow, so the email says **Reset password**; the page completes recovery automatically without asking you to choose or remember a password. Expired or already-used links can be replaced by requesting another email. Email delivery requests accept empty successful responses and preserve rate-limit status codes. If a network error leaves delivery uncertain, the page explains that an email already received can still be used. Numeric codes are not supported by this Identity service.

The owner must already have an Identity account, or accept an invitation sent from the project's Identity dashboard. Existing confirmation and invitation links continue to work. Recovery and invitation callbacks set a cryptographically random password automatically; the password is never displayed or saved by the application.

The server allows only the authenticated, email-confirmed owner address `isb@alicheikh.tn` to download data or change visibility. Other accounts are denied even if they have an admin role. User-editable metadata cannot grant access. Keep Identity email confirmation enabled. Public voting remains available without a login.

The CSV contains name, email, vote, comment, and last update time in UTC, including comments hidden from the public. CSV fields are quoted, and spreadsheet formula prefixes are neutralized. The export and settings endpoints return non-cacheable responses and enforce admin permission on every request. Changes to visibility also require a same-origin request.

## Development

Install dependencies with `npm install`. Run `netlify dev --port 8889` for local development. The deploy command bundles the installed Identity SDK into the admin page's local JavaScript asset; no external script host is used.

Run `npm test` for handler tests using mocked database and auth dependencies, and `npm run typecheck` for server TypeScript checks. These tests cover authorization, comment privacy, saved visibility, CSV escaping, input validation, and errors. Live Identity authentication and database migration application are verified after deployment.

Netlify automatically supplies the database connection and applies migrations during deployment. No custom database credential is required. Schema definitions live in `db/schema.ts`; generate future migrations with `npx drizzle-kit generate --name descriptive_change`. Existing applied migrations must remain unchanged.
