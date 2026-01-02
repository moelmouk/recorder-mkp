/**
 * MKP Auto Recorder - Background Service Worker
 * Based on UI Vision RPA architecture
 */

// State persistence
let state = {
  isRecording: false,
  isPlaying: false,
  currentTabId: null,
  scenarios: [], // List of saved scenarios
  currentScenario: {
    Name: 'Nouveau scénario',
    CreationDate: new Date().toISOString().split('T')[0],
    Commands: []
  },
  playback: {
    currentIndex: 0,
    status: 'idle', // idle, playing, paused, completed, error
    error: null,
    total: 0
  }
};

// Load state from storage on startup
chrome.storage.local.get(['mkpState'], (result) => {
  if (result.mkpState) {
    state = { ...state, ...result.mkpState };
    state.isPlaying = false; // Reset playing state on reload
    state.playback.status = 'idle';
    updateBadge();
  }
  console.log('MKP State loaded:', state);
});

// Save state to storage
function saveState() {
  chrome.storage.local.set({ mkpState: state });
}

// Update badge based on state
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
  console.log('Background received:', message.type);

  switch (message.type) {
    case 'GET_STATE':
      sendResponse({ state: state });
      break;

    case 'START_RECORDING':
      handleStartRecording(message.tabId || (sender.tab ? sender.tab.id : null));
      sendResponse({ success: true });
      break;

    case 'STOP_RECORDING':
      handleStopRecording(message.tabId || (sender.tab ? sender.tab.id : null));
      sendResponse({ success: true });
      break;

    case 'COMMAND_RECORDED':
      state.currentScenario.Commands.push(message.command);
      saveState();
      sendResponse({ success: true });
      break;

    case 'GET_SCENARIO':
      sendResponse({ scenario: state.currentScenario });
      break;

    case 'SET_SCENARIO':
      state.currentScenario = message.scenario;
      saveState();
      sendResponse({ success: true });
      break;

    case 'NEW_SCENARIO':
      state.currentScenario = {
        Name: message.name || 'Nouveau scénario',
        CreationDate: new Date().toISOString().split('T')[0],
        Commands: []
      };
      saveState();
      sendResponse({ success: true });
      break;

    case 'CLEAR_SCENARIO':
      state.currentScenario.Commands = [];
      saveState();
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
      saveState();
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

async function handleStartRecording(tabId) {
  // Reset current scenario
  state.currentScenario = {
    Name: state.currentScenario.Name || 'Nouveau scénario',
    CreationDate: new Date().toISOString().split('T')[0],
    Commands: []
  };
  
  state.isRecording = true;
  state.currentTabId = tabId;
  updateBadge();
  saveState();

  // Inject content script if needed
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
  } catch (e) {
    console.log('Content script already injected or error:', e);
  }

  // Start recording in content script
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
  } catch (e) {
    console.log('Error sending START_RECORDING:', e);
  }
  
  console.log('Recording started on tab', tabId);
}

async function handleStopRecording(tabId) {
  state.isRecording = false;
  state.currentTabId = null;
  updateBadge();
  saveState();

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'STOP_RECORDING' });
  } catch (e) {
    console.log('Error stopping recording:', e);
  }

  console.log('Recording stopped, commands:', state.currentScenario.Commands.length);
}

function handleSaveScenario(name) {
  const scenarioToSave = {
    ...state.currentScenario,
    Name: name || state.currentScenario.Name,
    SavedDate: new Date().toISOString()
  };
  
  // Check if scenario with same name exists
  const existingIndex = state.scenarios.findIndex(s => s.Name === scenarioToSave.Name);
  if (existingIndex >= 0) {
    state.scenarios[existingIndex] = scenarioToSave;
  } else {
    state.scenarios.push(scenarioToSave);
  }
  
  saveState();
  console.log('Scenario saved:', scenarioToSave.Name);
}

function handleLoadScenario(index) {
  if (index >= 0 && index < state.scenarios.length) {
    state.currentScenario = { ...state.scenarios[index] };
    saveState();
    console.log('Scenario loaded:', state.currentScenario.Name);
  }
}

function handleDeleteScenario(index) {
  if (index >= 0 && index < state.scenarios.length) {
    const deleted = state.scenarios.splice(index, 1);
    saveState();
    console.log('Scenario deleted:', deleted[0]?.Name);
  }
}

// Play scenario - runs in background so it persists even if popup closes
async function handlePlayScenario(tabId) {
  if (state.isPlaying) {
    console.log('Already playing');
    return;
  }

  if (!state.currentScenario.Commands || state.currentScenario.Commands.length === 0) {
    console.log('No commands to play');
    state.playback.status = 'error';
    state.playback.error = 'Aucune commande à jouer';
    return;
  }

  // Reset playback state completely
  state.isPlaying = true;
  state.playback = {
    currentIndex: 0,
    status: 'playing',
    error: null,
    total: state.currentScenario.Commands.length
  };
  updateBadge();
  saveState();

  console.log('Starting playback of', state.currentScenario.Commands.length, 'commands');

  // Inject content script if needed
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
  } catch (e) {
    console.log('Content script already injected or error:', e);
  }

  // Small delay before starting
  await new Promise(r => setTimeout(r, 300));

  // Execute commands sequentially - ALWAYS start from 0
  for (let i = 0; i < state.currentScenario.Commands.length; i++) {
    if (!state.isPlaying) {
      console.log('Playback stopped by user');
      state.playback.status = 'stopped';
      break;
    }

    const cmd = state.currentScenario.Commands[i];
    state.playback.currentIndex = i;
    saveState();
    
    console.log(`Executing command ${i + 1}/${state.currentScenario.Commands.length}:`, cmd.Command, cmd.Target);

    try {
      // Handle 'open' command - navigate to URL
      if (cmd.Command && cmd.Command.toLowerCase() === 'open') {
        const url = cmd.Target;
        if (url) {
          console.log('Navigating to:', url);
          await chrome.tabs.update(tabId, { url: url });
          
          // Wait for page to load
          await waitForPageLoad(tabId);
          
          // Re-inject content script after navigation
          await new Promise(r => setTimeout(r, 1000));
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['src/content_script.js']
            });
          } catch (e) {
            console.log('Content script injection after navigation:', e);
          }
          await new Promise(r => setTimeout(r, 500));
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

      console.log(`Command ${i + 1} completed successfully`);

    } catch (error) {
      console.error(`Error executing command ${i + 1}:`, error);
      state.playback.status = 'error';
      state.playback.error = `Commande ${i + 1} échouée: ${error.message || error}`;
      state.isPlaying = false;
      updateBadge();
      saveState();
      break;
    }

    // Wait between commands
    await new Promise(r => setTimeout(r, 500));
  }

  if (state.isPlaying) {
    state.playback.status = 'completed';
    console.log('Playback completed successfully');
  }
  
  state.isPlaying = false;
  updateBadge();
  saveState();
}

// Wait for page to fully load
function waitForPageLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);
  });
}

console.log('MKP Auto Recorder background loaded');
