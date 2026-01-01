/**
 * MKP Recorder - Background Service Worker
 * Basé sur le code de UI.Vision RPA
 */

console.log('MKP Recorder background script starting...');

// État global de l'extension
let state = {
  status: 'NORMAL', // NORMAL, RECORDING, PLAYING
  tabIds: {
    panel: null,
    toRecord: null,
    toPlay: null
  }
};

// Initialisation
chrome.runtime.onInstalled.addListener(() => {
  console.log('MKP Recorder installé');
});

// Clic sur l'icône de l'extension - ouvrir le dashboard
chrome.action.onClicked.addListener((tab) => {
  console.log('Icon clicked, opening dashboard...');
  chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard.html')
  });
});

// Communication avec les content scripts et le dashboard
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('BG received:', message.type, message);
  
  const { type, data } = message;
  
  // Traitement synchrone pour certains messages
  switch (type) {
    case 'DASHBOARD_INIT':
      console.log('Dashboard initialized');
      sendResponse({ status: state.status });
      return true;
    
    case 'GET_STATE':
      sendResponse({ state });
      return true;
    
    case 'CS_READY':
      console.log('Content script ready in tab:', sender.tab?.id);
      // Envoyer le status actuel au content script
      sendResponse({ status: state.status });
      return true;
    
    case 'CS_RECORD_COMMAND':
      console.log('Recording command:', data);
      if (state.status === 'RECORDING') {
        // Envoyer au dashboard via un message broadcast
        chrome.runtime.sendMessage({ 
          type: 'RECORD_ADD_COMMAND', 
          data: data 
        }).catch(() => {
          console.log('Dashboard not available');
        });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
      return true;
  }
  
  // Traitement asynchrone
  handleAsyncMessage(type, data, sender)
    .then(response => {
      sendResponse(response);
    })
    .catch(error => {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    });
  
  return true; // Keep channel open for async response
});

async function handleAsyncMessage(type, data, sender) {
  switch (type) {
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
      updateBadge('', '');
      return { success: true };
    
    case 'HIGHLIGHT_ELEMENT':
      return await highlightElementInTab(data);
    
    case 'GET_ACTIVE_TAB':
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return { tab: activeTab };
      
    default:
      console.log('Unknown message type:', type);
      return { error: 'Unknown message type' };
  }
}

async function startRecording() {
  try {
    console.log('Starting recording...');
    
    // Obtenir l'onglet actif (pas le dashboard)
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    let tab = tabs[0];
    
    // Si l'onglet actif est le dashboard, chercher un autre onglet
    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      tab = allTabs.find(t => !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));
    }
    
    if (!tab) {
      return { error: 'Aucune page web ouverte. Ouvrez une page web puis cliquez sur Enregistrer.' };
    }
    
    console.log('Recording on tab:', tab.id, tab.url);
    
    state.status = 'RECORDING';
    state.tabIds.toRecord = tab.id;
    
    // Activer l'onglet cible
    await chrome.tabs.update(tab.id, { active: true });
    
    // Notifier le content script
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'SET_STATUS',
        data: { status: 'RECORDING' }
      });
      console.log('Content script notified');
    } catch (e) {
      console.log('Content script not ready yet:', e.message);
    }
    
    updateBadge('R', '#ef5350');
    
    return { 
      success: true, 
      tabId: tab.id,
      openCommand: {
        cmd: 'open',
        target: tab.url,
        value: ''
      }
    };
  } catch (error) {
    console.error('Error starting recording:', error);
    return { error: error.message };
  }
}

async function stopRecording() {
  console.log('Stopping recording...');
  
  if (state.tabIds.toRecord) {
    try {
      await chrome.tabs.sendMessage(state.tabIds.toRecord, {
        type: 'SET_STATUS',
        data: { status: 'NORMAL' }
      });
    } catch (e) {
      console.log('Could not notify tab:', e.message);
    }
  }
  
  state.status = 'NORMAL';
  state.tabIds.toRecord = null;
  updateBadge('', '');
  
  return { success: true };
}

async function highlightElementInTab(data) {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    let tab = tabs[0];
    
    if (tab && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'HIGHLIGHT_ELEMENT',
        data: { locator: data.locator }
      });
      return { success: true };
    }
    return { error: 'No valid tab found' };
  } catch (error) {
    return { error: error.message };
  }
}

function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) {
    chrome.action.setBadgeBackgroundColor({ color });
  }
}

// Écouter les changements d'onglet pendant l'enregistrement
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (state.status === 'RECORDING') {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      
      if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        // Notifier le nouvel onglet
        try {
          await chrome.tabs.sendMessage(activeInfo.tabId, {
            type: 'SET_STATUS',
            data: { status: 'RECORDING' }
          });
        } catch (e) {
          // Content script pas encore chargé
        }
        
        // Notifier l'ancien onglet d'arrêter
        if (state.tabIds.toRecord && state.tabIds.toRecord !== activeInfo.tabId) {
          try {
            await chrome.tabs.sendMessage(state.tabIds.toRecord, {
              type: 'SET_STATUS',
              data: { status: 'NORMAL' }
            });
          } catch (e) {
            // Onglet peut être fermé
          }
        }
        
        state.tabIds.toRecord = activeInfo.tabId;
      }
    } catch (e) {
      console.log('Tab change error:', e.message);
    }
  }
});

console.log('MKP Recorder background script loaded');
