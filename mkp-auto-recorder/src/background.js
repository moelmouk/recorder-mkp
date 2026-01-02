/**
 * MKP Auto Recorder - Background Service Worker
 * Based on UI Vision RPA architecture
 */

let currentScenario = {
  Name: 'Nouveau scénario',
  CreationDate: new Date().toISOString().split('T')[0],
  Commands: []
};

let isRecording = false;
let isPlaying = false;
let playbackState = {
  currentIndex: 0,
  status: 'idle', // idle, playing, paused, completed, error
  error: null
};

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received:', message.type);

  if (message.type === 'START_RECORDING') {
    handleStartRecording(sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
  } else if (message.type === 'STOP_RECORDING') {
    handleStopRecording(sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
  } else if (message.type === 'COMMAND_RECORDED') {
    currentScenario.Commands.push(message.command);
    sendResponse({ success: true });
  } else if (message.type === 'GET_SCENARIO') {
    sendResponse({ scenario: currentScenario });
  } else if (message.type === 'SET_SCENARIO') {
    currentScenario = message.scenario;
    sendResponse({ success: true });
  } else if (message.type === 'CLEAR_SCENARIO') {
    currentScenario = {
      Name: 'Nouveau scénario',
      CreationDate: new Date().toISOString().split('T')[0],
      Commands: []
    };
    sendResponse({ success: true });
  } else if (message.type === 'EXPORT_SCENARIO') {
    sendResponse({ scenario: currentScenario });
  } else if (message.type === 'PLAY_SCENARIO') {
    handlePlayScenario(message.tabId);
    sendResponse({ success: true });
  } else if (message.type === 'STOP_PLAYBACK') {
    isPlaying = false;
    playbackState.status = 'stopped';
    sendResponse({ success: true });
  } else if (message.type === 'GET_PLAYBACK_STATE') {
    sendResponse({ state: playbackState, isPlaying: isPlaying });
  }

  return true;
});

async function handleStartRecording(tabId) {
  isRecording = true;
  
  // Clear previous commands
  currentScenario.Commands = [];
  currentScenario.CreationDate = new Date().toISOString().split('T')[0];

  // Inject content script if needed
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content_script.js']
    });
  } catch (e) {
    console.log('Content script already injected');
  }

  // Start recording
  await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
  
  console.log('Recording started on tab', tabId);
}

async function handleStopRecording(tabId) {
  isRecording = false;

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'STOP_RECORDING' });
  } catch (e) {
    console.log('Error stopping recording:', e);
  }

  console.log('Recording stopped');
}

// Play scenario - runs in background so it persists even if popup closes
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
