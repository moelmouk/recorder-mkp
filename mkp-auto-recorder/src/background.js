/**
 * MKP Auto Recorder - Background Service Worker v2.1
 * With playback overlay, skip on error, and disabled commands support
 */

let currentScenario = {
  id: '',
  Name: 'Nouveau scénario',
  CreationDate: new Date().toISOString().split('T')[0],
  groupId: '',
  Commands: []
};

let isRecording = false;
let recordingTabId = null;
let lastCommandTime = null;

let isPlaying = false;
let playbackTabId = null;
let playbackState = {
  currentIndex: 0,
  scenarioIndex: 0,
  // Currently playing scenario id (for group playback UI highlight)
  scenarioId: null,
  status: 'idle',
  error: null,
  total: 0,
  errorIndexes: []
};

let eventLogs = [];
const MAX_EVENT_LOGS = 500;

// ========== STATE PERSISTENCE ==========

async function saveState() {
  await chrome.storage.local.set({
    mkpRecorderState: {
      isRecording,
      recordingTabId,
      currentScenario,
      isPlaying,
      playbackTabId,
      playbackState,
      lastCommandTime
    }
  });
}

async function saveLogs() {
  await chrome.storage.local.set({ mkpEventLogs: eventLogs });
}

function appendLog(entry) {
  const e = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    ts: Date.now(),
    level: entry && entry.level ? entry.level : 'info',
    category: entry && entry.category ? entry.category : 'general',
    action: entry && entry.action ? entry.action : '',
    message: entry && entry.message ? entry.message : '',
    data: entry && entry.data ? entry.data : null
  };
  eventLogs.push(e);
  if (eventLogs.length > MAX_EVENT_LOGS) {
    eventLogs = eventLogs.slice(eventLogs.length - MAX_EVENT_LOGS);
  }
  saveLogs().catch(() => {});
}

async function loadState() {
  const result = await chrome.storage.local.get(['mkpRecorderState', 'mkpEventLogs']);
  if (Array.isArray(result.mkpEventLogs)) {
    eventLogs = result.mkpEventLogs;
  }
  if (result.mkpRecorderState) {
    const state = result.mkpRecorderState;
    isRecording = state.isRecording || false;
    recordingTabId = state.recordingTabId || null;
    currentScenario = state.currentScenario || createEmptyScenario();
    isPlaying = state.isPlaying || false;
    playbackTabId = state.playbackTabId || null;
    playbackState = state.playbackState || { currentIndex: 0, scenarioIndex: 0, status: 'idle', error: null, total: 0, errorIndexes: [] };
    if (!Array.isArray(playbackState.errorIndexes)) playbackState.errorIndexes = [];
    lastCommandTime = state.lastCommandTime || null;
    
    updateBadge();
    
    if (isRecording && recordingTabId) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: recordingTabId },
          files: ['src/content_script.js']
        });
        await chrome.tabs.sendMessage(recordingTabId, { type: 'START_RECORDING' });
        await chrome.tabs.sendMessage(recordingTabId, { type: 'SHOW_RECORDING_INDICATOR' });
      } catch (e) {
        console.log('Could not restore recording on tab:', e);
      }
    }
  }
}

function createEmptyScenario() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    Name: 'Nouveau scénario',
    CreationDate: new Date().toISOString().split('T')[0],
    groupId: '',
    Commands: []
  };
}

function updateBadge() {
  if (isRecording) {
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } else if (isPlaying && playbackState.status === 'paused') {
    chrome.action.setBadgeText({ text: '⏸' });
    chrome.action.setBadgeBackgroundColor({ color: '#94a3b8' });
  } else if (isPlaying) {
    chrome.action.setBadgeText({ text: '▶' });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function notifyPlaybackUiState(status) {
  if (!playbackTabId) return;
  try {
    await chrome.tabs.sendMessage(playbackTabId, { type: 'SET_PLAYBACK_UI_STATE', status });
  } catch (e) {
    console.log('Error notifying playback UI state:', e);
  }
}

async function hidePlaybackOverlay() {
  if (!playbackTabId) return;
  try {
    await chrome.tabs.sendMessage(playbackTabId, { type: 'HIDE_PLAYBACK_OVERLAY' });
  } catch (e) {
    console.log('Error hiding playback overlay:', e);
  }
}

loadState();

// ========== MESSAGE LISTENER ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received:', message.type);

  switch (message.type) {
    case 'RELOAD_STATE':
      loadState().then(() => {
        sendResponse({ success: true });
      }).catch((e) => {
        sendResponse({ success: false, error: e && e.message ? e.message : 'Failed to reload state' });
      });
      return true;

    case 'START_RECORDING':
      appendLog({
        level: 'info',
        category: 'recording',
        action: 'start',
        message: 'Démarrage enregistrement',
        data: { tabId: message.tabId || (sender.tab ? sender.tab.id : null) }
      });
      handleStartRecording(message.tabId || (sender.tab ? sender.tab.id : null), { append: !!message.append });
      sendResponse({ success: true });
      break;

    case 'STOP_RECORDING':
      appendLog({
        level: 'info',
        category: 'recording',
        action: 'stop',
        message: 'Arrêt enregistrement',
        data: { tabId: message.tabId || (sender.tab ? sender.tab.id : null) }
      });
      handleStopRecording(message.tabId || (sender.tab ? sender.tab.id : null));
      sendResponse({ success: true });
      break;

    case 'COMMAND_RECORDED':
      const now = Date.now();
      const timing = lastCommandTime ? now - lastCommandTime : 0;
      lastCommandTime = now;
      
      const commandWithTiming = {
        ...message.command,
        timing: timing,
        timestamp: now,
        disabled: false
      };
      
      currentScenario.Commands.push(commandWithTiming);
      saveState();
      appendLog({
        level: 'info',
        category: 'recording',
        action: 'command_recorded',
        message: 'Action enregistrée',
        data: { command: commandWithTiming.Command, target: commandWithTiming.Target, timing: commandWithTiming.timing }
      });
      sendResponse({ success: true });
      break;

    case 'GET_SCENARIO':
      sendResponse({ scenario: currentScenario });
      break;

    case 'SET_SCENARIO':
      currentScenario = message.scenario;
      saveState();
      sendResponse({ success: true });
      break;

    case 'CLEAR_SCENARIO':
      currentScenario = createEmptyScenario();
      lastCommandTime = null;
      saveState();
      appendLog({ level: 'info', category: 'scenario', action: 'clear', message: 'Scénario effacé' });
      sendResponse({ success: true });
      break;

    case 'EXPORT_SCENARIO':
      sendResponse({ scenario: currentScenario });
      break;

    case 'PLAY_SCENARIO':
      appendLog({
        level: 'info',
        category: 'playback',
        action: 'play_scenario',
        message: 'Lecture scénario',
        data: { tabId: message.tabId, useRealTiming: message.useRealTiming !== false, playbackMode: message.playbackMode || 'RWRT' }
      });
      handlePlayScenario(message.tabId, message.useRealTiming !== false, message.playbackMode || 'RWRT');
      sendResponse({ success: true });
      break;

    case 'PLAY_GROUP':
      appendLog({
        level: 'info',
        category: 'playback',
        action: 'play_group',
        message: 'Lecture groupe',
        data: { tabId: message.tabId, count: Array.isArray(message.scenarios) ? message.scenarios.length : 0, useRealTiming: message.useRealTiming !== false, interScenarioDelayMs: Number(message.interScenarioDelayMs), playbackMode: message.playbackMode || 'RWRT' }
      });
      handlePlayGroup(
        message.scenarios,
        message.tabId,
        message.useRealTiming !== false,
        Number.isFinite(Number(message.interScenarioDelayMs)) ? Number(message.interScenarioDelayMs) : 500,
        message.playbackMode || 'RWRT'
      );
      sendResponse({ success: true });
      break;

    // RAC (Read All Commands) control from popup.js
    case 'RAC_START': {
      (async () => {
        try {
          playbackTabId = message.tabId || (sender && sender.tab && sender.tab.id) || playbackTabId;
          const total = Number.isFinite(message.total) ? message.total : (currentScenario?.Commands?.length || 0);
          isPlaying = true;
          playbackState.status = 'playing';
          playbackState.currentIndex = 0;
          playbackState.total = total;
          playbackState.error = null;
          playbackState.errorIndexes = [];
          updateBadge();
          try { await notifyPlaybackUiState('playing'); } catch (e) { console.log('Notify UI state error (RAC_START):', e); }
          try {
            if (playbackTabId) {
              await chrome.tabs.sendMessage(playbackTabId, { type: 'SHOW_PLAYBACK_OVERLAY' });
            }
          } catch (e) {
            console.log('Error showing playback overlay (RAC_START):', e);
          }
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: (e && e.message) ? e.message : 'RAC_START failed' });
        }
      })();
      return true;
    }

    case 'RAC_UPDATE': {
      (async () => {
        try {
          const current = Number.isFinite(message.current) ? message.current : playbackState.currentIndex;
          const total = Number.isFinite(message.total) ? message.total : playbackState.total;
          playbackState.currentIndex = current;
          playbackState.total = total;
          if (playbackTabId) {
            try {
              await chrome.tabs.sendMessage(playbackTabId, {
                type: 'UPDATE_PLAYBACK_OVERLAY',
                current: current,
                total: total,
                command: message.command || null,
                delay: Number.isFinite(message.delay) ? message.delay : 0
              });
            } catch (e) {
              console.log('Error updating overlay (RAC_UPDATE):', e);
            }
          }
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: (e && e.message) ? e.message : 'RAC_UPDATE failed' });
        }
      })();
      return true;
    }

    case 'RAC_END': {
      (async () => {
        try {
          isPlaying = false;
          playbackState.status = 'stopped';
          updateBadge();
          try { await notifyPlaybackUiState('stopped'); } catch (e) { console.log('Notify UI state error (RAC_END):', e); }
          try {
            if (playbackTabId) {
              await chrome.tabs.sendMessage(playbackTabId, { type: 'HIDE_PLAYBACK_OVERLAY' });
            }
          } catch (e) {
            console.log('Error hiding playback overlay (RAC_END):', e);
          }
          playbackTabId = null;
          saveState();
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: (e && e.message) ? e.message : 'RAC_END failed' });
        }
      })();
      return true;
    }

    case 'STOP_PLAYBACK':
      appendLog({ level: 'info', category: 'playback', action: 'stop', message: 'Arrêt lecture' });
      if (!playbackTabId && sender && sender.tab && sender.tab.id) {
        playbackTabId = sender.tab.id;
      }
      isPlaying = false;
      playbackState.status = 'stopped';
      playbackState.error = null;
      playbackState.currentIndex = 0;
      playbackState.scenarioIndex = 0;
      playbackState.scenarioId = null;
      playbackState.total = 0;
      playbackState.errorIndexes = [];
      updateBadge();
      notifyPlaybackUiState('stopped');
      hidePlaybackOverlay();
      playbackTabId = null;
      saveState();
      sendResponse({ success: true });
      break;

    case 'PAUSE_PLAYBACK':
      appendLog({ level: 'info', category: 'playback', action: 'pause', message: 'Pause lecture' });
      if (!playbackTabId && sender && sender.tab && sender.tab.id) {
        playbackTabId = sender.tab.id;
      }
      if (isPlaying) {
        playbackState.status = 'paused';
        updateBadge();
        saveState();
        notifyPlaybackUiState('paused');
      }
      sendResponse({ success: true });
      break;

    case 'RESUME_PLAYBACK':
      appendLog({ level: 'info', category: 'playback', action: 'resume', message: 'Reprise lecture' });
      if (!playbackTabId && sender && sender.tab && sender.tab.id) {
        playbackTabId = sender.tab.id;
      }
      if (isPlaying) {
        playbackState.status = 'playing';
        updateBadge();
        saveState();
        notifyPlaybackUiState('playing');
      }
      sendResponse({ success: true });
      break;

    case 'LOG_EVENT':
      appendLog({
        level: message.level || 'info',
        category: message.category || 'general',
        action: message.action || '',
        message: message.message || '',
        data: message.data || null
      });
      sendResponse({ success: true });
      break;

    case 'GET_LOGS':
      sendResponse({ logs: eventLogs });
      break;

    case 'CLEAR_LOGS':
      eventLogs = [];
      saveLogs().catch(() => {});
      sendResponse({ success: true });
      break;

    case 'GET_PLAYBACK_STATE':
      sendResponse({ state: playbackState, isPlaying: isPlaying });
      break;

    case 'GET_RECORDING_STATE':
      sendResponse({ 
        isRecording: isRecording, 
        recordingTabId: recordingTabId,
        commandCount: currentScenario.Commands.length
      });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

// ========== TAB EVENTS ==========

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (isRecording && tabId === recordingTabId && changeInfo.status === 'complete') {
    console.log('Tab updated while recording, re-injecting content script');
    
    try {
      await new Promise(r => setTimeout(r, 300));
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/content_script.js']
      });
      
      await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
      await chrome.tabs.sendMessage(tabId, { type: 'SHOW_RECORDING_INDICATOR' });
    } catch (e) {
      console.log('Error re-injecting on tab update:', e);
    }
  }

  if (isPlaying && tabId === playbackTabId && changeInfo.status === 'complete') {
    console.log('Tab updated while playing, re-injecting content script + overlay');
    try {
      await new Promise(r => setTimeout(r, 300));
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/content_script.js']
      });
      await chrome.tabs.sendMessage(tabId, { type: 'SHOW_PLAYBACK_OVERLAY' });
      await notifyPlaybackUiState(playbackState.status || 'playing');
    } catch (e) {
      console.log('Error re-injecting playback overlay on tab update:', e);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (isRecording && tabId === recordingTabId) {
    console.log('Recording tab closed, stopping recording');
    appendLog({ level: 'warn', category: 'recording', action: 'tab_closed', message: 'Onglet d’enregistrement fermé, arrêt automatique', data: { tabId } });
    isRecording = false;
    recordingTabId = null;
    updateBadge();
    saveState();
  }
});

// ========== RECORDING HANDLERS ==========

async function handleStartRecording(tabId, { append = false } = {}) {
  isRecording = true;
  recordingTabId = tabId;
  lastCommandTime = Date.now();

  if (!append) {
    currentScenario.Commands = [];
    currentScenario.CreationDate = new Date().toISOString().split('T')[0];
  }

  updateBadge();

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
  } catch (e) {
    console.log('Content script already injected or error:', e);
  }

  try {
    if (!append) {
      // Récupérer l'URL de l'onglet actuel
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.url) {
        // Ajouter la commande open avec l'URL de la page de démarrage
        const openCommand = {
          Command: 'open',
          Target: tab.url,
          Value: '',
          Description: 'Ouverture automatique de la page de démarrage',
          Targets: [],
          timing: 0,
          timestamp: Date.now(),
          disabled: false
        };
        currentScenario.Commands.push(openCommand);
        await saveState();
      }
    }

    await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_RECORDING_INDICATOR' });
  } catch (e) {
    console.log('Error sending start recording message:', e);
  }
  
  await saveState();
  console.log('Recording started on tab', tabId);
}

async function handleStopRecording(tabId) {
  isRecording = false;
  const previousTabId = recordingTabId;
  recordingTabId = null;
  lastCommandTime = null;

  updateBadge();

  try {
    const targetTabId = tabId || previousTabId;
    if (targetTabId) {
      await chrome.tabs.sendMessage(targetTabId, { type: 'STOP_RECORDING' });
      await chrome.tabs.sendMessage(targetTabId, { type: 'HIDE_RECORDING_INDICATOR' });
    }
  } catch (e) {
    console.log('Error stopping recording:', e);
  }

  await saveState();
  console.log('Recording stopped');
}

// ========== PLAYBACK HANDLERS ==========

async function handlePlayScenario(tabId, useRealTiming = true, playbackMode = 'RWRT') {
  if (isPlaying) {
    console.log('Already playing');
    return;
  }

  // Filter out disabled commands
  const activeCommands = currentScenario.Commands.filter(cmd => !cmd.disabled);

  if (!activeCommands || activeCommands.length === 0) {
    console.log('No active commands to play');
    playbackState.status = 'error';
    playbackState.error = 'Aucune commande active à jouer';
    appendLog({
      level: 'error',
      category: 'playback',
      action: 'play_scenario',
      message: 'Lecture impossible: aucune commande active',
      data: { tabId }
    });
    return;
  }

  isPlaying = true;
  playbackTabId = tabId;
  playbackState = {
    currentIndex: 0,
    scenarioIndex: 0,
    status: 'playing',
    error: null,
    total: activeCommands.length,
    errorIndexes: []
  };

  updateBadge();
  await saveState();

  // Show playback overlay
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_PLAYBACK_OVERLAY' });
  } catch (e) {
    console.log('Error showing playback overlay:', e);
  }

  const scenarioToPlay = { ...currentScenario, Commands: activeCommands };
  await executeScenario(scenarioToPlay, tabId, useRealTiming, playbackMode);

  // Hide playback overlay
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'HIDE_PLAYBACK_OVERLAY' });
  } catch (e) {
    console.log('Error hiding playback overlay:', e);
  }

  if (isPlaying && playbackState.status !== 'error') {
    playbackState.status = 'completed';
    console.log('Playback completed successfully');
  }

  if (playbackState.status === 'completed') {
    appendLog({ level: 'success', category: 'playback', action: 'completed', message: 'Lecture terminée' });
  } else if (playbackState.status === 'error') {
    appendLog({ level: 'error', category: 'playback', action: 'error', message: playbackState.error || 'Erreur lecture' });
  } else if (playbackState.status === 'stopped') {
    appendLog({ level: 'warn', category: 'playback', action: 'stopped', message: playbackState.error || 'Lecture arrêtée' });
  }
  
  isPlaying = false;
  playbackTabId = null;
  updateBadge();
  await saveState();
}

async function handlePlayGroup(scenarios, tabId, useRealTiming = true, interScenarioDelayMs = 500, playbackMode = 'RWRT') {
  if (isPlaying) {
    console.log('Already playing');
    return;
  }

  // Clamp and normalize inter-scenario delay
  if (!Number.isFinite(interScenarioDelayMs)) interScenarioDelayMs = 500;
  if (interScenarioDelayMs < 0) interScenarioDelayMs = 0;
  if (interScenarioDelayMs > 600000) interScenarioDelayMs = 600000;
  interScenarioDelayMs = Math.round(interScenarioDelayMs);

  if (!scenarios || scenarios.length === 0) {
    playbackState.status = 'error';
    playbackState.error = 'Aucun scénario à jouer';
    appendLog({ level: 'error', category: 'playback', action: 'play_group', message: 'Lecture groupe impossible: aucun scénario', data: { tabId } });
    return;
  }

  isPlaying = true;
  playbackTabId = tabId;
  playbackState = {
    currentIndex: 0,
    scenarioIndex: 0,
    scenarioId: null,
    status: 'playing',
    error: null,
    total: 0,
    errorIndexes: []
  };

  updateBadge();
  await saveState();

  console.log(`Starting group playback of ${scenarios.length} scenarios`);

  // Show playback overlay
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_PLAYBACK_OVERLAY' });
  } catch (e) {
    console.log('Error showing playback overlay:', e);
  }

  for (let i = 0; i < scenarios.length; i++) {
    if (!isPlaying) {
      console.log('Group playback stopped by user');
      playbackState.status = 'stopped';
      break;
    }

    const scenario = scenarios[i];
    // Filter disabled commands
    const activeCommands = scenario.Commands.filter(cmd => !cmd.disabled);
    
    if (activeCommands.length === 0) {
      console.log(`Skipping scenario ${i + 1} - no active commands`);
      continue;
    }

    playbackState.scenarioIndex = i;
    playbackState.total = activeCommands.length;
    playbackState.currentIndex = 0;
    playbackState.scenarioId = scenario.id;
    await saveState();

    console.log(`Playing scenario ${i + 1}/${scenarios.length}: ${scenario.Name}`);

    const scenarioToPlay = { ...scenario, Commands: activeCommands };
    const success = await executeScenario(scenarioToPlay, tabId, useRealTiming, playbackMode);
    
    if (!success && playbackState.status === 'stopped') {
      break;
    }

    if (i < scenarios.length - 1) {
      let remaining = interScenarioDelayMs;
      while (remaining > 0) {
        if (!isPlaying) break;
        if (playbackState.status === 'paused') {
          await new Promise(r => setTimeout(r, 200));
          continue;
        }
        const chunk = Math.min(remaining, 200);
        // Update overlay countdown (optional informational)
        try {
          if (playbackTabId) {
            await chrome.tabs.sendMessage(playbackTabId, {
              type: 'UPDATE_PLAYBACK_OVERLAY',
              current: playbackState.currentIndex,
              total: playbackState.total,
              command: null,
              delay: remaining
            });
          }
        } catch (e) {
          // ignore overlay errors
        }
        await new Promise(r => setTimeout(r, chunk));
        remaining -= chunk;
      }
    }
  }

  // Hide playback overlay
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'HIDE_PLAYBACK_OVERLAY' });
  } catch (e) {
    console.log('Error hiding playback overlay:', e);
  }

  if (isPlaying && playbackState.status !== 'error') {
    playbackState.status = 'completed';
    console.log('Group playback completed');
  }

  if (playbackState.status === 'completed') {
    appendLog({ level: 'success', category: 'playback', action: 'group_completed', message: 'Lecture groupe terminée' });
  } else if (playbackState.status === 'error') {
    appendLog({ level: 'error', category: 'playback', action: 'group_error', message: playbackState.error || 'Erreur lecture groupe' });
  } else if (playbackState.status === 'stopped') {
    appendLog({ level: 'warn', category: 'playback', action: 'group_stopped', message: playbackState.error || 'Lecture groupe arrêtée' });
  }

  isPlaying = false;
  playbackTabId = null;
  updateBadge();
  await saveState();
}

async function executeScenario(scenario, tabId, useRealTiming, playbackMode = 'RWRT') {
  const waitIfPaused = async () => {
    while (isPlaying && playbackState.status === 'paused') {
      await new Promise(r => setTimeout(r, 200));
    }
  };

  const controlledDelay = async (ms) => {
    let remaining = ms;
    while (remaining > 0) {
      if (!isPlaying) return false;
      if (playbackState.status === 'paused') {
        await waitIfPaused();
        continue;
      }
      const chunk = Math.min(remaining, 200);
      await new Promise(r => setTimeout(r, chunk));
      remaining -= chunk;
    }
    return true;
  };

  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
  } catch (e) {
    console.log('Content script already injected or error:', e);
  }

  for (let i = 0; i < scenario.Commands.length; i++) {
    if (!isPlaying) {
      console.log('Playback stopped by user');
      playbackState.status = 'stopped';
      return false;
    }

    await waitIfPaused();
    if (!isPlaying) {
      playbackState.status = 'stopped';
      return false;
    }

    const cmd = scenario.Commands[i];
    
    // Skip disabled commands (should already be filtered, but double check)
    if (cmd.disabled) {
      console.log(`Skipping disabled command ${i + 1}`);
      continue;
    }

    playbackState.currentIndex = i;
    await saveState();

    console.log(`Executing command ${i + 1}/${scenario.Commands.length}:`, cmd.Command, cmd.Target);

    // Update overlay
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'UPDATE_PLAYBACK_OVERLAY',
        current: i + 1,
        total: scenario.Commands.length,
        command: cmd,
        delay: useRealTiming && cmd.timing ? cmd.timing : 0
      });
    } catch (e) {
      console.log('Error updating overlay:', e);
    }

    // Apply real timing delay
    // In HYBRID mode, skip timing if command is tagged as RAC
    let shouldApplyTiming = useRealTiming && cmd.timing && cmd.timing > 0 && i > 0;
    if (shouldApplyTiming && playbackMode === 'HYBRID' && cmd.algoType === 'RAC') {
      console.log(`HYBRID mode: skipping timing for RAC command ${i + 1}`);
      shouldApplyTiming = false;
    }
    
    if (shouldApplyTiming) {
      const delay = Math.min(cmd.timing, 10000);
      const modeInfo = playbackMode === 'HYBRID' ? ` (HYBRID-RWRT)` : '';
      console.log(`Waiting ${delay}ms (real timing${modeInfo})`);
      const ok = await controlledDelay(delay);
      if (!ok) {
        playbackState.status = 'stopped';
        return false;
      }
    }

    let retryCommand = true;
    while (retryCommand) {
      retryCommand = false;

      try {
        await waitIfPaused();
        if (!isPlaying) {
          playbackState.status = 'stopped';
          return false;
        }
        // Handle 'open' command
        if (cmd.Command && cmd.Command.toLowerCase() === 'open') {
          const url = cmd.Target;
          if (url) {
            console.log('Navigating to:', url);
            await chrome.tabs.update(tabId, { url: url });
            await waitForPageLoad(tabId);
            
            const ok = await controlledDelay(500);
            if (!ok) {
              playbackState.status = 'stopped';
              return false;
            }
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['src/content_script.js']
              });
              await chrome.tabs.sendMessage(tabId, { type: 'SHOW_PLAYBACK_OVERLAY' });
            } catch (e) {
              console.log('Content script injection after navigation:', e);
            }
          }
          continue;
        }

        // Handle 'pause' command
        if (cmd.Command && cmd.Command.toLowerCase() === 'pause') {
          const pauseTime = parseInt(cmd.Target) || parseInt(cmd.Value) || 1000;
          console.log(`Pausing for ${pauseTime}ms`);
          const ok = await controlledDelay(pauseTime);
          if (!ok) {
            playbackState.status = 'stopped';
            return false;
          }
          continue;
        }

        // Execute other commands via content script
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'EXECUTE_COMMAND',
          command: cmd
        });

        if (response && !response.success) {
          throw new Error(response.error || 'Command failed');
        }

        if (Array.isArray(playbackState.errorIndexes) && playbackState.errorIndexes.includes(i)) {
          playbackState.errorIndexes = playbackState.errorIndexes.filter(x => x !== i);
          await saveState();
        }

        console.log(`Command ${i + 1} completed successfully`);

      } catch (error) {
        console.error(`Error executing command ${i + 1}:`, error);

        if (!Array.isArray(playbackState.errorIndexes)) playbackState.errorIndexes = [];
        if (!playbackState.errorIndexes.includes(i)) {
          playbackState.errorIndexes.push(i);
          await saveState();
        }

        appendLog({
          level: 'error',
          category: 'playback',
          action: 'step_error',
          message: `Étape ${i + 1} échouée`,
          data: { index: i, command: cmd.Command, target: cmd.Target, error: error.message || String(error) }
        });

        // Show error and wait for user action
        try {
          const actionResponse = await chrome.tabs.sendMessage(tabId, {
            type: 'SHOW_PLAYBACK_ERROR',
            error: `Étape ${i + 1} échouée: ${error.message || error}`
          });

          const action = actionResponse.action;
          console.log('User action:', action);

          if (action === 'skip') {
            // Skip this command, continue with next
            console.log('User chose to skip');
            playbackState.status = 'playing';
            appendLog({ level: 'warn', category: 'playback', action: 'skip_step', message: `Étape ${i + 1} ignorée`, data: { index: i } });
            await chrome.tabs.sendMessage(tabId, { type: 'HIDE_PLAYBACK_ERROR' });
            break; // Exit retry loop, continue to next command
          } else if (action === 'retry') {
            // Retry this command
            console.log('User chose to retry');
            retryCommand = true;
            appendLog({ level: 'info', category: 'playback', action: 'retry_step', message: `Retry étape ${i + 1}`, data: { index: i } });
            await chrome.tabs.sendMessage(tabId, { type: 'HIDE_PLAYBACK_ERROR' });
          } else if (action === 'stop') {
            // Stop playback
            console.log('User chose to stop');
            playbackState.status = 'stopped';
            playbackState.error = `Arrêté à l'étape ${i + 1}`;
            appendLog({ level: 'warn', category: 'playback', action: 'stop_on_error', message: playbackState.error, data: { index: i } });
            isPlaying = false;
            updateBadge();
            await notifyPlaybackUiState('stopped');
            await hidePlaybackOverlay();
            playbackTabId = null;
            await saveState();
            return false;
          }
        } catch (e) {
          // If can't communicate with content script, stop
          console.error('Error showing error dialog:', e);
          playbackState.status = 'error';
          playbackState.error = `Étape ${i + 1} échouée: ${error.message || error}`;
          appendLog({ level: 'error', category: 'playback', action: 'error_dialog_failed', message: playbackState.error, data: { index: i } });
          isPlaying = false;
          updateBadge();
          await saveState();
          return false;
        }
      }
    }

    // Minimum delay between commands
    if (!useRealTiming || !cmd.timing) {
      const ok = await controlledDelay(200);
      if (!ok) {
        playbackState.status = 'stopped';
        return false;
      }
    }
  }

  return true;
}

function waitForPageLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);
  });
}

console.log('MKP Auto Recorder background v2.1 loaded');
