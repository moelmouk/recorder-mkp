/**
 * MKP Auto Recorder - Background Service Worker
 */

let currentScenario = {
  Name: 'Nouveau scénario',
  CreationDate: new Date().toISOString().split('T')[0],
  Commands: []
};

let isRecording = false;

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received:', message.type);

  if (message.type === 'START_RECORDING') {
    handleStartRecording(sender.tab.id);
    sendResponse({ success: true });
  } else if (message.type === 'STOP_RECORDING') {
    handleStopRecording(sender.tab.id);
    sendResponse({ success: true });
  } else if (message.type === 'COMMAND_RECORDED') {
    currentScenario.Commands.push(message.command);
    sendResponse({ success: true });
  } else if (message.type === 'GET_SCENARIO') {
    sendResponse({ scenario: currentScenario });
  } else if (message.type === 'CLEAR_SCENARIO') {
    currentScenario = {
      Name: 'Nouveau scénario',
      CreationDate: new Date().toISOString().split('T')[0],
      Commands: []
    };
    sendResponse({ success: true });
  } else if (message.type === 'EXPORT_SCENARIO') {
    sendResponse({ scenario: currentScenario });
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

console.log('MKP Auto Recorder background loaded');
