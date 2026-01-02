/**
 * MKP Auto Recorder - Popup Script
 */

const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnExport = document.getElementById('btnExport');
const btnClear = document.getElementById('btnClear');
const statusDiv = document.getElementById('status');
const commandsDiv = document.getElementById('commands');
const scenarioNameInput = document.getElementById('scenarioName');

let isRecording = false;
let currentScenario = {
  Name: 'Nouveau scénario',
  CreationDate: new Date().toISOString().split('T')[0],
  Commands: []
};

// Load scenario from background
async function loadScenario() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SCENARIO' });
  if (response && response.scenario) {
    currentScenario = response.scenario;
    scenarioNameInput.value = currentScenario.Name;
    renderCommands();
  }
}

// Render commands list
function renderCommands() {
  if (currentScenario.Commands.length === 0) {
    commandsDiv.innerHTML = `
      <div class="empty-state">
        Aucune commande enregistrée.<br>
        Cliquez sur <strong>Démarrer</strong> pour commencer.
      </div>
    `;
    return;
  }

  const html = currentScenario.Commands.map((cmd, index) => `
    <div class="command-item">
      <div class="cmd">${index + 1}. ${cmd.Command}</div>
      <div class="target">${cmd.Target}</div>
    </div>
  `).join('');

  commandsDiv.innerHTML = html;
}

// Start recording
btnStart.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Clear previous scenario
  await chrome.runtime.sendMessage({ type: 'CLEAR_SCENARIO' });
  currentScenario.Commands = [];
  currentScenario.Name = scenarioNameInput.value;
  currentScenario.CreationDate = new Date().toISOString().split('T')[0];

  // Start recording
  await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });

  isRecording = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  statusDiv.className = 'status recording';
  statusDiv.textContent = '🔴 Enregistrement en cours...';

  // Poll for new commands
  startPolling();
});

// Stop recording
btnStop.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' });

  isRecording = false;
  btnStart.disabled = false;
  btnStop.disabled = true;
  statusDiv.className = 'status stopped';
  statusDiv.textContent = '⏸️ Enregistrement arrêté';

  stopPolling();
  await loadScenario();
});

// Export scenario
btnExport.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SCENARIO' });
  const scenario = response.scenario;
  scenario.Name = scenarioNameInput.value;

  const dataStr = JSON.stringify(scenario, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${scenario.Name}.json`;
  a.click();

  URL.revokeObjectURL(url);

  alert('✅ Scénario exporté !');
});

// Clear scenario
btnClear.addEventListener('click', async () => {
  if (confirm('Voulez-vous vraiment effacer le scénario ?')) {
    await chrome.runtime.sendMessage({ type: 'CLEAR_SCENARIO' });
    currentScenario.Commands = [];
    renderCommands();
  }
});

// Poll for new commands while recording
let pollInterval = null;

function startPolling() {
  pollInterval = setInterval(async () => {
    await loadScenario();
  }, 1000); // Every second
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Initialize
loadScenario();
