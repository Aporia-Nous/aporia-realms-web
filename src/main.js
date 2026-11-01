const API_BASE = import.meta.env.VITE_API_URL || 'https://api.aporiarealms.com';

const app = document.querySelector('#app');
let campaign = null;
let currentScene = null;
let character = null;
let feed = [];
let readAloud = true;
let isAudioPlaying = false;
let currentAudio = null;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const FRIENDLY_VOICES = {
  af_heart: 'Warm & natural',
  af_bella: 'Warm & expressive',
  af_aoede: 'Clear & calm',
  af_nicole: 'Soft storyteller',
  bf_emma: 'Refined British',
  am_fenrir: 'Energetic',
  am_michael: 'Grounded',
  am_puck: 'Animated',
  bm_fable: 'British storyteller',
  bm_george: 'Calm British',
  af_mica: 'Bright & lively',
  af_quartz: 'Light & clear',
  af_amber: 'Warm & smooth',
  am_granite: 'Deep & deliberate',
  am_slate: 'Quiet & restrained',
  am_ash: 'Dark & dramatic'
};

function voiceName(id) {
  return FRIENDLY_VOICES[id] || id || 'Narrator voice';
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '•';
}

function renderFeed() {
  if (!feed || feed.length === 0) {
    return `<div style="color: var(--muted); text-align: center; padding: 40px;">The world awaits your action.</div>`;
  }
  return feed.map(entry => {
    const isPlayer = entry.type === 'player';
    const isNarrator = entry.type === 'narration' || (!entry.speaker && !isPlayer);
    const speaker = entry.speaker || (isPlayer ? 'You' : 'Narrator');
    
    return `
      <article class="story-entry ${isPlayer ? 'player-entry' : (isNarrator ? 'narration' : 'dialogue')}">
        <div class="speaker-row">
          <div class="avatar ${isPlayer ? 'player-avatar' : ''}">${escapeHtml(initials(speaker))}</div>
          <strong>${escapeHtml(speaker)}</strong>
        </div>
        <div class="story-text">${escapeHtml(entry.text || '')}</div>
      </article>
    `;
  }).join('');
}

function render() {
  if (!campaign) {
    renderWorldSelect();
    return;
  }

  const charName = character?.name || 'Aethelgard';
  const charRole = character?.role || 'Paladin';
  const charHp = character?.hp?.current || 24;
  const maxHp = character?.hp?.max || 24;
  const hpPct = Math.max(0, Math.min(100, (charHp / maxHp) * 100));

  app.innerHTML = `
    <div class="world-shell">
      <aside class="left-rail">
        <div class="brand-block">
          <div class="brand-mark">AR</div>
          <div>
            <strong>Aporia Realms</strong>
            <span>${escapeHtml(campaign.worldId || 'Solis Grave')}</span>
          </div>
        </div>

        <nav class="main-nav" aria-label="Main navigation">
          <button class="nav-link active">Adventure</button>
          <button class="nav-link" id="viewJournal">Journal</button>
          <button class="nav-link" id="leaveWorld">Worlds</button>
        </nav>

        <div class="rail-label">Your party</div>
        <div class="party-list">
          <div class="party-card">
            <div class="party-avatar">${escapeHtml(initials(charName))}</div>
            <div class="party-info">
              <strong>${escapeHtml(charName)}</strong>
              <span>${escapeHtml(charRole)} (Level ${character?.level || 4})</span>
              <div class="hp"><span style="width:${hpPct}%"></span></div>
            </div>
          </div>
        </div>

        <div class="rail-bottom">
          <span class="live-dot"></span>
          <span>Engine Active (${API_BASE.replace('https://', '')})</span>
        </div>
      </aside>

      <main class="story-panel">
        <header class="story-header">
          <div>
            <span class="chapter-label">Aporia Realms • Live</span>
            <h1>${escapeHtml(currentScene?.location?.name || 'The Citadel Border')}</h1>
            <p>${escapeHtml(currentScene?.location?.region || 'Dark Fantasy Blight')} • ${escapeHtml(currentScene?.location?.time || 'Dusk')}</p>
          </div>
          <button id="readAloud" class="sound-toggle ${readAloud ? 'on' : ''}" aria-pressed="${readAloud}">
            ${readAloud ? '🔊 Read aloud' : '🔇 Voice off'}
          </button>
        </header>

        <section class="scene-card">
          <div class="scene-copy">
            <span class="scene-kicker">Atmosphere</span>
            <h2>${escapeHtml(currentScene?.location?.name || 'Border Crossing')}</h2>
            <p>${escapeHtml(currentScene?.location?.text || 'Muddy border barricade manned by garrison watch.')}</p>
          </div>
          <div class="atmosphere">
            <span>Weather: ${escapeHtml(currentScene?.location?.weather || 'Cold rain')}</span>
            <span>Mode: ${escapeHtml(campaign.mode || 'Adventure')}</span>
          </div>
        </section>

        <section class="story-feed">${renderFeed()}</section>

        <div class="action-box">
          <textarea id="intent" placeholder="What do you do or say?" aria-label="What do you do or say?"></textarea>
          <div class="action-footer">
            <span id="engineStatus">Actions and dice rolls resolve authoritatively in the engine.</span>
            <button id="sendIntent" class="continue-btn">Continue</button>
          </div>
        </div>
      </main>

      <aside class="settings-panel">
        <div class="settings-head">
          <span>Active World</span>
          <small>${escapeHtml(campaign.id)}</small>
        </div>

        <div class="setting-group">
          <label>Present Characters</label>
          <div style="font-size: 11px; line-height: 1.6; color: var(--text);">
            ${(currentScene?.present || []).map(p => `<div><strong>${escapeHtml(p.name)}</strong><br><span style="color:var(--muted);">${escapeHtml(p.role)}</span></div>`).join('<hr style="border:0;border-top:1px solid var(--line);margin:6px 0;">') || '<span style="color:var(--muted);">No one in immediate view</span>'}
          </div>
        </div>

        <div class="setting-group">
          <label>Action Suggestions</label>
          <div style="display: grid; gap: 6px;">
            ${(currentScene?.suggestions || []).map(s => `<button class="suggestion-btn" data-intent="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
          </div>
        </div>

        <div class="tip-card">
          <strong>Authoritative Rules</strong>
          <p>The rules engine resolves combat math, skills, and conditions before the narrator describes the committed reality.</p>
        </div>
      </aside>
    </div>
  `;

  bindEvents();
}

function renderWorldSelect() {
  app.innerHTML = `
    <div class="boot-card" style="max-width: 580px;">
      <div class="brand-block" style="justify-content: center; margin-bottom: 14px;">
        <div class="brand-mark">AR</div>
      </div>
      <h2 style="text-align: center; margin-bottom: 4px;">Aporia Realms</h2>
      <p style="text-align: center; color: var(--muted); margin-bottom: 24px;">Select a living world to enter.</p>

      <div style="border: 1px solid var(--line); border-radius: 16px; padding: 18px; background: rgba(255,255,255,0.02); margin-bottom: 20px;">
        <h3 style="margin: 0 0 6px 0;">Solis Grave</h3>
        <p style="font-size: 12px; color: var(--muted); line-height: 1.5; margin: 0 0 14px 0;">
          A dark fantasy world gripped by the Sovereign Blight. Full D&D 5e mechanics, unyielding continuity, and authoritative local voice.
        </p>
        <div style="display: flex; gap: 10px;">
          <button id="btnEnterSolis" class="continue-btn" style="flex: 1; padding: 12px;">Enter Solis Grave</button>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#btnEnterSolis')?.addEventListener('click', enterWorld);
}

async function enterWorld() {
  app.innerHTML = `<div class="boot-card"><p>Entering Solis Grave…</p></div>`;
  try {
    const res = await fetch(`${API_BASE}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldId: 'solis-grave', mode: 'adventure', characterName: 'Aethelgard' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    campaign = await res.json();
    
    // Fetch initial scene and character
    const [sceneRes, charRes] = await Promise.all([
      fetch(`${API_BASE}/campaigns/${campaign.id}/scene`),
      fetch(`${API_BASE}/campaigns/${campaign.id}/character`)
    ]);
    currentScene = await sceneRes.json();
    character = await charRes.json();
    feed = currentScene.feed || [];
    render();
  } catch (err) {
    app.innerHTML = `<div class="boot-card"><h3>Failed to enter world</h3><p>${escapeHtml(err.message)}</p><button class="continue-btn" onclick="location.reload()">Retry</button></div>`;
  }
}

async function handleIntent(text) {
  if (!text || !campaign) return;

  const btn = document.querySelector('#sendIntent');
  const input = document.querySelector('#intent');
  const statusSpan = document.querySelector('#engineStatus');

  if (btn) btn.disabled = true;
  if (input) input.disabled = true;
  if (statusSpan) statusSpan.textContent = 'Resolving intent through World Engine…';

  // Optimistically push player text
  feed.push({ type: 'player', text, speaker: 'You' });
  render();

  try {
    const res = await fetch(`${API_BASE}/campaigns/${campaign.id}/intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.entries) {
      feed.push(...data.entries);
    }
    if (data.scene) {
      currentScene = { ...currentScene, ...data.scene };
    }

    render();

    // Trigger read aloud for narrator or dialog entries if enabled
    if (readAloud && data.entries && data.entries.length > 0) {
      const speechEntries = data.entries.filter(e => e.type === 'dialogue' || e.type === 'narration');
      for (const entry of speechEntries) {
        await speakText(entry.text, entry.speaker);
      }
    }
  } catch (err) {
    if (statusSpan) statusSpan.textContent = `Engine error: ${err.message}`;
  } finally {
    if (btn) btn.disabled = false;
    if (input) {
      input.disabled = false;
      input.value = '';
      input.focus();
    }
    if (statusSpan) statusSpan.textContent = 'Write naturally. You can speak, act, inspect, or try anything.';
  }
}

async function speakText(text, speaker = 'NARRATOR') {
  if (!text || !campaign) return;
  try {
    const res = await fetch(`${API_BASE}/api/voice/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: campaign.id, text, speaker })
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (currentAudio) {
      currentAudio.pause();
    }
    currentAudio = new Audio(url);
    await currentAudio.play();
  } catch (err) {
    console.warn('Speech playback failed', err);
  }
}

function bindEvents() {
  document.querySelector('#readAloud')?.addEventListener('click', () => {
    readAloud = !readAloud;
    render();
  });

  document.querySelector('#sendIntent')?.addEventListener('click', () => {
    const text = document.querySelector('#intent')?.value?.trim();
    if (text) handleIntent(text);
  });

  document.querySelector('#intent')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = e.target.value?.trim();
      if (text) handleIntent(text);
    }
  });

  document.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const intent = btn.getAttribute('data-intent');
      if (intent) handleIntent(intent);
    });
  });

  document.querySelector('#leaveWorld')?.addEventListener('click', () => {
    campaign = null;
    render();
  });
}

render();
