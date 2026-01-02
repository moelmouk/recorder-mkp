/**
 * MKP Auto Recorder - Background Service Worker
 * Based on UI Vision RPA architecture
 * With persistent recording state
 */

let currentScenario = {
  Name: 'Nouveau scénario',
  CreationDate: new Date().toISOString().split('T')[0],
  Commands: []
};

let isRecording = false;
let recordingTabId = null;
let isPlaying = false;
let playbackState = {
  currentIndex: 0,
  status: 'idle', // idle, playing, paused, completed, error
  error: null
};

// ========== STATE PERSISTENCE ==========

// Save state to storage
async function saveState() {
  await chrome.storage.local.set({
    mkpRecorderState: {
      isRecording,
      recordingTabId,
      currentScenario,
      isPlaying,
      playbackState
    }
  });
}

// Load state from storage
async function loadState() {
  const result = await chrome.storage.local.get('mkpRecorderState');
  if (result.mkpRecorderState) {
    const state = result.mkpRecorderState;
    isRecording = state.isRecording || false;
    recordingTabId = state.recordingTabId || null;
    currentScenario = state.currentScenario || {
      Name: 'Nouveau scénario',
      CreationDate: new Date().toISOString().split('T')[0],
      Commands: []
    };
    isPlaying = state.isPlaying || false;
    playbackState = state.playbackState || { currentIndex: 0, status: 'idle', error: null };
    
    // Update badge if recording
    updateBadge();
    
    // Re-inject content script if recording was active
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

// Update extension badge
function updateBadge() {
  if (isRecording) {
    chrome.action.setBadgeText({ text: 'REC' });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
  } else if (isPlaying) {
    chrome.action.setBadgeText({ text: '▶' });
    chrome.action.setBadgeBackgroundColor({ color: '#2196F3' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Initialize state on service worker start
loadState();

// ========== MESSAGE LISTENER ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received:', message.type);

  if (message.type === 'START_RECORDING') {
    handleStartRecording(message.tabId || (sender.tab ? sender.tab.id : null));
    sendResponse({ success: true });
  } else if (message.type === 'STOP_RECORDING') {
    handleStopRecording(message.tabId || (sender.tab ? sender.tab.id : null));
    sendResponse({ success: true });
  } else if (message.type === 'COMMAND_RECORDED') {
    currentScenario.Commands.push(message.command);
    saveState();
    sendResponse({ success: true });
  } else if (message.type === 'GET_SCENARIO') {
    sendResponse({ scenario: currentScenario });
  } else if (message.type === 'SET_SCENARIO') {
    currentScenario = message.scenario;
    saveState();
    sendResponse({ success: true });
  } else if (message.type === 'CLEAR_SCENARIO') {
    currentScenario = {
      Name: 'Nouveau scénario',
      CreationDate: new Date().toISOString().split('T')[0],
      Commands: []
    };
    saveState();
    sendResponse({ success: true });
  } else if (message.type === 'EXPORT_SCENARIO') {
    sendResponse({ scenario: currentScenario });
  } else if (message.type === 'PLAY_SCENARIO') {
    handlePlayScenario(message.tabId);
    sendResponse({ success: true });
  } else if (message.type === 'STOP_PLAYBACK') {
    isPlaying = false;
    playbackState.status = 'stopped';
    updateBadge();
    saveState();
    sendResponse({ success: true });
  } else if (message.type === 'GET_PLAYBACK_STATE') {
    sendResponse({ state: playbackState, isPlaying: isPlaying });
  } else if (message.type === 'GET_RECORDING_STATE') {
    sendResponse({ 
      isRecording: isRecording, 
      recordingTabId: recordingTabId,
      commandCount: currentScenario.Commands.length
    });
  }

  return true;
});

// ========== TAB EVENTS ==========

// Listen for tab updates to re-inject content script when navigating
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (isRecording && tabId === recordingTabId && changeInfo.status === 'complete') {
    console.log('Tab updated while recording, re-injecting content script');
    
    try {
      // Small delay to ensure page is ready
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
});

// Listen for tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (isRecording && tabId === recordingTabId) {
    console.log('Recording tab closed, stopping recording');
    isRecording = false;
    recordingTabId = null;
    updateBadge();
    saveState();
  }
});

// ========== RECORDING HANDLERS ==========

async function handleStartRecording(tabId) {
  isRecording = true;
  recordingTabId = tabId;
  
  // Clear previous commands
  currentScenario.Commands = [];
  currentScenario.CreationDate = new Date().toISOString().split('T')[0];

  // Update badge
  updateBadge();

  // Inject content script if needed
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
  } catch (e) {
    console.log('Content script already injected or error:', e);
  }

  // Start recording and show indicator
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_RECORDING_INDICATOR' });
  } catch (e) {
    console.log('Error sending start recording message:', e);
  }
  
  // Save state
  await saveState();
  
  console.log('Recording started on tab', tabId);
}

async function handleStopRecording(tabId) {
  isRecording = false;
  const previousTabId = recordingTabId;
  recordingTabId = null;

  // Update badge
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

  // Save state
  await saveState();

  console.log('Recording stopped');
}

// ========== PLAYBACK HANDLERS ==========

async function handlePlayScenario(tabId) {
  if (isPlaying) {
    console.log('Already playing');
    return;
  }

  if (!currentScenario.Commands || currentScenario.Commands.length === 0) {
    console.log('No commands to play');
    playbackState.status = 'error';
    playbackState.error = 'Aucune commande à jouer';
    return;
  }

  isPlaying = true;
  playbackState = {
    currentIndex: 0,
    status: 'playing',
    error: null,
    total: currentScenario.Commands.length
  };

  updateBadge();
  await saveState();

  console.log('Starting playback of', currentScenario.Commands.length, 'commands');

  // Inject content script if needed
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
  } catch (e) {
    console.log('Content script already injected or error:', e);
  }

  // Execute commands sequentially
  for (let i = 0; i < currentScenario.Commands.length; i++) {
    if (!isPlaying) {
      console.log('Playback stopped by user');
      playbackState.status = 'stopped';
      break;
    }

    const cmd = currentScenario.Commands[i];
    playbackState.currentIndex = i;
    await saveState();
    
    console.log(`Executing command ${i + 1}/${currentScenario.Commands.length}:`, cmd.Command, cmd.Target);

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
          await new Promise(r => setTimeout(r, 500));
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['src/content_script.js']
            });
          } catch (e) {
            console.log('Content script injection after navigation:', e);
          }
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
      playbackState.status = 'error';
      playbackState.error = `Commande ${i + 1} échouée: ${error.message || error}`;
      isPlaying = false;
      updateBadge();
      await saveState();
      break;
    }

    // Wait between commands (like UI Vision)
    await new Promise(r => setTimeout(r, 300));
  }

  if (isPlaying) {
    playbackState.status = 'completed';
    console.log('Playback completed successfully');
  }
  
  isPlaying = false;
  updateBadge();
  await saveState();
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
