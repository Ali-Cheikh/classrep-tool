// Request delivery directly because the Identity SDK attempts to parse JSON even
// when the recovery endpoint returns an empty successful response. Identity still
// verifies the emailed token and manages the authenticated session through its SDK.
export async function sendSignInEmail(email) {
  const response = await fetch('/.netlify/identity/recover', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (response.ok) return;

  // The response body is not needed, and may be empty or an HTML error page.
  const error = new Error('Email delivery request failed.');
  error.status = response.status;
  throw error;
}
