const app = document.querySelector('#app');

const API_BASE = (() => {
  const requested = new URLSearchParams(location.search).get('api');
  if (requested) return requested.replace(/\/$/, '');
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local && location.port && location.port !== '8787') return 'http://127.0.0.1:8787';
  return '';
})();

const state = {
  config: null,
  user: null,
  worlds: [],
  styles: [],
  premades: [],
  characterOptions: null,
  campaigns: [],
  archivedCampaigns: [],
  showArchived: false,
  game: null,
  gameTab: 'story',
  journalTab: 'quests',
  sending: false,
  loading: true,
  online: navigator.onLine,
  installPrompt: null,
  audio: null,
  audioUrl: null,
  create: null,
  toasts: []
};

class ApiError extends Error {
  constructor(message, status, payload = {}) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const initials = (name = '') => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase() || '•';

const modeName = (id) => ({ adventure: 'Adventure', story: 'Story', book: 'Book' })[id] || id;
const formatDate = (value) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
};

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
    headers
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const message = payload?.error || payload?.detail || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload || {});
  }
  return payload;
}

async function apiBlob(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(apiUrl(path), { credentials: 'include', ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.error || 'Audio unavailable', response.status, payload);
  }
  return response.blob();
}

function toast(message, type = '') {
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  state.toasts.push({ id, message, type });
  renderToasts();
  setTimeout(() => {
    state.toasts = state.toasts.filter((item) => item.id !== id);
    renderToasts();
  }, 4200);
}

function renderToasts() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  stack.innerHTML = state.toasts.map((item) => `<div class="toast ${escapeHtml(item.type)}">${escapeHtml(item.message)}</div>`).join('');
}

function applyPreferences(preferences = {}) {
  document.body.dataset.textSize = preferences.textSize || 'normal';
  document.body.classList.toggle('reduce-motion', Boolean(preferences.reducedMotion));
}

function setPath(path, replace = false) {
  if (location.pathname === path) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
}

function currentRoute() {
  const play = location.pathname.match(/^\/play\/([^/]+)$/);
  if (play) return { name: 'play', id: decodeURIComponent(play[1]) };
  if (location.pathname === '/create') return { name: 'create' };
  return { name: 'dashboard' };
}

function topbar({ subtitle = 'Persistent worlds', back = false } = {}) {
  const user = state.user || { displayName: 'Player' };
  return `
    ${state.online ? '' : '<div class="offline-banner">You are offline. The cached interface is available, but turns require the World Engine.</div>'}
    <header class="topbar">
      ${back ? '<button class="icon-btn" data-action="dashboard" aria-label="Back to campaigns">←</button>' : ''}
      <div class="brand">
        <div class="brand-mini">A</div>
        <div class="brand-copy"><strong>Aporia Realms</strong><span>${escapeHtml(subtitle)}</span></div>
      </div>
      <div class="spacer"></div>
      <div class="connection"><span class="dot ${state.online ? '' : 'offline'}"></span><span>${state.online ? 'Connected' : 'Offline'}</span></div>
      ${state.installPrompt ? '<button class="btn small ghost" data-action="install">Install</button>' : ''}
      <div class="avatar-chip" title="${escapeHtml(user.email || user.displayName)}">
        <div class="avatar-circle">${escapeHtml(initials(user.displayName))}</div>
        <span>${escapeHtml(user.displayName)}</span>
      </div>
    </header>`;
}

function renderAuth(error = null) {
  app.innerHTML = `
    <main class="auth-screen">
      <div class="brand-sigil">A</div>
      <p class="eyebrow">Aporia Realms</p>
      <h1>Enter the Realm</h1>
      <p class="muted">${escapeHtml(error?.message || 'Sign in through the Aporia Nous access gateway to continue.')}</p>
      <div class="cluster" style="justify-content:center;margin-top:1rem">
        <button class="btn primary" data-action="retry-boot">Try again</button>
      </div>
    </main>`;
}

function renderFatal(error) {
  app.innerHTML = `
    <main class="error-screen">
      <div class="brand-sigil">!</div>
      <p class="eyebrow">World Engine unavailable</p>
      <h1>The gate did not open.</h1>
      <p class="muted">${escapeHtml(error?.message || 'Aporia Realms could not start.')}</p>
      <div class="cluster" style="justify-content:center;margin-top:1rem">
        <button class="btn primary" data-action="retry-boot">Retry</button>
      </div>
    </main>`;
}

function campaignCard(campaign) {
  return `
    <article class="campaign-card">
      <div class="campaign-art"><img class="campaign-art-image" src="${escapeHtml(campaign.image || '')}" alt="" loading="lazy"></div>
      <div class="campaign-body">
        <div>
          <p class="eyebrow">${escapeHtml(modeName(campaign.mode))}</p>
          <h3>${escapeHtml(campaign.title)}</h3>
        </div>
        <div class="campaign-meta">
          <span class="pill">${escapeHtml(campaign.characterName || 'Unknown hero')}</span>
          <span class="pill">${escapeHtml(campaign.location || 'Unknown location')}</span>
        </div>
        <p class="muted">Last played ${escapeHtml(formatDate(campaign.updatedAt))}</p>
        <div class="cluster">
          ${campaign.archivedAt
            ? `<button class="btn small" data-action="unarchive-card" data-campaign="${escapeHtml(campaign.id)}">Restore</button>`
            : `<button class="btn primary" data-action="open-campaign" data-campaign="${escapeHtml(campaign.id)}">Continue</button>
               <button class="btn small ghost" data-action="archive-card" data-campaign="${escapeHtml(campaign.id)}">Archive</button>`}
        </div>
      </div>
    </article>`;
}

function renderDashboard() {
  applyPreferences({});
  const list = state.showArchived ? state.archivedCampaigns : state.campaigns;
  app.innerHTML = `
    ${topbar({ subtitle: 'Your persistent worlds' })}
    <main class="dashboard">
      <section class="hero">
        <div class="hero-main">
          <p class="eyebrow">The world remembers</p>
          <h1>Play without rails.</h1>
          <p>Say what you want to do. The World Engine resolves what actually happens, commits it to the campaign, and only then lets the narrator tell the story.</p>
          <div class="cluster"><button class="btn primary" data-action="new-campaign">Start a new realm</button></div>
        </div>
        <aside class="hero-side">
          <div>
            <p class="eyebrow">Your library</p>
            <h2>${state.campaigns.length ? 'Continue where the world left off.' : 'Your first campaign starts here.'}</h2>
          </div>
          <div class="metric-grid">
            <div class="metric"><strong>${state.campaigns.length}</strong><span>Active campaigns</span></div>
            <div class="metric"><strong>${state.archivedCampaigns.length}</strong><span>Archived</span></div>
            <div class="metric"><strong>${state.worlds.filter((world) => world.available).length}</strong><span>Playable worlds</span></div>
            <div class="metric"><strong>3</strong><span>Play styles</span></div>
          </div>
        </aside>
      </section>

      <section>
        <div class="section-head">
          <div><h2>${state.showArchived ? 'Archived campaigns' : 'Your campaigns'}</h2><p>${state.showArchived ? 'Restore any campaign without losing its state.' : 'Every campaign resumes from its committed world state.'}</p></div>
          <div class="spacer"></div>
          <button class="btn small ghost" data-action="toggle-archived">${state.showArchived ? 'Show active' : `Archived (${state.archivedCampaigns.length})`}</button>
        </div>
        ${list.length
          ? `<div class="campaign-grid">${list.map(campaignCard).join('')}</div>`
          : `<div class="empty-card"><div><p class="eyebrow">${state.showArchived ? 'Nothing archived' : 'No campaigns yet'}</p><h3>${state.showArchived ? 'Your archive is empty.' : 'Create a hero. Enter the world.'}</h3>${state.showArchived ? '' : '<button class="btn primary" data-action="new-campaign">Start a campaign</button>'}</div></div>`}
      </section>
    </main>`;
}

function newCreateState() {
  return {
    step: 0,
    worldId: state.worlds.find((world) => world.available)?.id || 'solis-grave',
    mode: state.styles.find((style) => style.recommended)?.id || 'adventure',
    characterMode: 'premade',
    characterId: state.premades[0]?.id || 'ilyra',
    title: '',
    custom: {
      name: '', ancestry: state.characterOptions?.ancestries?.[0] || 'Human', role: state.characterOptions?.roles?.[0] || 'Fighter',
      background: state.characterOptions?.backgrounds?.[0] || 'Wanderer', pronouns: '', description: '', goal: ''
    },
    preferences: { readAloud: true, autoVoice: false, narratorVoice: 'af_heart', reducedMotion: false, textSize: 'normal' }
  };
}

function createStepWorld(create) {
  return `
    <h2>Choose a world</h2>
    <p class="muted">Worlds define the people, places, truths and rules your campaign begins with.</p>
    <div class="choice-grid">
      ${state.worlds.map((world) => `
        <button class="choice ${create.worldId === world.id ? 'selected' : ''}" data-choice="worldId" data-value="${escapeHtml(world.id)}" ${world.available ? '' : 'disabled'}>
          <strong>${escapeHtml(world.name)}</strong><span>${escapeHtml(world.description || world.tagline)}</span>
          <div class="campaign-meta">${(world.tone || []).map((tone) => `<span class="pill">${escapeHtml(tone)}</span>`).join('')}</div>
        </button>`).join('')}
    </div>`;
}

function createStepStyle(create) {
  return `
    <h2>How do you want to play?</h2>
    <p class="muted">The same canonical world can be presented as tabletop adventure, narrative story, or long-form book.</p>
    <div class="choice-grid">
      ${state.styles.map((style) => `
        <button class="choice ${create.mode === style.id ? 'selected' : ''}" data-choice="mode" data-value="${escapeHtml(style.id)}">
          <strong>${escapeHtml(style.name)} ${style.recommended ? '<span class="pill">Recommended</span>' : ''}</strong>
          <span>${escapeHtml(style.blurb)}</span>
        </button>`).join('')}
    </div>`;
}

function customCharacterFields(create) {
  const options = state.characterOptions || { ancestries: [], roles: [], backgrounds: [] };
  return `
    <div class="field-grid" style="margin-top:1rem">
      <div class="field"><label for="custom-name">Name</label><input class="input" id="custom-name" name="custom.name" maxlength="80" value="${escapeHtml(create.custom.name)}" placeholder="Your character's name"></div>
      <div class="field"><label for="custom-pronouns">Pronouns</label><input class="input" id="custom-pronouns" name="custom.pronouns" maxlength="40" value="${escapeHtml(create.custom.pronouns)}" placeholder="Optional"></div>
      <div class="field"><label for="custom-ancestry">Ancestry</label><select class="select" id="custom-ancestry" name="custom.ancestry">${options.ancestries.map((value) => `<option ${value === create.custom.ancestry ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></div>
      <div class="field"><label for="custom-role">Class</label><select class="select" id="custom-role" name="custom.role">${options.roles.map((value) => `<option ${value === create.custom.role ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></div>
      <div class="field"><label for="custom-background">Background</label><select class="select" id="custom-background" name="custom.background">${options.backgrounds.map((value) => `<option ${value === create.custom.background ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></div>
      <div class="field"><label for="campaign-title">Campaign title</label><input class="input" id="campaign-title" name="title" maxlength="120" value="${escapeHtml(create.title)}" placeholder="Optional"></div>
      <div class="field full"><label for="custom-description">Who are they?</label><textarea class="textarea" id="custom-description" name="custom.description" maxlength="600" placeholder="Appearance, temperament, history, whatever matters to you.">${escapeHtml(create.custom.description)}</textarea></div>
      <div class="field full"><label for="custom-goal">What do they want?</label><textarea class="textarea" id="custom-goal" name="custom.goal" maxlength="400" placeholder="A goal gives the world something meaningful to push against.">${escapeHtml(create.custom.goal)}</textarea></div>
    </div>`;
}

function createStepCharacter(create) {
  return `
    <h2>Choose who enters the world</h2>
    <div class="tabs">
      <button class="tab ${create.characterMode === 'premade' ? 'active' : ''}" data-choice="characterMode" data-value="premade">Premade</button>
      <button class="tab ${create.characterMode === 'custom' ? 'active' : ''}" data-choice="characterMode" data-value="custom">Create your own</button>
    </div>
    ${create.characterMode === 'premade' ? `
      <div class="choice-grid">
        ${state.premades.map((hero) => `
          <button class="choice ${create.characterId === hero.id ? 'selected' : ''}" data-choice="characterId" data-value="${escapeHtml(hero.id)}">
            <strong>${escapeHtml(hero.name)}</strong>
            <span>${escapeHtml(hero.ancestry)} · ${escapeHtml(hero.role)} · Level ${escapeHtml(hero.level)}</span>
            <p class="muted">${escapeHtml(hero.blurb)}</p>
            <span>${escapeHtml(hero.goal || '')}</span>
          </button>`).join('')}
      </div>
      <div class="field" style="margin-top:1rem"><label for="campaign-title">Campaign title</label><input class="input" id="campaign-title" name="title" maxlength="120" value="${escapeHtml(create.title)}" placeholder="Optional — defaults to the world name"></div>`
      : customCharacterFields(create)}`;
}

function createStepPreferences(create) {
  const p = create.preferences;
  return `
    <h2>Set the way the story meets you</h2>
    <p class="muted">These settings can be changed inside the campaign at any time.</p>
    <div class="stack">
      <label class="toggle"><div><strong>Read the story aloud</strong><div class="muted">Show voice controls for committed narration and dialogue.</div></div><input type="checkbox" name="preferences.readAloud" ${p.readAloud ? 'checked' : ''}></label>
      <label class="toggle"><div><strong>Automatically voice new narration</strong><div class="muted">Play new committed story lines after each turn.</div></div><input type="checkbox" name="preferences.autoVoice" ${p.autoVoice ? 'checked' : ''}></label>
      <label class="toggle"><div><strong>Reduce motion</strong><div class="muted">Minimize transitions and animated scrolling.</div></div><input type="checkbox" name="preferences.reducedMotion" ${p.reducedMotion ? 'checked' : ''}></label>
      <div class="field"><label for="text-size">Text size</label><select class="select" id="text-size" name="preferences.textSize"><option value="compact" ${p.textSize === 'compact' ? 'selected' : ''}>Compact</option><option value="normal" ${p.textSize === 'normal' ? 'selected' : ''}>Normal</option><option value="large" ${p.textSize === 'large' ? 'selected' : ''}>Large</option></select></div>
    </div>`;
}

function renderCreate() {
  state.create ||= newCreateState();
  const create = state.create;
  const steps = [createStepWorld, createStepStyle, createStepCharacter, createStepPreferences];
  app.innerHTML = `
    ${topbar({ subtitle: 'Create a campaign', back: true })}
    <main class="create-shell">
      <div class="wizard-head"><p class="eyebrow">New campaign</p><h1>Build your doorway in.</h1><p class="muted">You can change presentation settings later. The world itself remains authoritative.</p></div>
      <div class="steps">
        ${['World', 'Style', 'Hero', 'Finish'].map((label, index) => `<div class="step ${index === create.step ? 'active' : index < create.step ? 'done' : ''}" data-short="${index + 1}">${escapeHtml(label)}</div>`).join('')}
      </div>
      <section class="wizard-panel">
        ${steps[create.step](create)}
        <div class="wizard-actions">
          <button class="btn ghost" data-action="create-back">${create.step === 0 ? 'Cancel' : 'Back'}</button>
          <button class="btn primary" data-action="${create.step === steps.length - 1 ? 'create-submit' : 'create-next'}">${create.step === steps.length - 1 ? 'Enter the world' : 'Continue'}</button>
        </div>
      </section>
    </main>`;
}

function navButtons() {
  const tabs = [
    ['story', 'Story', '◈'],
    ['world', 'World', '◎'],
    ['journal', 'Journal', '☰'],
    ['character', 'Character', '◆'],
    ['settings', 'Settings', '⚙']
  ];
  return tabs.map(([id, label, glyph]) => `<button class="nav-btn ${state.gameTab === id ? 'active' : ''}" data-game-tab="${id}"><span class="nav-glyph">${glyph}</span><span>${label}</span></button>`).join('');
}

function hpProgress(hp) {
  if (!hp) return '';
  const current = Number(hp.current ?? hp) || 0;
  const max = Number(hp.max ?? current) || 1;
  return `<progress value="${Math.max(0, current)}" max="${Math.max(1, max)}"></progress>`;
}

function contextRail(game) {
  const present = game.scene?.present || [];
  return `
    <aside class="context-rail">
      <h3>Right now</h3>
      <div class="context-card"><strong>${escapeHtml(game.scene.location.name)}</strong><span>${escapeHtml(game.scene.location.weather)} · ${escapeHtml(game.scene.location.time)}</span></div>
      <h3>Present</h3>
      ${present.length ? present.map((person) => `<div class="context-card"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.role)} · ${escapeHtml((person.states || []).join(', '))}</span>${person.maxHp ? `<progress value="${Math.max(0, Number(person.hp || 0))}" max="${Math.max(1, Number(person.maxHp || 1))}"></progress>` : ''}</div>`).join('') : '<div class="context-card"><span>No one else is visible.</span></div>'}
      <h3>Campaign</h3>
      <div class="context-card"><strong>${escapeHtml(game.campaign.characterName)}</strong><span>${escapeHtml(modeName(game.campaign.mode))}</span></div>
    </aside>`;
}

function storyEntry(entry) {
  if (entry.type === 'chapter') return `<article class="story-entry chapter">${escapeHtml(entry.text)}</article>`;
  if (entry.type === 'roll') return `
    <article class="story-entry roll">
      <div class="roll-die"><strong>${escapeHtml(entry.natural ?? entry.total ?? '?')}</strong></div>
      <div><strong>${escapeHtml(entry.label || 'Roll')}</strong><div class="muted">${escapeHtml(entry.formula || '')} · Total ${escapeHtml(entry.total ?? '')} · ${escapeHtml(entry.outcome || '')}</div></div>
    </article>`;
  if (entry.type === 'player') return `<article class="story-entry player"><div class="speaker"><div class="avatar-circle">YOU</div><strong>You</strong></div><div>${escapeHtml(entry.text)}</div></article>`;
  if (entry.type === 'system') return `<article class="story-entry system">${escapeHtml(entry.text)}</article>`;
  const speakable = ['narration', 'dialogue'].includes(entry.type);
  const speaker = entry.type === 'dialogue' ? entry.speaker : null;
  return `
    <article class="story-entry ${entry.type === 'dialogue' ? 'dialogue' : 'narration'}">
      ${speaker ? `<div class="speaker"><div class="avatar-circle">${escapeHtml(initials(speaker))}</div><strong>${escapeHtml(speaker)}</strong></div>` : ''}
      <div>${escapeHtml(entry.text || '')}</div>
      ${speakable && state.game.campaign.preferences?.readAloud !== false ? `<div class="entry-actions"><button class="read-btn" data-action="speak-entry" data-entry="${escapeHtml(entry.id)}">▶ Read aloud</button></div>` : ''}
    </article>`;
}

function storyView(game) {
  const scene = game.scene;
  const image = scene.location.image || game.campaign.image || '';
  return `
    <div class="game-main-inner">
      <section class="location-hero">
        <div class="location-art">
          ${image ? `<img class="sr-only" src="${escapeHtml(image)}" alt="">` : ''}
          <div><p class="eyebrow">${escapeHtml(scene.location.region)}</p><h1>${escapeHtml(scene.location.name)}</h1><p>${escapeHtml(scene.location.description || '')}</p></div>
        </div>
        <div class="scene-strip"><span class="pill">${escapeHtml(scene.location.time)}</span><span class="pill">${escapeHtml(scene.location.weather)}</span><span class="pill">Turn ${escapeHtml(game.engineTurn || game.campaign.session || 1)}</span></div>
      </section>
      ${game.combat?.active ? `<section class="combat-card"><p class="eyebrow">Combat</p><h3>${escapeHtml(game.combat.target?.name || 'Threat')}</h3>${game.combat.target ? hpProgress({ current: game.combat.target.hp, max: game.combat.target.maxHp }) : ''}<p class="muted">Natural language still works. Attack, move, speak, use an item, or try something unexpected.</p></section>` : ''}
      <div class="suggestions">${(scene.suggestions || []).map((text) => `<button class="suggestion" data-action="use-suggestion" data-text="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join('')}</div>
      <section class="story-feed" id="story-feed">${(scene.feed || []).map(storyEntry).join('')}</section>
    </div>
    <div class="composer-wrap">
      <div class="composer">
        <label class="sr-only" for="intent">What do you do or say?</label>
        <textarea id="intent" maxlength="4000" placeholder="What do you do or say?">${escapeHtml(localStorage.getItem(`aporia:draft:${game.campaign.id}`) || '')}</textarea>
        <div class="composer-foot"><span>Write naturally. Speak, act, inspect, fight, bargain, lie, run, or try anything.</span><div class="spacer"></div><button class="btn primary" data-action="send-intent" ${state.sending ? 'disabled' : ''}>${state.sending ? 'Resolving…' : 'Continue'}</button></div>
      </div>
    </div>`;
}

function worldView(game) {
  const world = game.world;
  return `
    <div class="game-main-inner">
      <div class="panel-title"><p class="eyebrow">World</p><h1>${escapeHtml(game.scene.location.region)}</h1><p>Only discovered truths are shown here. Unknown places and relationships remain unknown.</p></div>
      <section class="map-board">
        ${(world.locations || []).map((loc) => `<div class="location-row ${loc.current ? 'current' : ''} ${loc.discovered ? '' : 'locked'}"><span class="location-marker"></span><div><strong>${escapeHtml(loc.name)}</strong><div class="muted">${loc.current ? 'You are here' : loc.discovered ? 'Discovered' : 'Undiscovered'}</div>${loc.text ? `<p>${escapeHtml(loc.text)}</p>` : ''}</div></div>`).join('')}
      </section>
      <div class="two-col">
        <section class="surface-card"><h3>Factions</h3><div class="data-list">${(world.factions || []).map((f) => `<div class="data-row"><div><strong>${escapeHtml(f.name)}</strong><div class="muted">${escapeHtml(f.text || '')}</div></div><span>${escapeHtml(f.standing || 'Unknown')}</span></div>`).join('')}</div></section>
        <section class="surface-card"><h3>Known people</h3><div class="data-list">${(world.npcs || []).map((npc) => `<div class="data-row"><div><strong>${escapeHtml(npc.name)}</strong><div class="muted">${escapeHtml(npc.role || '')}</div></div><span>${escapeHtml(npc.where || '')}</span></div>`).join('')}</div></section>
      </div>
    </div>`;
}

function journalView(game) {
  const journal = game.journal || {};
  const tabs = [['quests', 'Quests'], ['events', 'Events'], ['characters', 'People'], ['lore', 'Lore'], ['decisions', 'Decisions'], ['locations', 'Places']];
  const items = journal[state.journalTab] || [];
  return `
    <div class="game-main-inner">
      <div class="panel-title"><p class="eyebrow">Journal</p><h1>What the campaign remembers.</h1><p>This is player-visible history, not the world's hidden state.</p></div>
      <div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${state.journalTab === id ? 'active' : ''}" data-journal-tab="${id}">${label}</button>`).join('')}</div>
      <section class="journal-list">
        ${items.length ? items.map((item) => `<article class="journal-item"><strong>${escapeHtml(item.title || item.name || item.when || `Turn ${item.turn || ''}`)}</strong><small>${escapeHtml(item.status || item.type || item.where || '')}</small><p>${escapeHtml(item.summary || item.text || item.intent || '')}</p></article>`).join('') : '<div class="empty-card"><div><h3>Nothing here yet.</h3><p class="muted">The journal fills as the world becomes known.</p></div></div>'}
      </section>
    </div>`;
}

function characterView(game) {
  const c = game.character;
  return `
    <div class="game-main-inner">
      <section class="sheet-hero">
        <div><p class="eyebrow">Character</p><h1>${escapeHtml(c.name)}</h1><p class="muted">${escapeHtml(c.ancestry)} · ${escapeHtml(c.role)} ${c.subclass ? `· ${escapeHtml(c.subclass)}` : ''} · Level ${escapeHtml(c.level)}</p><p>${escapeHtml(c.description || '')}</p>${c.goal ? `<p><strong>Goal:</strong> ${escapeHtml(c.goal)}</p>` : ''}</div>
        <div class="hp-card"><span class="muted">Hit points</span><strong>${escapeHtml(c.hp?.current ?? 0)} / ${escapeHtml(c.hp?.max ?? 0)}</strong>${hpProgress(c.hp)}<div class="campaign-meta"><span class="pill">AC ${escapeHtml(c.ac)}</span><span class="pill">Speed ${escapeHtml(c.speed)}</span></div></div>
      </section>
      <section class="stat-grid">${(c.abilities || []).map((a) => `<div class="stat"><span>${escapeHtml(a.key)}</span><strong>${a.mod >= 0 ? '+' : ''}${escapeHtml(a.mod)}</strong><small>${escapeHtml(a.score)}</small></div>`).join('')}</section>
      <div class="two-col">
        <section class="surface-card"><h3>Skills</h3><div class="data-list">${(c.skills || []).map((s) => `<div class="data-row"><span>${s.proficient ? '● ' : ''}${escapeHtml(s.name)}</span><strong>${s.mod >= 0 ? '+' : ''}${escapeHtml(s.mod)}</strong></div>`).join('')}</div></section>
        <section class="surface-card"><h3>Attacks</h3><div class="data-list">${(c.attacks || []).map((a) => `<div class="data-row"><div><strong>${escapeHtml(a.name)}</strong><div class="muted">${escapeHtml(a.damage)} · ${escapeHtml(a.range)}</div></div><strong>${escapeHtml(a.hit)}</strong></div>`).join('')}</div></section>
        <section class="surface-card"><h3>Abilities</h3><div class="data-list">${(c.abilitiesList || []).map((a) => `<div><strong>${escapeHtml(a.name)}</strong><p class="muted">${escapeHtml(a.text)}</p></div>`).join('')}</div></section>
        <section class="surface-card"><h3>Spells</h3><div class="data-list">${(c.spells || []).length ? c.spells.map((s) => `<div><strong>${escapeHtml(s.name)}</strong><p class="muted">${escapeHtml(s.text || '')}</p></div>`).join('') : '<span class="muted">No spells prepared.</span>'}</div></section>
        <section class="surface-card"><h3>Equipment</h3><div class="data-list">${(c.equipment || []).map((i) => `<div class="data-row"><span>${escapeHtml(i.name)}</span><span class="muted">${escapeHtml(i.slot || '')}</span></div>`).join('')}</div></section>
        <section class="surface-card"><h3>Inventory</h3><div class="data-list">${(c.inventory || []).map((i) => `<div class="data-row"><span>${escapeHtml(i.name)}</span><strong>×${escapeHtml(i.qty ?? 1)}</strong></div>`).join('')}</div><div class="campaign-meta"><span class="pill">${escapeHtml(c.currency?.gp ?? 0)} gp</span><span class="pill">${escapeHtml(c.currency?.sp ?? 0)} sp</span><span class="pill">${escapeHtml(c.currency?.cp ?? 0)} cp</span></div></section>
      </div>
      <section class="surface-card" style="margin-top:1rem"><h3>Private notes</h3><textarea class="textarea" id="character-notes" maxlength="10000" placeholder="Notes only you can see in the character sheet.">${escapeHtml(c.notes || '')}</textarea><div class="notes-save"><button class="btn" data-action="save-notes">Save notes</button></div></section>
    </div>`;
}

function settingsView(game) {
  const p = game.campaign.preferences || {};
  const voices = game.voice?.voices || [];
  return `
    <div class="game-main-inner">
      <div class="panel-title"><p class="eyebrow">Settings</p><h1>Campaign controls</h1><p>Presentation can change. Canonical world state cannot be rewritten by these controls.</p></div>
      <div class="settings-grid">
        <section class="settings-section">
          <h3>Campaign</h3>
          <div class="field"><label for="campaign-title-setting">Title</label><input class="input" id="campaign-title-setting" value="${escapeHtml(game.campaign.title)}" maxlength="120"></div>
        </section>
        <section class="settings-section">
          <h3>Voice</h3>
          <div class="voice-status"><span class="dot ${game.voice?.ready ? '' : 'offline'}"></span>${game.voice?.ready ? 'Kokoro is ready' : 'Voice is currently unavailable'}</div>
          <div class="field" style="margin-top:.8rem"><label for="narrator-voice">Narrator voice</label><select class="select" id="narrator-voice">${voices.map((voice) => `<option value="${escapeHtml(voice.id)}" ${voice.id === p.narratorVoice ? 'selected' : ''}>${escapeHtml(voice.name || voice.id)}</option>`).join('')}</select></div>
          <label class="toggle" style="margin-top:.8rem"><div><strong>Read aloud controls</strong><div class="muted">Show voice playback on story entries.</div></div><input id="pref-read-aloud" type="checkbox" ${p.readAloud !== false ? 'checked' : ''}></label>
          <label class="toggle" style="margin-top:.8rem"><div><strong>Automatic narration</strong><div class="muted">Speak new committed narration after a turn.</div></div><input id="pref-auto-voice" type="checkbox" ${p.autoVoice ? 'checked' : ''}></label>
        </section>
        <section class="settings-section">
          <h3>Accessibility</h3>
          <div class="field"><label for="pref-text-size">Text size</label><select class="select" id="pref-text-size"><option value="compact" ${p.textSize === 'compact' ? 'selected' : ''}>Compact</option><option value="normal" ${!p.textSize || p.textSize === 'normal' ? 'selected' : ''}>Normal</option><option value="large" ${p.textSize === 'large' ? 'selected' : ''}>Large</option></select></div>
          <label class="toggle" style="margin-top:.8rem"><div><strong>Reduce motion</strong><div class="muted">Minimize interface animation.</div></div><input id="pref-reduced-motion" type="checkbox" ${p.reducedMotion ? 'checked' : ''}></label>
          <div class="cluster" style="margin-top:1rem"><button class="btn primary" data-action="save-settings">Save settings</button></div>
        </section>
        <section class="settings-section">
          <h3>Campaign data</h3>
          <div class="cluster"><button class="btn" data-action="export-campaign">Export player record</button><button class="btn" data-action="archive-campaign">Archive campaign</button><button class="btn" data-action="reset-campaign">Reset campaign</button></div>
        </section>
        <section class="settings-section danger-zone"><h3>Danger zone</h3><p class="muted">Deleting a campaign removes its persisted save file from this server.</p><button class="btn danger" data-action="delete-campaign">Delete campaign</button></section>
      </div>
    </div>`;
}

function renderGame() {
  const game = state.game;
  if (!game) return renderDashboard();
  applyPreferences(game.campaign.preferences);
  const main = state.gameTab === 'story' ? storyView(game)
    : state.gameTab === 'world' ? worldView(game)
      : state.gameTab === 'journal' ? journalView(game)
        : state.gameTab === 'character' ? characterView(game)
          : settingsView(game);
  app.innerHTML = `
    <div class="game-shell">
      ${topbar({ subtitle: `${game.campaign.title} · ${game.scene.location.name}`, back: true })}
      <div class="game-layout">
        <aside class="game-nav"><div class="nav-group">${navButtons()}</div><div class="nav-footer"><button class="btn small ghost" data-action="refresh-game">↻ Refresh state</button><button class="btn small ghost" data-action="dashboard">Campaigns</button></div></aside>
        <main class="game-main">${main}</main>
        ${contextRail(game)}
      </div>
      <nav class="mobile-nav" aria-label="Game navigation">${navButtons()}</nav>
    </div>`;
  if (state.gameTab === 'story') {
    requestAnimationFrame(() => {
      const feed = document.querySelector('#story-feed');
      if (feed) feed.scrollIntoView({ block: 'end' });
    });
  }
}

async function loadCampaignLists() {
  const [active, archived] = await Promise.all([api('/campaigns'), api('/campaigns?archived=true')]);
  state.campaigns = active;
  state.archivedCampaigns = archived;
}

async function openCampaign(id, { push = true } = {}) {
  state.loading = true;
  try {
    const game = await api(`/campaigns/${encodeURIComponent(id)}/bootstrap`);
    state.game = game;
    state.gameTab = 'story';
    state.journalTab = 'quests';
    localStorage.setItem('aporia:lastCampaign', id);
    if (push) setPath(`/play/${encodeURIComponent(id)}`);
    renderGame();
  } catch (error) {
    if (error.status === 404) {
      await loadCampaignLists().catch(() => {});
      setPath('/', true);
      state.game = null;
      renderDashboard();
      toast('That campaign is no longer available.', 'error');
    } else throw error;
  } finally {
    state.loading = false;
  }
}

async function refreshGame() {
  if (!state.game?.campaign?.id) return;
  const id = state.game.campaign.id;
  const tab = state.gameTab;
  state.game = await api(`/campaigns/${encodeURIComponent(id)}/bootstrap`);
  state.gameTab = tab;
  renderGame();
}

async function speakEntry(entryId) {
  const id = state.game?.campaign?.id;
  if (!id) return;
  if (state.audio) state.audio.pause();
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  try {
    const blob = await apiBlob(`/campaigns/${encodeURIComponent(id)}/voice`, {
      method: 'POST',
      body: JSON.stringify({ entryId })
    });
    state.audioUrl = URL.createObjectURL(blob);
    state.audio = new Audio(state.audioUrl);
    await state.audio.play();
  } catch (error) {
    toast(error.message || 'Voice is unavailable.', 'error');
  }
}

async function autoSpeak(entries) {
  if (!state.game?.campaign?.preferences?.autoVoice) return;
  for (const entry of entries.filter((item) => ['narration', 'dialogue'].includes(item.type))) {
    await speakEntry(entry.id);
    if (state.audio) await new Promise((resolve) => {
      state.audio.addEventListener('ended', resolve, { once: true });
      state.audio.addEventListener('error', resolve, { once: true });
    });
  }
}

async function sendIntent() {
  if (state.sending || !state.game) return;
  const textarea = document.querySelector('#intent');
  const text = textarea?.value?.trim();
  if (!text) return;
  const id = state.game.campaign.id;
  state.sending = true;
  localStorage.setItem(`aporia:draft:${id}`, text);
  renderGame();
  try {
    const result = await api(`/campaigns/${encodeURIComponent(id)}/intents`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    const feed = state.game.scene.feed;
    feed.push(result.playerEntry, ...(result.entries || []));
    state.game.scene.location = result.scene.location;
    state.game.scene.present = result.scene.present;
    state.game.scene.suggestions = result.scene.suggestions;
    state.game.combat = result.combat;
    state.game.engineTurn = result.engine?.turn;
    state.game.campaign.location = result.scene.location?.name || state.game.campaign.location;
    state.game.campaign.updatedAt = new Date().toISOString();
    localStorage.removeItem(`aporia:draft:${id}`);
    state.sending = false;
    renderGame();
    void autoSpeak(result.entries || []);
  } catch (error) {
    state.sending = false;
    if (error.payload?.committed) {
      toast('The turn committed, but narration failed. Reloading canonical state.', 'error');
      await refreshGame().catch(() => {});
      return;
    }
    renderGame();
    toast(error.status === 429 ? `${error.message} ${error.payload?.retryAfter ? `Try again in ${error.payload.retryAfter}s.` : ''}` : error.message, 'error');
  }
}

async function createCampaign() {
  const create = state.create;
  if (create.characterMode === 'custom' && !create.custom.name.trim()) {
    toast('Give your character a name before entering the world.', 'error');
    create.step = 2;
    return renderCreate();
  }
  const body = {
    worldId: create.worldId,
    mode: create.mode,
    characterId: create.characterMode === 'custom' ? 'custom' : create.characterId,
    customCharacter: create.characterMode === 'custom' ? create.custom : null,
    title: create.title,
    preferences: create.preferences
  };
  try {
    const campaign = await api('/campaigns', { method: 'POST', body: JSON.stringify(body) });
    state.create = null;
    await loadCampaignLists();
    await openCampaign(campaign.id);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function updateCreateFromField(element) {
  if (!state.create || !element.name) return;
  const value = element.type === 'checkbox' ? element.checked : element.value;
  const [group, key] = element.name.split('.');
  if (key && state.create[group]) state.create[group][key] = value;
  else state.create[element.name] = value;
}

async function saveNotes() {
  const notes = document.querySelector('#character-notes')?.value || '';
  const id = state.game.campaign.id;
  try {
    await api(`/campaigns/${encodeURIComponent(id)}/character/notes`, { method: 'PUT', body: JSON.stringify({ notes }) });
    state.game.character.notes = notes;
    toast('Notes saved.', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

async function saveSettings() {
  const id = state.game.campaign.id;
  const preferences = {
    readAloud: document.querySelector('#pref-read-aloud')?.checked ?? true,
    autoVoice: document.querySelector('#pref-auto-voice')?.checked ?? false,
    narratorVoice: document.querySelector('#narrator-voice')?.value || state.game.campaign.preferences?.narratorVoice || 'af_heart',
    reducedMotion: document.querySelector('#pref-reduced-motion')?.checked ?? false,
    textSize: document.querySelector('#pref-text-size')?.value || 'normal'
  };
  const title = document.querySelector('#campaign-title-setting')?.value || state.game.campaign.title;
  try {
    const campaign = await api(`/campaigns/${encodeURIComponent(id)}/settings`, { method: 'PUT', body: JSON.stringify({ title, preferences }) });
    state.game.campaign = campaign;
    applyPreferences(campaign.preferences);
    renderGame();
    toast('Settings saved.', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

async function archiveCampaign(id = state.game?.campaign?.id) {
  if (!id) return;
  try {
    await api(`/campaigns/${encodeURIComponent(id)}/archive`, { method: 'POST' });
    if (state.game?.campaign?.id === id) state.game = null;
    await loadCampaignLists();
    setPath('/');
    renderDashboard();
    toast('Campaign archived.', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

async function unarchiveCampaign(id) {
  try {
    await api(`/campaigns/${encodeURIComponent(id)}/unarchive`, { method: 'POST' });
    await loadCampaignLists();
    renderDashboard();
    toast('Campaign restored.', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

async function resetCampaign() {
  if (!state.game || !confirm('Reset this campaign to its opening state? This cannot be undone.')) return;
  try {
    state.game = await api(`/campaigns/${encodeURIComponent(state.game.campaign.id)}/reset`, { method: 'POST' });
    renderGame();
    toast('Campaign reset.', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

async function deleteCampaign() {
  if (!state.game || !confirm(`Delete “${state.game.campaign.title}” permanently?`)) return;
  const id = state.game.campaign.id;
  try {
    await api(`/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' });
    localStorage.removeItem(`aporia:draft:${id}`);
    state.game = null;
    await loadCampaignLists();
    setPath('/');
    renderDashboard();
    toast('Campaign deleted.', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

async function exportCampaign() {
  if (!state.game) return;
  try {
    const data = await api(`/campaigns/${encodeURIComponent(state.game.campaign.id)}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.game.campaign.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) { toast(error.message, 'error'); }
}

async function route() {
  const routeState = currentRoute();
  if (routeState.name === 'create') return renderCreate();
  if (routeState.name === 'play') return openCampaign(routeState.id, { push: false });
  state.game = null;
  renderDashboard();
}

async function boot() {
  state.loading = true;
  app.innerHTML = '<main class="boot-screen"><div class="brand-sigil">A</div><p class="eyebrow">Aporia Realms</p><h1>Waking the world…</h1><div class="loader"></div></main>';
  try {
    state.config = await api('/config');
    try {
      state.user = await api('/auth/session');
    } catch (error) {
      if (error.status === 401 || error.status === 403) return renderAuth(error);
      throw error;
    }
    const [worlds, styles, premades, characterOptions] = await Promise.all([
      api('/worlds'), api('/play-styles'), api('/characters/premade'), api('/characters/options')
    ]);
    state.worlds = worlds;
    state.styles = styles;
    state.premades = premades;
    state.characterOptions = characterOptions;
    await loadCampaignLists();
    state.loading = false;
    await route();
  } catch (error) {
    state.loading = false;
    renderFatal(error);
  }
}

app.addEventListener('click', async (event) => {
  const tab = event.target.closest('[data-game-tab]');
  if (tab) {
    state.gameTab = tab.dataset.gameTab;
    return renderGame();
  }
  const journalTab = event.target.closest('[data-journal-tab]');
  if (journalTab) {
    state.journalTab = journalTab.dataset.journalTab;
    return renderGame();
  }
  const choice = event.target.closest('[data-choice]');
  if (choice && state.create) {
    state.create[choice.dataset.choice] = choice.dataset.value;
    if (choice.dataset.choice === 'characterMode') state.create.characterMode = choice.dataset.value;
    return renderCreate();
  }

  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  if (action === 'retry-boot') return boot();
  if (action === 'dashboard') { state.create = null; state.game = null; setPath('/'); return renderDashboard(); }
  if (action === 'new-campaign') { state.create = newCreateState(); setPath('/create'); return renderCreate(); }
  if (action === 'toggle-archived') { state.showArchived = !state.showArchived; return renderDashboard(); }
  if (action === 'open-campaign') return openCampaign(button.dataset.campaign);
  if (action === 'archive-card') return archiveCampaign(button.dataset.campaign);
  if (action === 'unarchive-card') return unarchiveCampaign(button.dataset.campaign);
  if (action === 'create-back') {
    if (state.create.step === 0) { state.create = null; setPath('/'); return renderDashboard(); }
    state.create.step--;
    return renderCreate();
  }
  if (action === 'create-next') { state.create.step = Math.min(3, state.create.step + 1); return renderCreate(); }
  if (action === 'create-submit') return createCampaign();
  if (action === 'use-suggestion') {
    const textarea = document.querySelector('#intent');
    if (textarea) { textarea.value = button.dataset.text || ''; textarea.focus(); }
    return;
  }
  if (action === 'send-intent') return sendIntent();
  if (action === 'speak-entry') return speakEntry(button.dataset.entry);
  if (action === 'save-notes') return saveNotes();
  if (action === 'save-settings') return saveSettings();
  if (action === 'archive-campaign') return archiveCampaign();
  if (action === 'reset-campaign') return resetCampaign();
  if (action === 'delete-campaign') return deleteCampaign();
  if (action === 'export-campaign') return exportCampaign();
  if (action === 'refresh-game') {
    try { await refreshGame(); toast('Canonical state refreshed.', 'success'); } catch (error) { toast(error.message, 'error'); }
    return;
  }
  if (action === 'install' && state.installPrompt) {
    state.installPrompt.prompt();
    await state.installPrompt.userChoice.catch(() => {});
    state.installPrompt = null;
    return state.game ? renderGame() : renderDashboard();
  }
});

app.addEventListener('input', (event) => {
  if (event.target.closest('.create-shell')) updateCreateFromField(event.target);
  if (event.target.id === 'intent' && state.game) localStorage.setItem(`aporia:draft:${state.game.campaign.id}`, event.target.value);
});
app.addEventListener('change', (event) => {
  if (event.target.closest('.create-shell')) updateCreateFromField(event.target);
});
app.addEventListener('keydown', (event) => {
  if (event.target.id === 'intent' && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void sendIntent();
  }
});

window.addEventListener('popstate', () => void route());
window.addEventListener('online', () => { state.online = true; state.game ? renderGame() : renderDashboard(); toast('Connection restored.', 'success'); });
window.addEventListener('offline', () => { state.online = false; state.game ? renderGame() : renderDashboard(); });
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.installPrompt = event;
  if (!state.loading) state.game ? renderGame() : renderDashboard();
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

void boot();
