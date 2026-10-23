# Midterm schedule vote

A class poll with persistent vote storage in Netlify Database. The static page is in `public/`; `netlify/functions/vote.mts` serves `/api/vote`.

Votes are keyed by trimmed, lowercase email. Resubmitting updates the existing vote. Email ownership is not verified. Names and emails are never returned in public results. Comments are saved for the admin and hidden publicly by default. When the admin enables public comments, all non-empty comments appear without names or emails.

## Admin access (one-time setup)

After deployment, open your Netlify project dashboard:

1. In **Project configuration → Identity**, set registration to **Invite only**.
2. Open **Identity → Invite users** and invite only your own email address.
3. Accept the invitation and set your password. The invitation returns to the site and opens the admin setup form.
4. Open your user in the Identity list, add the **admin** role, and save. Sign out and sign in again after assigning the role.
5. Visit `/admin.html`. Download a CSV of all submissions or use **Show comments on the public poll** and **Save visibility**.

Only accounts given the server-controlled `admin` role can download data or change visibility. To keep this exclusive to you, do not give that role to other accounts. There is no public signup form, automatic first-user promotion, or shared admin password. Public voting remains available without a login.

The CSV contains name, email, vote, comment, and last update time in UTC, including comments hidden from the public. CSV fields are quoted, and spreadsheet formula prefixes are neutralized. The export and settings endpoints return non-cacheable responses and enforce admin permission on every request. Changes to visibility also require a same-origin request.

## Development

Install dependencies with `npm install`. Run `netlify dev --port 8889` for local development. The deploy command bundles the installed Identity SDK into the admin page's local JavaScript asset; no external script host is used.

Run `npm test` for handler tests using mocked database and auth dependencies, and `npm run typecheck` for server TypeScript checks. These tests cover authorization, comment privacy, saved visibility, CSV escaping, input validation, and errors. Live Identity authentication and database migration application are verified after deployment.

Netlify automatically supplies the database connection and applies migrations during deployment. No custom database credential is required. Schema definitions live in `db/schema.ts`; generate future migrations with `npx drizzle-kit generate --name descriptive_change`. Existing applied migrations must remain unchanged.
