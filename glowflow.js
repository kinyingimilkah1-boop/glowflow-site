const soundToggle = document.querySelector('#soundToggle');
const volumeSlider = document.querySelector('#volumeSlider');
const soundStatus = document.querySelector('#soundStatus');
const bubbleArea = document.querySelector('#bubbleArea');
const gameMessage = document.querySelector('#gameMessage');
const scoreValue = document.querySelector('#scoreValue');
const timerText = document.querySelector('#timerText');
const pauseProgress = document.querySelector('#pauseProgress');
const pauseStatus = document.querySelector('#pauseStatus');
const breathingPanel = document.querySelector('#breathe');
const breathingToggle = document.querySelector('#breathingToggle');
const journalEntry = document.querySelector('#journalEntry');
const journalStatus = document.querySelector('#journalStatus');
const journalCount = document.querySelector('#journalCount');
const kindnessSuggestion = document.querySelector('#kindnessSuggestion');
const intentionSuggestion = document.querySelector('#intentionSuggestion');

const bubblePositions = [
  [12, 30], [29, 66], [43, 32], [57, 68],
  [72, 35], [87, 66], [19, 77], [77, 78]
];
const breathingPhases = [
  { name: 'phase-inhale', label: 'Inhale', description: 'Breathe in gently.', duration: 4000 },
  { name: 'phase-exhale', label: 'Exhale', description: 'Let the breath go softly.', duration: 6000 },
  { name: 'phase-breathe', label: 'Breathe', description: 'Let your breath find its own rhythm.', duration: 5000 },
  { name: 'phase-rest', label: 'Rest', description: 'Rest here. Keep breathing naturally.', duration: 5000 }
];

let poppedBubbles = 0;
let timerInterval;
let pauseDuration = 120;
let pauseEndsAt = 0;
let audioContext;
let rainSource;
let rainGain;
let soundStatusTimeout;

function createBubbles() {
  bubbleArea.replaceChildren();

  bubblePositions.forEach(([x, y], index) => {
    bubbleArea.append(makeBubble(x, y, index));
  });
}

function resetBubbles() {
  poppedBubbles = 0;
  scoreValue.textContent = '0';
  gameMessage.textContent = 'Tap a bubble whenever you feel ready.';
  createBubbles();
}

function makeBubble(x, y, index) {
  const bubble = document.createElement('button');
  bubble.type = 'button';
  bubble.className = 'stress-bubble';
  bubble.style.setProperty('--x', `${x}%`);
  bubble.style.setProperty('--y', `${y}%`);
  bubble.style.setProperty('--size', `${82 + (index % 3) * 12}px`);
  bubble.style.setProperty('--delay', `${(index % 4) * -0.55}s`);
  bubble.setAttribute('aria-label', 'Pop a bubble');
  bubble.addEventListener('click', () => {
    bubble.disabled = true;
    bubble.classList.add('popped');
    poppedBubbles += 1;
    scoreValue.textContent = String(poppedBubbles);
    gameMessage.textContent = 'A little lighter. Pop another whenever you like.';

    window.setTimeout(() => {
      const replacement = makeBubble(
        10 + Math.random() * 80,
        22 + Math.random() * 67,
        poppedBubbles
      );
      bubble.replaceWith(replacement);
    }, 300);
  });
  return bubble;
}

function updateJournalStatus() {
  journalCount.textContent = `${journalEntry.value.length} / 1000`;
  try {
    localStorage.setItem(journalEntry.dataset.storageKey || 'glowflowJournal', journalEntry.value);
    journalStatus.textContent = 'Saved privately on this device.';
  } catch (error) {
    console.error('Unable to save the journal note on this device.', error);
    journalStatus.textContent = 'This note could not be saved. Your browser storage may be unavailable.';
  }
}

function restoreJournal() {
  try {
    const savedNote = localStorage.getItem(journalEntry.dataset.storageKey || 'glowflowJournal');
    if (savedNote !== null) {
      journalEntry.value = savedNote.slice(0, 1000);
      journalCount.textContent = `${journalEntry.value.length} / 1000`;
      journalStatus.textContent = 'Your note is saved privately on this device.';
    }
  } catch (error) {
    console.error('Unable to restore the journal note from this device.', error);
    journalStatus.textContent = 'Saved notes are unavailable in this browser.';
  }
}

function restoreRainVolume() {
  try {
    const savedVolume = localStorage.getItem(volumeSlider.dataset.storageKey || 'glowflowSettings');
    if (savedVolume !== null) {
      const volume = Number(savedVolume);
      if (Number.isInteger(volume) && volume >= 0 && volume <= 100) {
        volumeSlider.value = String(volume);
      }
    }
  } catch (error) {
    console.error('Unable to restore the rain volume setting from this device.', error);
  }
}

function saveRainVolume() {
  try {
    localStorage.setItem(volumeSlider.dataset.storageKey || 'glowflowSettings', volumeSlider.value);
  } catch (error) {
    console.error('Unable to save the rain volume setting on this device.', error);
  }
}

function insertJournalPrompt(prompt) {
  const currentNote = journalEntry.value.trimEnd();
  journalEntry.value = `${currentNote}${currentNote ? '\n\n' : ''}${prompt} `;
  journalEntry.focus();
  journalEntry.setSelectionRange(journalEntry.value.length, journalEntry.value.length);
  updateJournalStatus();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function updatePause(remaining) {
  timerText.textContent = formatTime(remaining);
  const progress = Math.min(100, ((pauseDuration - remaining) / pauseDuration) * 100);
  pauseProgress.style.width = `${progress}%`;
}

function startPause(seconds) {
  window.clearInterval(timerInterval);
  pauseDuration = seconds;
  pauseEndsAt = Date.now() + seconds * 1000;
  pauseStatus.textContent = seconds === 120 ? 'Your 2-minute pause is underway.' : 'Your pause is underway. Take it at your own pace.';
  updatePause(seconds);
  timerInterval = window.setInterval(() => {
    const remaining = Math.max(0, Math.ceil((pauseEndsAt - Date.now()) / 1000));
    updatePause(remaining);
    if (remaining === 0) {
      window.clearInterval(timerInterval);
      pauseStatus.textContent = 'Pause complete. Carry this softer feeling with you.';
      gameMessage.textContent = 'You made time for yourself. That is enough.';
    }
  }, 250);
}

function resetPause() {
  window.clearInterval(timerInterval);
  pauseDuration = 120;
  pauseStatus.textContent = 'Your pause is ready whenever you need it.';
  updatePause(pauseDuration);
  resetBubbles();
}

function setSoundStatus(message) {
  soundStatus.textContent = message;
  window.clearTimeout(soundStatusTimeout);
  if (message) {
    soundStatusTimeout = window.setTimeout(() => {
      soundStatus.textContent = '';
    }, 3500);
  }
}

function setRainVolume() {
  if (rainGain && audioContext) {
    rainGain.gain.setTargetAtTime(Number(volumeSlider.value) / 100 * 1.2, audioContext.currentTime, 0.05);
  }
}

async function enableRain() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Rain ambience is not supported in this browser.');

  audioContext = new AudioContextConstructor();
  await audioContext.resume();

  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, sampleRate * 3, sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * 0.32;
  }

  rainSource = audioContext.createBufferSource();
  rainSource.buffer = buffer;
  rainSource.loop = true;
  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 950;
  const highPass = audioContext.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 160;
  rainGain = audioContext.createGain();
  rainSource.connect(lowPass);
  lowPass.connect(highPass);
  highPass.connect(rainGain);
  rainGain.connect(audioContext.destination);
  setRainVolume();
  rainSource.start();
  soundToggle.textContent = 'Rain on';
  soundToggle.setAttribute('aria-pressed', 'true');
  setSoundStatus('Soft rain is on.');
}

async function disableRain() {
  if (rainSource) {
    rainSource.stop();
    rainSource.disconnect();
    rainSource = null;
  }
  const contextToClose = audioContext;
  audioContext = null;
  rainGain = null;
  if (contextToClose) await contextToClose.close();
  soundToggle.textContent = 'Rain off';
  soundToggle.setAttribute('aria-pressed', 'false');
  setSoundStatus('Rain ambience is off.');
}

soundToggle.addEventListener('click', async () => {
  soundToggle.disabled = true;
  try {
    if (soundToggle.getAttribute('aria-pressed') === 'true') {
      await disableRain();
    } else {
      await enableRain();
    }
  } catch (error) {
    console.error('Unable to change rain ambience.', error);
    if (audioContext) {
      await audioContext.close().catch((closeError) => {
        console.error('Unable to close the rain ambience audio context.', closeError);
      });
      audioContext = null;
      rainSource = null;
      rainGain = null;
    }
    soundToggle.textContent = 'Rain off';
    soundToggle.setAttribute('aria-pressed', 'false');
    setSoundStatus('Rain sound could not start. Your pause is still here.');
  } finally {
    soundToggle.disabled = false;
  }
});

volumeSlider.addEventListener('input', () => {
  setRainVolume();
  saveRainVolume();
});
document.querySelector('#resetButton').addEventListener('click', resetPause);
document.querySelector('#miniReset').addEventListener('click', () => {
  startPause(120);
  document.querySelector('#experience').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
document.querySelector('#startPause').addEventListener('click', () => {
  startPause(240);
  document.querySelector('#experience').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
document.querySelector('#closingReset').addEventListener('click', () => {
  startPause(120);
  document.querySelector('#experience').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
const intentionSuggestions = {
  joy: 'You do not need a special reason to enjoy something small. Put on a song you love, or remember one moment that made you smile.',
  focus: 'You do not have to solve the whole day. Name just the next small step, and let the rest wait for now.',
  creative: 'There is no need to make something good. Give yourself a minute to doodle, collect colors, or follow a small what-if.',
  calm: 'Let your shoulders soften. Feel the chair or floor holding you, and stay for one easy breath.',
  unsure: 'That is okay too. You do not need to know what you need. Let this moment be simple; one natural breath is enough.'
};
document.querySelectorAll('.intention-option').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.intention-option').forEach((option) => {
      option.setAttribute('aria-pressed', String(option === button));
    });
    const suggestion = intentionSuggestions[button.dataset.intention];
    if (!suggestion) {
      throw new Error(`No intention suggestion is configured for "${button.dataset.intention}".`);
    }
    intentionSuggestion.textContent = suggestion;
  });
});
document.querySelectorAll('.prompt-button').forEach((button) => {
  button.addEventListener('click', () => insertJournalPrompt(button.dataset.prompt));
});
journalEntry.addEventListener('input', updateJournalStatus);
document.querySelector('#clearJournal').addEventListener('click', () => {
  journalEntry.value = '';
  journalEntry.dispatchEvent(new Event('input', { bubbles: true }));
  try {
    localStorage.removeItem(journalEntry.dataset.storageKey || 'glowflowJournal');
    journalCount.textContent = '0 / 1000';
    journalStatus.textContent = 'Your note has been cleared from this device.';
  } catch (error) {
    console.error('Unable to clear the journal note from this device.', error);
    journalStatus.textContent = 'Your note could not be cleared from this device.';
  }
});

const kindnessIdeas = [
  'Unclench your jaw. Let your shoulders fall away from your ears.',
  'Take a sip of water and feel your feet resting on the ground.',
  'Look out a window and let your eyes rest on something far away.',
  'Stretch your hands open, then let them rest softly.',
  'Choose one small thing that can wait until later.',
  'Put on a song that feels like a warm cup of tea.',
  'Step into fresh air for one easy breath.',
  'Talk to yourself the way you would talk to someone you love.'
];
let lastKindnessIdea = 0;
document.querySelector('#kindnessButton').addEventListener('click', () => {
  let nextIdea = Math.floor(Math.random() * kindnessIdeas.length);
  if (kindnessIdeas.length > 1 && nextIdea === lastKindnessIdea) {
    nextIdea = (nextIdea + 1) % kindnessIdeas.length;
  }
  lastKindnessIdea = nextIdea;
  kindnessSuggestion.textContent = kindnessIdeas[nextIdea];
});

let breathingPhaseIndex = 0;
let breathingTimeout;
let breathingPhaseStartedAt = 0;
let breathingPhaseRemaining = breathingPhases[0].duration;
let breathingPaused = false;

function showBreathingPhase() {
  const phase = breathingPhases[breathingPhaseIndex];
  breathingPanel.classList.remove(...breathingPhases.map((item) => item.name));
  breathingPanel.classList.add(phase.name);
  document.querySelector('#phaseText').textContent = phase.label;
  document.querySelector('#phaseDescription').textContent = phase.description;
  breathingPhaseRemaining = phase.duration;
  scheduleBreathingPhase();
}

function scheduleBreathingPhase() {
  breathingPhaseStartedAt = Date.now();
  breathingTimeout = window.setTimeout(() => {
    breathingPhaseIndex = (breathingPhaseIndex + 1) % breathingPhases.length;
    showBreathingPhase();
  }, breathingPhaseRemaining);
}

breathingToggle.addEventListener('click', () => {
  breathingPaused = !breathingPaused;
  if (breathingPaused) {
    window.clearTimeout(breathingTimeout);
    breathingPhaseRemaining = Math.max(0, breathingPhaseRemaining - (Date.now() - breathingPhaseStartedAt));
    breathingPanel.classList.add('breathing-paused');
    breathingToggle.textContent = 'Resume guide';
    breathingToggle.setAttribute('aria-pressed', 'true');
    document.querySelector('#phaseDescription').textContent = 'Paused. Breathe at your own pace.';
    return;
  }

  breathingPanel.classList.remove('breathing-paused');
  breathingToggle.textContent = 'Pause guide';
  breathingToggle.setAttribute('aria-pressed', 'false');
  document.querySelector('#phaseDescription').textContent = breathingPhases[breathingPhaseIndex].description;
  scheduleBreathingPhase();
});

createBubbles();
updatePause(pauseDuration);
restoreJournal();
restoreRainVolume();
showBreathingPhase();
