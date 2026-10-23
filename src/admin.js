import { login, logout, getUser, handleAuthCallback, acceptInvite, updateUser, requestPasswordRecovery } from '@netlify/identity';

const $ = id => document.getElementById(id);
let inviteToken;
let savedVisibility = false;
let saving = false;
const message = text => { $('status').textContent = text; };

function hidePanels() {
  for (const id of ['login-panel', 'password-panel', 'admin-panel', 'signout']) $(id).hidden = true;
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
  const button = event.submitter;
  button.disabled = true;
  message('Signing in…');
  try {
    await login($('email').value.trim(), $('password').value);
    $('password').value = '';
    await showSession();
  } catch { message('Unable to open admin controls. Check your credentials and that your account has the admin role.'); }
  finally { button.disabled = false; }
});

$('forgot').addEventListener('click', async () => {
  if (!$('email').reportValidity()) return;
  $('forgot').disabled = true;
  try {
    await requestPasswordRecovery($('email').value.trim());
    message('If this account exists, check your email for a password reset link.');
  } catch { message('Could not request a password reset. Please try again.'); }
  finally { $('forgot').disabled = false; }
});

$('password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const password = $('new-password').value;
  if (password !== $('confirm-password').value) return message('The passwords do not match.');
  const button = event.submitter;
  button.disabled = true;
  try {
    if (inviteToken) {
      await acceptInvite(inviteToken, password);
      inviteToken = undefined;
    } else {
      await updateUser({ password });
    }
    $('password-form').reset();
    await showSession();
  } catch { message('Could not finish account setup. The link may have expired, or your admin role may still need to be assigned in Netlify.'); }
  finally { button.disabled = false; }
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
    if (callback?.type === 'invite' || callback?.type === 'recovery') {
      hidePanels();
      inviteToken = callback.type === 'invite' ? callback.token : undefined;
      $('password-panel').hidden = false;
      $('password-heading').textContent = inviteToken ? 'Accept your admin invitation' : 'Reset your password';
      message('Choose a password to continue.');
      return;
    }
    await showSession();
  } catch (error) {
    history.replaceState(null, '', '/admin.html');
    message(error.message || 'Could not load admin controls. Please reload and try again.');
    $('login-panel').hidden = false;
  }
}
init();
