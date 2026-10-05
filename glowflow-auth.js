const SUPABASE_URL = 'https://efwbwdwraueczkxfmdpo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PtAS6g8u7oU4gEXrm4WeOg_PUhqWiTN';
const SUPABASE_JS_URL = 'https://esm.sh/@supabase/supabase-js@2';

const accountForm = document.querySelector('#accountForm');
const accountEmail = document.querySelector('#accountEmail');
const accountPassword = document.querySelector('#accountPassword');
const signInButton = document.querySelector('#signInButton');
const signUpButton = document.querySelector('#signUpButton');
const signOutButton = document.querySelector('#signOutButton');
const accountStatus = document.querySelector('#accountStatus');
const accountBadge = document.querySelector('#accountBadge');
const accountDescription = document.querySelector('#accountDescription');
const journalEntry = document.querySelector('#journalEntry');
const journalStatus = document.querySelector('#journalStatus');
const journalIntro = document.querySelector('#journalIntro');
const journalPrivate = document.querySelector('.journal-private');
const volumeSlider = document.querySelector('#volumeSlider');

let supabase;
let currentUser = null;
let saveTimeout;
let settingsSaveTimeout;
let isLoadingJournal = false;
let isLoadingSettings = false;

function setAccountStatus(message) {
  accountStatus.textContent = message;
}

function showAccountError(action, error) {
  console.error(`${action} failed.`, error);
  setAccountStatus(`${action} failed: ${error.message || 'Please try again.'}`);
}

function setAccountBusy(isBusy) {
  signInButton.disabled = isBusy;
  signUpButton.disabled = isBusy;
  signOutButton.disabled = isBusy;
}

function setJournalContent(note, status) {
  isLoadingJournal = true;
  journalEntry.value = note;
  journalEntry.dispatchEvent(new Event('input', { bubbles: true }));
  isLoadingJournal = false;
  journalStatus.textContent = status;
}

function getSettingsStorageKey(userId) {
  return userId ? `glowflowSettings:${userId}` : 'glowflowSettings';
}

function restoreRainVolume(settings) {
  isLoadingSettings = true;
  const storedVolume = settings?.rainVolume ?? (() => {
    try {
      return localStorage.getItem(getSettingsStorageKey(currentUser?.id));
    } catch (error) {
      console.error('Unable to restore the rain volume setting from this device.', error);
      return null;
    }
  })();
  if (storedVolume !== null && storedVolume !== undefined) {
    const volume = Number(storedVolume);
    if (Number.isInteger(volume) && volume >= 0 && volume <= 100) {
      volumeSlider.value = String(volume);
    }
  }
  volumeSlider.dispatchEvent(new Event('input', { bubbles: true }));
  isLoadingSettings = false;
}

function setSignedOutView() {
  currentUser = null;
  journalEntry.dataset.storageKey = 'glowflowJournal';
  volumeSlider.dataset.storageKey = 'glowflowSettings';
  accountEmail.disabled = false;
  accountPassword.disabled = false;
  signInButton.hidden = false;
  signUpButton.hidden = false;
  signOutButton.hidden = true;
  signInButton.textContent = 'Log in';
  accountPassword.autocomplete = 'current-password';
  accountBadge.textContent = 'Private by default';
  accountDescription.textContent = 'Create an account to keep your journal private and available when you sign in on another device.';
  journalIntro.textContent = 'No perfect words needed. Write a thought, a feeling, or something kind you want to remember. Your note stays in this browser on this device; it is not sent anywhere.';
  journalPrivate.textContent = 'Saved on this device';
  try {
    setJournalContent(localStorage.getItem('glowflowJournal') || '', 'Your note stays on this device.');
    restoreRainVolume();
  } catch (error) {
    console.error('Unable to restore the private journal note from this device.', error);
    setJournalContent('', 'This browser could not access saved notes.');
    restoreRainVolume();
  }
}

async function saveJournal() {
  if (!currentUser) return;
  const { error } = await supabase
    .from('glowflow_journal')
    .upsert({
      user_id: currentUser.id,
      note: journalEntry.value,
      settings: { rainVolume: Number(volumeSlider.value) },
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) throw error;
  journalStatus.textContent = 'Saved privately to your account.';
  setAccountStatus('Your journal is synced to your account.');
}

async function saveSettings() {
  if (!currentUser) return;
  const { error } = await supabase
    .from('glowflow_journal')
    .upsert({
      user_id: currentUser.id,
      note: journalEntry.value,
      settings: { rainVolume: Number(volumeSlider.value) },
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) throw error;
  setAccountStatus('Your journal and settings are synced to your account.');
}

function scheduleJournalSave() {
  window.clearTimeout(saveTimeout);
  if (!currentUser || isLoadingJournal) return;

  journalStatus.textContent = 'Saving to your private account…';
  saveTimeout = window.setTimeout(() => {
    saveJournal().catch((error) => {
      console.error('Unable to sync the GlowFlow journal.', error);
      journalStatus.textContent = 'Your note is saved on this device, but account sync failed.';
      setAccountStatus(`Journal sync failed: ${error.message || 'Please check your connection and try again.'}`);
    });
  }, 700);
}

function scheduleSettingsSave() {
  if (!currentUser || isLoadingSettings) return;
  window.clearTimeout(settingsSaveTimeout);
  settingsSaveTimeout = window.setTimeout(() => {
    saveSettings().catch((error) => {
      console.error('Unable to sync GlowFlow settings.', error);
      setAccountStatus(`Settings sync failed: ${error.message || 'Please check your connection and try again.'}`);
    });
  }, 700);
}

async function loadJournalForUser(user) {
  currentUser = user;
  journalEntry.dataset.storageKey = `glowflowJournal:${user.id}`;
  volumeSlider.dataset.storageKey = getSettingsStorageKey(user.id);
  accountEmail.disabled = true;
  accountPassword.disabled = true;
  signInButton.hidden = true;
  signUpButton.hidden = true;
  signOutButton.hidden = false;
  accountBadge.textContent = 'Private account sync';
  accountDescription.textContent = `Signed in as ${user.email}. Your journal is private to your account and syncs across your devices.`;
  journalIntro.textContent = 'Write freely. Your journal is saved to your private account and synced across your devices.';
  journalPrivate.textContent = 'Private account sync';
  setAccountStatus('Loading your private journal…');

  const { data, error } = await supabase
    .from('glowflow_journal')
    .select('note, settings')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  let note = data?.note;
  let shouldSync = false;
  if (note === undefined) {
    try {
      note = localStorage.getItem(journalEntry.dataset.storageKey) || '';
      shouldSync = note.length > 0;
    } catch (storageError) {
      console.error('Unable to restore this account journal from local storage.', storageError);
      note = '';
    }
  }

  setJournalContent(note, 'Your journal is saved privately to your account.');
  restoreRainVolume(data?.settings);
  if (shouldSync) {
    await saveJournal();
  } else {
    setAccountStatus('Your journal and settings are synced to your account.');
  }
}

async function handleSession(user) {
  if (user?.id === currentUser?.id) return;
  window.clearTimeout(saveTimeout);
  window.clearTimeout(settingsSaveTimeout);

  if (!user) {
    setSignedOutView();
    return;
  }

  try {
    await loadJournalForUser(user);
  } catch (error) {
    console.error('Unable to load the private GlowFlow journal.', error);
    setAccountStatus(`Journal could not be loaded: ${error.message || 'Please check your connection.'}`);
    journalStatus.textContent = 'Your account is signed in, but the journal could not be loaded.';
  }
}

async function signUp() {
  const email = accountEmail.value.trim();
  const password = accountPassword.value;
  if (!accountForm.reportValidity()) return;

  setAccountBusy(true);
  setAccountStatus('Creating your account…');
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` }
    });
    if (error) throw error;

    if (data.session) {
      setAccountStatus('Your account is ready. Your journal will sync privately.');
    } else {
      setAccountStatus('Check your email for a confirmation link to finish creating your account.');
    }
  } catch (error) {
    showAccountError('Account creation', error);
  } finally {
    setAccountBusy(false);
  }
}

async function signIn(event) {
  event.preventDefault();
  if (!accountForm.reportValidity()) return;

  setAccountBusy(true);
  setAccountStatus('Signing in…');
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: accountEmail.value.trim(),
      password: accountPassword.value
    });
    if (error) throw error;
    accountPassword.value = '';
  } catch (error) {
    showAccountError('Log in', error);
  } finally {
    setAccountBusy(false);
  }
}

async function signOut() {
  setAccountBusy(true);
  setAccountStatus('Saving your latest note before logging out…');
  try {
    window.clearTimeout(saveTimeout);
    window.clearTimeout(settingsSaveTimeout);
    await saveJournal();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    accountPassword.value = '';
    setAccountStatus('You have logged out. Your private device note is still here.');
  } catch (error) {
    showAccountError('Log out', error);
  } finally {
    setAccountBusy(false);
  }
}

async function initializeAccount() {
  try {
    const { createClient } = await import(SUPABASE_JS_URL);
    supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        handleSession(session?.user || null).catch((error) => {
          showAccountError('Account session', error);
        });
      });
    });
  } catch (error) {
    console.error('Unable to load account support for GlowFlow.', error);
    setAccountStatus('Account features are unavailable right now. Your journal still saves on this device.');
  }
}

accountForm.addEventListener('submit', signIn);
signUpButton.addEventListener('click', signUp);
signOutButton.addEventListener('click', signOut);
journalEntry.addEventListener('input', scheduleJournalSave);
volumeSlider.addEventListener('input', scheduleSettingsSave);

initializeAccount();
