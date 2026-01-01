/**
 * MKP Recorder - Background Service Worker
 * Basé sur le code de UI.Vision RPA
 */

// État global de l'extension
const state = {
  status: 'NORMAL', // NORMAL, RECORDING, PLAYING
  tabIds: {
    panel: null,
    toRecord: null,
    toPlay: null
  },
  currentMacro: null,
  playingIndex: -1
};

// Initialisation
chrome.runtime.onInstalled.addListener(() => {
  console.log('MKP Recorder installé');
});

// Clic sur l'icône de l'extension
chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});

// Communication avec les content scripts et le dashboard
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('BG received:', message.type, message);
  
  handleMessage(message, sender)
    .then(response => {
      sendResponse(response);
    })
    .catch(error => {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    });
  
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  const { type, data } = message;
  
  switch (type) {
    // Dashboard messages
    case 'DASHBOARD_INIT':
      state.tabIds.panel = sender.tab?.id || 'options';
      return { status: state.status };
    
    case 'START_RECORDING':
      return await startRecording();
    
    case 'STOP_RECORDING':
      return await stopRecording();
    
    case 'START_PLAYING':
      state.status = 'PLAYING';
      updateBadge('P', '#66bb6a');
      return { success: true };
    
    case 'STOP_PLAYING':
      state.status = 'NORMAL';
      state.playingIndex = -1;
      updateBadge('', '');
      return { success: true };
    
    case 'GET_STATE':
      return { state };
    
    // Content script messages
    case 'CS_RECORD_COMMAND':
      if (state.status === 'RECORDING') {
        // Forward to dashboard
        sendToDashboard('RECORD_ADD_COMMAND', data);
        return { success: true };
      }
      return { success: false };
    
    case 'CS_READY':
      // Content script is ready
      return { status: state.status };
    
    case 'RUN_COMMAND':
      return await runCommandInTab(data.tabId, data.command);
    
    case 'HIGHLIGHT_ELEMENT':
      return await highlightElementInTab(data);
    
    case 'GET_ACTIVE_TAB':
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return { tab: activeTab };
      
    default:
      console.log('Unknown message type:', type);
      return { error: 'Unknown message type' };
  }
}

async function startRecording() {
  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { error: 'Cannot record on this page' };
    }
    
    state.status = 'RECORDING';
    state.tabIds.toRecord = tab.id;
    
    // Notify content script to start recording
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'SET_STATUS',
        data: { status: 'RECORDING' }
      });
    } catch (e) {
      console.log('Content script not ready, injecting...');
    }
    
    updateBadge('R', '#ef5350');
    
    // Send open command to dashboard
    sendToDashboard('RECORD_ADD_COMMAND', {
      cmd: 'open',
      target: tab.url,
      value: ''
    });
    
    return { success: true, tabId: tab.id };
  } catch (error) {
    console.error('Error starting recording:', error);
    return { error: error.message };
  }
}

async function stopRecording() {
  if (state.tabIds.toRecord) {
    try {
      await chrome.tabs.sendMessage(state.tabIds.toRecord, {
        type: 'SET_STATUS',
        data: { status: 'NORMAL' }
      });
    } catch (e) {
      // Tab might be closed
    }
  }
  
  state.status = 'NORMAL';
  state.tabIds.toRecord = null;
  updateBadge('', '');
  
  return { success: true };
}

async function runCommandInTab(tabId, command) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'RUN_COMMAND',
      data: command
    });
    return response;
  } catch (error) {
    return { error: error.message };
  }
}

async function highlightElementInTab(data) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'HIGHLIGHT_ELEMENT',
        data: { locator: data.locator }
      });
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

function sendToDashboard(type, data) {
  chrome.runtime.sendMessage({ type, data }).catch(() => {
    // Dashboard might not be open
  });
}

function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) {
    chrome.action.setBadgeBackgroundColor({ color });
  }
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (state.status === 'RECORDING') {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    
    if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      // Notify new tab to start recording
      try {
        await chrome.tabs.sendMessage(activeInfo.tabId, {
          type: 'SET_STATUS',
          data: { status: 'RECORDING' }
        });
      } catch (e) {
        // Content script not loaded yet
      }
      
      // Notify old tab to stop
      if (state.tabIds.toRecord && state.tabIds.toRecord !== activeInfo.tabId) {
        try {
          await chrome.tabs.sendMessage(state.tabIds.toRecord, {
            type: 'SET_STATUS',
            data: { status: 'NORMAL' }
          });
        } catch (e) {
          // Tab might be closed
        }
        
        // Record selectWindow command
        sendToDashboard('RECORD_ADD_COMMAND', {
          cmd: 'selectWindow',
          target: `title=${tab.title}`,
          value: ''
        });
      }
      
      state.tabIds.toRecord = activeInfo.tabId;
    }
  }
});

console.log('MKP Recorder background script loaded');
