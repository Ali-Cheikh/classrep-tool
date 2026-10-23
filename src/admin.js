import { logout, getUser, handleAuthCallback, acceptInvite, updateUser } from '@netlify/identity';
import { sendSignInEmail } from './sign-in-email.js';

const $ = id => document.getElementById(id);
let savedVisibility = false;
let saving = false;
const message = text => { $('status').textContent = text; };

function hidePanels() {
  for (const id of ['login-panel', 'admin-panel', 'signout']) $(id).hidden = true;
}

async function adminRequest(path, options = {}) {
  // The SDK refreshes the browser session and supplies the same-origin auth cookie.
  const user = await getUser();
  if (!user) {
    hidePanels();
    $('login-panel').hidden = false;
    throw new Error('Your session expired. Sign in again.');
  }
  const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      $('admin-panel').hidden = true;
      $('signout').hidden = false;
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'The request failed. Please try again.');
  }
  return response;
}

async function showSession() {
  hidePanels();
  const user = await getUser();
  if (!user) {
    $('login-panel').hidden = false;
    message('Sign in to access the private controls.');
    return;
  }
  $('signout').hidden = false;
  const response = await adminRequest('/api/admin/settings');
  const settings = await response.json();
  savedVisibility = settings.commentsPublic;
  $('comments-public').checked = savedVisibility;
  $('admin-panel').hidden = false;
  message(savedVisibility ? 'Public comments are on.' : 'Public comments are off. Submissions remain available in your CSV.');
}

$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const email = $('email').value.trim().toLowerCase();
  if (email !== 'isb@alicheikh.tn') {
    message('Use the owner email isb@alicheikh.tn to access admin controls.');
    return;
  }
  const button = $('send-link');
  if (button.disabled) return;
  button.disabled = true;
  message('Sending your sign-in email…');
  try {
    await sendSignInEmail(email);
    button.textContent = 'Send another link';
    message('Check your inbox and spam folder. Click “Reset password” in the Netlify email to sign in; you do not need to choose a password. Use the newest email if you request another link.');
  } catch (error) {
    message(error.status === 429
      ? 'Please wait a minute before requesting another email.'
      : error.status === 400 || error.status === 422
        ? 'Check your email address and try again.'
        : 'Could not confirm the email request. If a Netlify reset-password email arrived, open its link to sign in. Otherwise, wait a minute and try again.');
  } finally { button.disabled = false; }
});

$('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  saving = true;
  const desiredVisibility = $('comments-public').checked;
  const button = event.submitter;
  button.disabled = true;
  $('comments-public').disabled = true;
  message('Saving visibility…');
  try {
    const response = await adminRequest('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentsPublic: desiredVisibility }),
    });
    const settings = await response.json();
    savedVisibility = settings.commentsPublic;
    message(savedVisibility ? 'Saved. All comments are now public.' : 'Saved. Comments are hidden from the public.');
  } catch (error) {
    message(error.message + ' Reload to confirm the current setting.');
  } finally {
    $('comments-public').checked = savedVisibility;
    button.disabled = false;
    $('comments-public').disabled = false;
    saving = false;
  }
});

$('download').addEventListener('click', async () => {
  $('download').disabled = true;
  message('Preparing CSV…');
  try {
    const response = await adminRequest('/api/admin/export');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'midterm-votes.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('CSV downloaded. Keep it private: it contains personal information.');
  } catch (error) { message(error.message); }
  finally { $('download').disabled = false; }
});

$('signout').addEventListener('click', async () => {
  $('signout').disabled = true;
  try {
    await logout();
    location.replace('/admin.html');
  } catch { message('Could not sign out. Please try again.'); $('signout').disabled = false; }
});

async function init() {
  try {
    const callback = await handleAuthCallback();
    if (callback) history.replaceState(null, '', '/admin.html');
    // Identity recovery links authenticate the mailbox owner. Complete recovery
    // with an unremembered random password so no password form is needed.
    if (callback?.type === 'invite') {
      await acceptInvite(callback.token, crypto.randomUUID() + crypto.randomUUID());
    } else if (callback?.type === 'recovery') {
      await updateUser({ password: crypto.randomUUID() + crypto.randomUUID() });
    }
    await showSession();
  } catch (error) {
    history.replaceState(null, '', '/admin.html');
    hidePanels();
    message('Could not finish signing in. The email link may have expired or already been used. Request a new link below.');
    $('login-panel').hidden = false;
  }
}
init();
