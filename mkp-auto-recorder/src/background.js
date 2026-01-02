/**
 * MKP Auto Recorder - Background Service Worker
 * Fixed: proper scenario isolation and state management
 */

// Default empty scenario
const createEmptyScenario = (name = 'Nouveau scénario') => ({
  Name: name,
  CreationDate: new Date().toISOString().split('T')[0],
  Commands: []
});

// State - completely isolated
let state = {
  isRecording: false,
  isPlaying: false,
  currentTabId: null,
  scenarios: [],
  currentScenario: createEmptyScenario(),
  playback: {
    currentIndex: 0,
    status: 'idle',
    error: null,
    total: 0
  }
};

// Load state from storage on startup
chrome.storage.local.get(['mkpScenarios'], (result) => {
  if (result.mkpScenarios) {
    state.scenarios = result.mkpScenarios;
  }
  // Always start with empty current scenario
  state.currentScenario = createEmptyScenario();
  state.isRecording = false;
  state.isPlaying = false;
  updateBadge();
  console.log('MKP State loaded, scenarios:', state.scenarios.length);
});

// Save only scenarios list to storage (not current scenario to avoid mixing)
function saveScenarios() {
  chrome.storage.local.set({ mkpScenarios: state.scenarios });
}

// Update badge
function updateBadge() {
  if (state.isRecording) {
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
  } else if (state.isPlaying) {
    chrome.action.setBadgeText({ text: '▶' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('BG received:', message.type);

  switch (message.type) {
    case 'GET_STATE':
      sendResponse({ 
        state: {
          isRecording: state.isRecording,
          isPlaying: state.isPlaying,
          currentScenario: state.currentScenario,
          scenarios: state.scenarios,
          playback: state.playback
        }
      });
      break;

    case 'START_RECORDING':
      handleStartRecording(message.tabId || (sender.tab ? sender.tab.id : null), message.scenarioName);
      sendResponse({ success: true });
      break;

    case 'STOP_RECORDING':
      handleStopRecording(message.tabId || (sender.tab ? sender.tab.id : null));
      sendResponse({ success: true });
      break;

    case 'COMMAND_RECORDED':
      // Only add if recording is active
      if (state.isRecording) {
        state.currentScenario.Commands.push(message.command);
        console.log('Command added, total:', state.currentScenario.Commands.length);
      }
      sendResponse({ success: true });
      break;

    case 'GET_SCENARIO':
      sendResponse({ scenario: state.currentScenario });
      break;

    case 'SET_SCENARIO':
      // COMPLETELY REPLACE current scenario
      state.currentScenario = {
        Name: message.scenario.Name || 'Scénario importé',
        CreationDate: message.scenario.CreationDate || new Date().toISOString().split('T')[0],
        Commands: [...(message.scenario.Commands || [])] // Deep copy
      };
      console.log('Scenario SET, commands:', state.currentScenario.Commands.length);
      sendResponse({ success: true });
      break;

    case 'NEW_SCENARIO':
      // COMPLETELY RESET to empty
      state.currentScenario = createEmptyScenario(message.name || 'Nouveau scénario');
      console.log('NEW scenario created, commands:', state.currentScenario.Commands.length);
      sendResponse({ success: true });
      break;

    case 'CLEAR_COMMANDS':
      // Clear only commands, keep name
      state.currentScenario.Commands = [];
      console.log('Commands CLEARED');
      sendResponse({ success: true });
      break;

    case 'SAVE_SCENARIO':
      handleSaveScenario(message.name);
      sendResponse({ success: true, scenarios: state.scenarios });
      break;

    case 'GET_SCENARIOS':
      sendResponse({ scenarios: state.scenarios });
      break;

    case 'LOAD_SCENARIO':
      handleLoadScenario(message.index);
      sendResponse({ success: true, scenario: state.currentScenario });
      break;

    case 'DELETE_SCENARIO':
      handleDeleteScenario(message.index);
      sendResponse({ success: true, scenarios: state.scenarios });
      break;

    case 'PLAY_SCENARIO':
      handlePlayScenario(message.tabId);
      sendResponse({ success: true });
      break;

    case 'STOP_PLAYBACK':
      state.isPlaying = false;
      state.playback.status = 'stopped';
      updateBadge();
      sendResponse({ success: true });
      break;

    case 'GET_PLAYBACK_STATE':
      sendResponse({ state: state.playback, isPlaying: state.isPlaying });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

async function handleStartRecording(tabId, scenarioName) {
  // COMPLETELY RESET current scenario before recording
  state.currentScenario = createEmptyScenario(scenarioName || 'Nouveau scénario');
  
  state.isRecording = true;
  state.currentTabId = tabId;
  updateBadge();

  console.log('Starting recording, scenario reset to 0 commands');

  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
  } catch (e) {
    console.log('Content script inject:', e.message);
  }

  // Tell content script to start (with reset)
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
  } catch (e) {
    console.log('Start recording message:', e.message);
  }
}

async function handleStopRecording(tabId) {
  state.isRecording = false;
  state.currentTabId = null;
  updateBadge();

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'STOP_RECORDING' });
  } catch (e) {
    console.log('Stop recording message:', e.message);
  }

  console.log('Recording stopped, total commands:', state.currentScenario.Commands.length);
}

function handleSaveScenario(name) {
  if (!state.currentScenario.Commands || state.currentScenario.Commands.length === 0) {
    console.log('Cannot save empty scenario');
    return;
  }

  const scenarioToSave = {
    Name: name || state.currentScenario.Name,
    CreationDate: state.currentScenario.CreationDate,
    SavedDate: new Date().toISOString(),
    Commands: [...state.currentScenario.Commands] // Deep copy
  };
  
  // Check if exists
  const existingIndex = state.scenarios.findIndex(s => s.Name === scenarioToSave.Name);
  if (existingIndex >= 0) {
    state.scenarios[existingIndex] = scenarioToSave;
  } else {
    state.scenarios.push(scenarioToSave);
  }
  
  saveScenarios();
  console.log('Scenario saved:', scenarioToSave.Name, 'commands:', scenarioToSave.Commands.length);
}

function handleLoadScenario(index) {
  if (index >= 0 && index < state.scenarios.length) {
    const loaded = state.scenarios[index];
    // Deep copy to avoid reference issues
    state.currentScenario = {
      Name: loaded.Name,
      CreationDate: loaded.CreationDate,
      Commands: [...loaded.Commands]
    };
    console.log('Scenario loaded:', state.currentScenario.Name, 'commands:', state.currentScenario.Commands.length);
  }
}

function handleDeleteScenario(index) {
  if (index >= 0 && index < state.scenarios.length) {
    const deleted = state.scenarios.splice(index, 1);
    saveScenarios();
    console.log('Scenario deleted:', deleted[0]?.Name);
  }
}

async function handlePlayScenario(tabId) {
  if (state.isPlaying) return;

  if (!state.currentScenario.Commands || state.currentScenario.Commands.length === 0) {
    state.playback = { currentIndex: 0, status: 'error', error: 'Aucune commande', total: 0 };
    return;
  }

  state.isPlaying = true;
  state.playback = {
    currentIndex: 0,
    status: 'playing',
    error: null,
    total: state.currentScenario.Commands.length
  };
  updateBadge();

  console.log('Starting playback:', state.currentScenario.Commands.length, 'commands');

  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
  } catch (e) {}

  await new Promise(r => setTimeout(r, 300));

  for (let i = 0; i < state.currentScenario.Commands.length; i++) {
    if (!state.isPlaying) {
      state.playback.status = 'stopped';
      break;
    }

    const cmd = state.currentScenario.Commands[i];
    state.playback.currentIndex = i;
    
    console.log(`Executing ${i + 1}/${state.currentScenario.Commands.length}:`, cmd.Command);

    try {
      if (cmd.Command && cmd.Command.toLowerCase() === 'open') {
        if (cmd.Target) {
          await chrome.tabs.update(tabId, { url: cmd.Target });
          await waitForPageLoad(tabId);
          await new Promise(r => setTimeout(r, 1000));
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['src/content_script.js']
            });
          } catch (e) {}
          await new Promise(r => setTimeout(r, 500));
        }
        continue;
      }

      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'EXECUTE_COMMAND',
        command: cmd
      });

      if (response && !response.success) {
        throw new Error(response.error || 'Command failed');
      }

    } catch (error) {
      console.error(`Command ${i + 1} failed:`, error);
      state.playback.status = 'error';
      state.playback.error = `Commande ${i + 1}: ${error.message || error}`;
      state.isPlaying = false;
      updateBadge();
      break;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  if (state.isPlaying) {
    state.playback.status = 'completed';
    console.log('Playback completed');
  }
  
  state.isPlaying = false;
  updateBadge();
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

console.log('MKP Auto Recorder background loaded');
