const statusBadge = document.getElementById('status-badge');
const noteForm = document.getElementById('note-form');
const formError = document.getElementById('form-error');
const notesList = document.getElementById('notes-list');
const notesEmpty = document.getElementById('notes-empty');
const submitBtn = document.getElementById('submit-btn');
const loginLink = document.getElementById('login-link');
const userArea = document.getElementById('user-area');
const userGreeting = document.getElementById('user-greeting');
const authNotice = document.getElementById('auth-notice');
const nameInput = document.getElementById('name');
const spriteKey = document.getElementById('sprite-key');
const spriteScribe = document.getElementById('sprite-scribe');

function setSpriteKeyState(connected) {
  if (!spriteKey) return;
  spriteKey.classList.remove('sprite--linked', 'sprite--sealed');
  spriteKey.classList.add(connected ? 'sprite--linked' : 'sprite--sealed');
}

function playScribeDispatch() {
  if (!spriteScribe) return;
  spriteScribe.classList.remove('sprite--dispatch');
  void spriteScribe.offsetWidth;
  spriteScribe.classList.add('sprite--dispatch');
  window.setTimeout(() => spriteScribe.classList.remove('sprite--dispatch'), 700);
}

function stampBadge() {
  statusBadge.classList.remove('status-badge--stamp');
  void statusBadge.offsetWidth;
  statusBadge.classList.add('status-badge--stamp');
}

function setBadge(connected, message) {
  statusBadge.textContent = connected ? 'Vault linked' : 'Vault sealed';
  statusBadge.className = `status-badge ${
    connected ? 'status-badge--connected' : 'status-badge--disconnected'
  }`;
  statusBadge.title = message || '';
  stampBadge();
  setSpriteKeyState(connected);
}

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
  formError.classList.remove('form-error--shake');
  void formError.offsetWidth;
  formError.classList.add('form-error--shake');
}

function setAuthState(user) {
  if (user?.authenticated) {
    loginLink.hidden = true;
    userArea.hidden = false;
    userGreeting.textContent = `Hail, ${user.name}`;
    authNotice.hidden = true;
    noteForm.hidden = false;
    if (!nameInput.value.trim()) {
      nameInput.value = user.name;
    }
    return;
  }

  loginLink.hidden = false;
  userArea.hidden = true;
  authNotice.hidden = false;
  noteForm.hidden = true;
}

async function loadAuth() {
  try {
    const response = await fetch('/api/me');
    const data = await response.json();
    setAuthState(data);
  } catch {
    setAuthState({ authenticated: false });
  }
}

async function loadStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    setBadge(data.connected, data.message);
  } catch {
    setBadge(false, 'Could not reach the server.');
  }
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function renderNotes(notes, animate = false) {
  notesList.innerHTML = '';

  if (!notes.length) {
    notesEmpty.hidden = false;
    return;
  }

  notesEmpty.hidden = true;

  notes.forEach((note, index) => {
    const item = document.createElement('li');
    item.className = 'note-item';
    if (animate) {
      item.classList.add('note-item--enter');
      item.style.animationDelay = `${index * 0.08}s`;
    }
    item.innerHTML = `
      <div class="note-meta">
        <span class="note-name">${escapeHtml(note.name)}</span>
        <time datetime="${note.created_at}">${formatDate(note.created_at)}</time>
      </div>
      <p class="note-message">${escapeHtml(note.message)}</p>
    `;
    notesList.appendChild(item);
  });
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadNotes(animate = false) {
  try {
    const response = await fetch('/api/notes');
    const data = await response.json();
    renderNotes(data.notes || [], animate);
  } catch {
    renderNotes([]);
  }
}

noteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.hidden = true;

  const name = nameInput.value;
  const message = document.getElementById('message').value;

  submitBtn.disabled = true;
  submitBtn.classList.add('button--working');
  playScribeDispatch();
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = 'Dispatching';

  try {
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message }),
    });

    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      showFormError(data.error || 'The missive could not be affixed.');
      return;
    }

    noteForm.reset();
    await loadNotes(true);
    await loadAuth();
  } catch {
    showFormError('The royal courier could not reach the server.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('button--working');
    submitBtn.textContent = originalLabel;
  }
});

loadAuth();
loadStatus();
loadNotes();
