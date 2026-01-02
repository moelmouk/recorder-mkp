/**
 * MKP Auto Recorder - Popup Script
 */

const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnPlay = document.getElementById('btnPlay');
const btnExport = document.getElementById('btnExport');
const btnImport = document.getElementById('btnImport');
const btnClear = document.getElementById('btnClear');
const fileImport = document.getElementById('fileImport');
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
    btnPlay.disabled = currentScenario.Commands.length === 0;
  }
}

// Render commands list
function renderCommands() {
  if (currentScenario.Commands.length === 0) {
    commandsDiv.innerHTML = `
      <div class="empty-state">
        Aucune commande enregistrée.<br>
        Cliquez sur <strong>Enregistrer</strong> pour commencer.
      </div>
    `;
    btnPlay.disabled = true;
    return;
  }

  const html = currentScenario.Commands.map((cmd, index) => `
    <div class="command-item">
      <div class="cmd">${index + 1}. ${cmd.Command}</div>
      <div class="target" title="${cmd.Target}">${cmd.Target}</div>
    </div>
  `).join('');

  commandsDiv.innerHTML = html;
  btnPlay.disabled = false;
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
  btnPlay.disabled = true;
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

// Play scenario
btnPlay.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  statusDiv.className = 'status recording';
  statusDiv.textContent = '▶️ Lecture en cours...';
  btnPlay.disabled = true;
  btnStart.disabled = true;

  try {
    for (let i = 0; i < currentScenario.Commands.length; i++) {
      const cmd = currentScenario.Commands[i];
      
      // Highlight current command
      const items = commandsDiv.querySelectorAll('.command-item');
      items.forEach((item, idx) => {
        item.style.background = idx === i ? '#fff3cd' : '';
      });

      // Execute command
      await chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_COMMAND',
        command: cmd
      });

      // Wait a bit between commands
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    statusDiv.className = 'status stopped';
    statusDiv.textContent = '✅ Lecture terminée';
  } catch (error) {
    statusDiv.className = 'status stopped';
    statusDiv.textContent = '❌ Erreur: ' + error.message;
  } finally {
    btnPlay.disabled = false;
    btnStart.disabled = false;
    // Remove highlights
    commandsDiv.querySelectorAll('.command-item').forEach(item => {
      item.style.background = '';
    });
  }
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

// Import scenario
btnImport.addEventListener('click', () => {
  fileImport.click();
});

fileImport.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    // Validate format
    if (!imported.Commands || !Array.isArray(imported.Commands)) {
      throw new Error('Format invalide');
    }

    // Load imported scenario
    currentScenario = {
      Name: imported.Name || 'Scénario importé',
      CreationDate: imported.CreationDate || new Date().toISOString().split('T')[0],
      Commands: imported.Commands
    };

    // Save to background
    await chrome.runtime.sendMessage({
      type: 'SET_SCENARIO',
      scenario: currentScenario
    });

    scenarioNameInput.value = currentScenario.Name;
    renderCommands();
    alert('✅ Scénario importé !');
  } catch (error) {
    alert('❌ Erreur lors de l\'import: ' + error.message);
  }

  // Reset file input
  fileImport.value = '';
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
