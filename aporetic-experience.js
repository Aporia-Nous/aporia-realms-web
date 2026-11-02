(() => {
  const COPY = new Map([
    ['Your persistent worlds', 'Your worlds'],
    ['The world remembers', 'Your choices stay made'],
    ['Play without rails.', 'Say it. Try it. Live with what happens.'],
    ['Say what you want to do. The World Engine resolves what actually happens, commits it to the campaign, and only then lets the narrator tell the story.', 'You are not picking from a menu. Speak, act, bluff, fight, investigate, walk away, or try something the story never expected. The world reacts, remembers, and keeps going.'],
    ['Start a new realm', 'Start a new world'],
    ['Your library', 'Your worlds'],
    ['Continue where the world left off.', 'Pick up exactly where you left it.'],
    ['Your first campaign starts here.', 'Make a character and step in.'],
    ['Every campaign resumes from its committed world state.', 'Nothing resets just because you closed the game. Your choices, consequences, and discoveries are still there.'],
    ['Restore any campaign without losing its state.', 'Bring a world back exactly as you left it.'],
    ['Create a hero. Enter the world.', 'Create someone. Then see what the world does with them.'],
    ['Choose a world', 'Choose where you want to begin'],
    ['Worlds define the people, places, truths and rules your campaign begins with.', 'Each world has its own people, dangers, history, rules, and things it is not going to tell you yet.'],
    ['How do you want to play?', 'How should the world tell your story?'],
    ['The same canonical world can be presented as tabletop adventure, narrative story, or long-form book.', 'The world stays the same. You choose how close the experience feels to a game, a story, or a novel.'],
    ['Choose who enters the world', 'Who are you sending in?'],
    ['Set the way the story meets you', 'Make it feel right'],
    ['These settings can be changed inside the campaign at any time.', 'You can change these later without changing what happened in the world.'],
    ['Read the story aloud', 'Voice playback'],
    ['Show voice controls for committed narration and dialogue.', 'Add a Listen button to narration and spoken dialogue.'],
    ['Automatically voice new narration', 'Speak new scenes automatically'],
    ['Play new committed story lines after each turn.', 'Play narration and dialogue as soon as the world answers.'],
    ['Build your doorway in.', 'Set the world. Set the character. Go.'],
    ['You can change presentation settings later. The world itself remains authoritative.', 'You can change how the story is presented later. What happens in the world stays happened.'],
    ['No one else is visible.', 'No one else is in sight.'],
    ['Write naturally. Speak, act, inspect, fight, bargain, lie, run, or try anything.', 'Type what you actually want to do. No command syntax.'],
    ['Only discovered truths are shown here. Unknown places and relationships remain unknown.', 'This only shows what your character has actually learned. The rest stays hidden until you find it.'],
    ['What the campaign remembers.', 'What you have learned so far'],
    ["This is player-visible history, not the world's hidden state.", 'People, places, decisions, and events your character has actually encountered.'],
    ['The journal fills as the world becomes known.', 'It fills in as you discover the world.'],
    ['Campaign controls', 'Campaign settings'],
    ['Presentation can change. Canonical world state cannot be rewritten by these controls.', 'Change how the experience looks and sounds. These settings never rewrite what already happened.'],
    ['Kokoro is ready', 'Voice is ready'],
    ['Voice is currently unavailable', 'Voice is offline right now'],
    ['Read aloud controls', 'Show Listen buttons'],
    ['Show voice playback on story entries.', 'Add voice playback to narration and dialogue.'],
    ['Automatic narration', 'Automatic voice'],
    ['Speak new committed narration after a turn.', 'Play new narration and dialogue after each turn.'],
    ['Campaign data', 'Save data'],
    ['Export player record', 'Export campaign'],
    ['Deleting a campaign removes its persisted save file from this server.', 'Deleting this campaign permanently removes its saved world from this server.'],
    ['World Engine unavailable', 'Aporia Realms is unavailable'],
    ['The gate did not open.', 'The world could not load.'],
    ['Waking the world…', 'Loading your worlds…'],
    ['Canonical state refreshed.', 'World state refreshed.'],
    ['The turn committed, but narration failed. Reloading canonical state.', 'Your action happened, but the story response did not finish loading. Refreshing the world now.']
  ]);

  const ATTR_COPY = {
    'What do you do or say?': 'What do you do?',
    'Notes only you can see in the character sheet.': 'Private notes for this character.',
    'Appearance, temperament, history, whatever matters to you.': 'Who are they? What should the world know about them?',
    'A goal gives the world something meaningful to push against.': 'What are they trying to accomplish?'
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
      button.classList.toggle('is-speaking', entryId === activeEntryId);
      button.classList.toggle('is-loading', entryId === requestEntryId);
      button.setAttribute('aria-pressed', entryId === activeEntryId ? 'true' : 'false');
      button.textContent = entryId === requestEntryId ? 'Preparing voice…' : entryId === activeEntryId ? '■ Stop' : '▶ Listen';
      button.title = entryId === activeEntryId ? 'Stop voice playback' : 'Play this line aloud';
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
