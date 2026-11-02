(() => {
  const COPY = new Map([
    ['Your persistent worlds', 'Your worlds'],
    ['The world remembers', 'Aporia Realms'],
    ['Play without rails.', 'Play your way.'],
    ['Say what you want to do. The World Engine resolves what actually happens, commits it to the campaign, and only then lets the narrator tell the story.', 'Type what you want your character to do or say. You are not limited to a list of choices, and the world remembers what happens.'],
    ['Start a new realm', 'Start a new campaign'],
    ['Your library', 'Your campaigns'],
    ['Continue where the world left off.', 'Continue a campaign.'],
    ['Your first campaign starts here.', 'Start your first campaign.'],
    ['Every campaign resumes from its committed world state.', 'Your progress, choices, and discoveries are saved with each campaign.'],
    ['Restore any campaign without losing its state.', 'Restore a campaign and continue where you left off.'],
    ['Create a hero. Enter the world.', 'Create a character and start playing.'],
    ['Choose a world', 'Choose a world'],
    ['Worlds define the people, places, truths and rules your campaign begins with.', 'Each world has its own setting, characters, history, and rules.'],
    ['How do you want to play?', 'Choose a play style'],
    ['The same canonical world can be presented as tabletop adventure, narrative story, or long-form book.', 'Choose whether you want the experience to feel more like a tabletop game, a story, or a book.'],
    ['Choose who enters the world', 'Choose your character'],
    ['Set the way the story meets you', 'Preferences'],
    ['These settings can be changed inside the campaign at any time.', 'You can change these settings later.'],
    ['Read the story aloud', 'Voice playback'],
    ['Show voice controls for committed narration and dialogue.', 'Show a Listen button on narration and dialogue.'],
    ['Automatically voice new narration', 'Play new narration automatically'],
    ['Play new committed story lines after each turn.', 'Automatically play narration and dialogue after each turn.'],
    ['Build your doorway in.', 'Create a campaign'],
    ['You can change presentation settings later. The world itself remains authoritative.', 'Choose your world, play style, character, and preferences. You can change presentation settings later.'],
    ['No one else is visible.', 'No one else is here.'],
    ['Write naturally. Speak, act, inspect, fight, bargain, lie, run, or try anything.', 'Just type what you want to do or say.'],
    ['Only discovered truths are shown here. Unknown places and relationships remain unknown.', 'This page only shows places, people, and information your character has discovered.'],
    ['What the campaign remembers.', 'Journal'],
    ["This is player-visible history, not the world's hidden state.", 'Your journal keeps track of what your character has learned and experienced.'],
    ['The journal fills as the world becomes known.', 'New entries appear as you discover more.'],
    ['Campaign controls', 'Campaign settings'],
    ['Presentation can change. Canonical world state cannot be rewritten by these controls.', 'Change how the campaign looks and sounds. These settings do not change your progress.'],
    ['Kokoro is ready', 'Voice is ready'],
    ['Voice is currently unavailable', 'Voice is unavailable right now'],
    ['Read aloud controls', 'Show Listen buttons'],
    ['Show voice playback on story entries.', 'Show voice playback on narration and dialogue.'],
    ['Automatic narration', 'Automatic voice'],
    ['Speak new committed narration after a turn.', 'Play narration and dialogue automatically after each turn.'],
    ['Campaign data', 'Campaign data'],
    ['Export player record', 'Export campaign'],
    ['Deleting a campaign removes its persisted save file from this server.', 'Deleting this campaign permanently removes its saved data.'],
    ['World Engine unavailable', 'Aporia Realms is unavailable'],
    ['The gate did not open.', 'The game could not load.'],
    ['Waking the world…', 'Loading…'],
    ['Canonical state refreshed.', 'Campaign refreshed.'],
    ['The turn committed, but narration failed. Reloading canonical state.', 'Your action was saved, but the response did not finish loading. Refreshing the campaign.']
  ]);

  const ATTR_COPY = {
    'What do you do or say?': 'What do you do?',
    'Notes only you can see in the character sheet.': 'Private notes for this character.',
    'Appearance, temperament, history, whatever matters to you.': 'Describe your character.',
    'A goal gives the world something meaningful to push against.': 'What does your character want?'
  };

  let activeEntryId = null;
  let requestEntryId = null;

  const polishNode = (root = document) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue?.trim();
      if (!text || !COPY.has(text)) continue;
      const replacement = COPY.get(text);
      node.nodeValue = node.nodeValue.replace(text, replacement);
    }

    root.querySelectorAll?.('[placeholder]').forEach((el) => {
      const replacement = ATTR_COPY[el.getAttribute('placeholder')];
      if (replacement) el.setAttribute('placeholder', replacement);
    });

    root.querySelectorAll?.('[data-action="speak-entry"]').forEach((button) => {
      const entryId = button.dataset.entry;
      const speaking = entryId === activeEntryId;
      const loading = entryId === requestEntryId;
      const pressed = speaking ? 'true' : 'false';
      const label = loading ? 'Loading voice…' : speaking ? '■ Stop' : '▶ Listen';
      const title = speaking ? 'Stop playback' : 'Listen';
      button.classList.toggle('is-speaking', speaking);
      button.classList.toggle('is-loading', loading);
      if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
      if (button.textContent !== label) button.textContent = label;
      if (button.title !== title) button.title = title;
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) polishNode(node);
      }
    }
    polishNode(document);
  });

  const stopVoice = () => {
    if (typeof state !== 'undefined' && state.audio) {
      try {
        state.audio.pause();
        state.audio.currentTime = 0;
      } catch {}
    }
    activeEntryId = null;
    requestEntryId = null;
    polishNode(document);
  };

  if (typeof speakEntry === 'function') {
    const baseSpeakEntry = speakEntry;
    speakEntry = async function enhancedSpeakEntry(entryId) {
      if (activeEntryId === entryId && typeof state !== 'undefined' && state.audio && !state.audio.paused) {
        stopVoice();
        return;
      }

      stopVoice();
      requestEntryId = entryId;
      polishNode(document);

      try {
        await baseSpeakEntry(entryId);
        requestEntryId = null;
        if (typeof state === 'undefined' || !state.audio || state.audio.paused) {
          polishNode(document);
          return;
        }

        activeEntryId = entryId;
        const finish = () => {
          if (activeEntryId === entryId) activeEntryId = null;
          polishNode(document);
        };
        state.audio.addEventListener('ended', finish, { once: true });
        state.audio.addEventListener('error', finish, { once: true });
        polishNode(document);
      } catch (error) {
        requestEntryId = null;
        activeEntryId = null;
        polishNode(document);
        throw error;
      }
    };
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeEntryId) stopVoice();
  });

  window.addEventListener('beforeunload', stopVoice);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  polishNode(document);
})();
