/* ═══════════════════════════════════════════════════════════════
   OSRS GAME OF GOOSE — Admin Panel
   Uses BroadcastChannel + localStorage (no server needed)
   ═══════════════════════════════════════════════════════════════ */

const game = new GooseGame();
let selectedTileId = null;

// Quick-pick icon presets
const ICON_PRESETS = [
  '⚔️','🪓','📜','🎲','🗺️','❓','💀','☠️','📦','⏱️',
  '🦢','🌉','🍺','🪣','🔄','🔒','🏁','🏆','🐉','🦴',
  '🎣','⛏️','🏹','🛡️','🗡️','🧪','🪙','💎','🔥','🌿',
  '🦀','🐚','🪨','🧱','🏰','⚗️','🎯','👑','🪶','🧭',
];

// ═══════════════════════════════════════════════════════════════
//  GAME CONTROL
// ═══════════════════════════════════════════════════════════════

function startGame() { game.startGame(); }
function pauseGame() { game.pauseGame(); }
function resetGame() {
  if (confirm('Are you sure you want to reset the game? All progress will be lost!')) {
    game.resetGame();
  }
}
function doRollDice() { game.rollDice(); }
function doNextTeam() { game.nextTeam(); }

// ═══════════════════════════════════════════════════════════════
//  TEAM MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function addTeam() {
  const nameInput = document.getElementById('newTeamName');
  const colorInput = document.getElementById('newTeamColor');
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  game.addTeam(name, colorInput.value);
  nameInput.value = '';
  // Cycle to next default color
  const nextIdx = game.state.teams.length;
  if (TEAM_COLORS[nextIdx]) colorInput.value = TEAM_COLORS[nextIdx];
}

function removeTeam(teamId) {
  const team = game.state.teams.find(t => t.id === teamId);
  if (team && confirm(`Remove ${team.name}?`)) {
    game.removeTeam(teamId);
  }
}

function setTeamPosition(teamId, position) {
  const pos = parseInt(position);
  if (isNaN(pos) || pos < 0 || pos > 63) return;
  game.setTeamPosition(teamId, pos);
}

function moveTeamBy(teamId, delta) {
  const team = game.state.teams.find(t => t.id === teamId);
  if (!team) return;
  game.setTeamPosition(teamId, Math.max(0, Math.min(63, team.position + delta)));
}

function selectCurrentTeam(index) {
  game.setCurrentTeam(parseInt(index));
}

function renderTeamList(teams, currentTeamIndex) {
  const list = document.getElementById('teamList');
  if (teams.length === 0) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px;">No teams yet. Add teams above.</div>';
    return;
  }
  list.innerHTML = teams.map((team, index) => {
    const isCurrent = index === currentTeamIndex;
    let status = '';
    if (team.finished) status = `<span style="color:#22c55e;">✓ #${team.finishOrder}</span>`;
    else if (team.isTrapped) status = '<span style="color:#f59e0b;">🔒</span>';
    else if (team.skipTurns > 0) status = `<span style="color:#f59e0b;">⏸ ${team.skipTurns}</span>`;

    return `
      <div class="team-entry ${isCurrent ? 'is-current' : ''}">
        <div class="team-color-dot" style="background:${team.color}"></div>
        <div class="team-info">
          <div class="team-name">${team.name} ${status}</div>
          <div class="team-pos">Tile ${team.position}/63</div>
        </div>
        <div class="team-controls">
          <button onclick="moveTeamBy('${team.id}', -1)" title="Move back 1">◀</button>
          <input type="number" value="${team.position}" min="0" max="63"
                 onchange="setTeamPosition('${team.id}', this.value)" title="Set position">
          <button onclick="moveTeamBy('${team.id}', 1)" title="Move forward 1">▶</button>
          <button onclick="selectCurrentTeam(${index})" title="Set as current turn" style="color:var(--accent-gold);">🎯</button>
          <button class="btn-remove" onclick="removeTeam('${team.id}')">✕</button>
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
//  TILE EDITOR
// ═══════════════════════════════════════════════════════════════

function renderTileGrid(tiles) {
  const grid = document.getElementById('tileGrid');
  grid.innerHTML = tiles.map(tile => {
    const pos = getTileGridPosition(tile.id);
    return `
      <div class="tile-mini ${selectedTileId === tile.id ? 'selected' : ''}"
           data-tile-id="${tile.id}"
           style="grid-row:${pos.gridRow}; grid-column:${pos.gridColumn};
                  background:${hexToRgba(tile.color, 0.3)}; border-color:${tile.color};"
           onclick="selectTile(${tile.id})"
           title="Tile ${tile.id}: ${tile.name}\n${tile.challenge}">
        <span class="tile-mini-number">${tile.id}</span>
        <span class="tile-mini-icon">${tile.icon}</span>
        <span class="tile-mini-name">${tile.name}</span>
      </div>`;
  }).join('');
}

function selectTile(tileId) {
  selectedTileId = tileId;
  const tile = game.state.tiles.find(t => t.id === tileId);
  if (!tile) return;

  document.querySelectorAll('.tile-mini').forEach(el => el.classList.remove('selected'));
  const sel = document.querySelector(`.tile-mini[data-tile-id="${tileId}"]`);
  if (sel) sel.classList.add('selected');

  document.getElementById('tileEditPanel').style.display = 'block';
  document.getElementById('editTileTitle').textContent = `Edit Tile #${tileId} — ${tile.name}`;
  document.getElementById('editTileId').value = tileId;

  // Populate type dropdown
  const typeSelect = document.getElementById('editTileType');
  if (typeSelect.options.length <= 1) {
    typeSelect.innerHTML = '';
    for (const [key, info] of Object.entries(TILE_TYPES)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${info.icon} ${info.label}`;
      typeSelect.appendChild(opt);
    }
  }
  typeSelect.value = tile.type;
  document.getElementById('editTileName').value = tile.name;
  document.getElementById('editTileIcon').value = tile.icon;
  document.getElementById('editTileChallenge').value = tile.challenge;
  document.getElementById('editTileColor').value = tile.color;

  renderIconPresets();
  updateSpecialFields(tile);
  document.getElementById('tileEditPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderIconPresets() {
  document.getElementById('iconPresets').innerHTML = ICON_PRESETS.map(icon =>
    `<span class="icon-preset" onclick="document.getElementById('editTileIcon').value='${icon}'">${icon}</span>`
  ).join('');
}

function updateSpecialFields(tile) {
  const actionSelect = document.getElementById('editSpecialAction');
  const targetInput = document.getElementById('editSpecialTarget');
  const turnsInput = document.getElementById('editSpecialTurns');

  if (tile.special) {
    actionSelect.value = tile.special.action || '';
    if (tile.special.target !== undefined) targetInput.value = tile.special.target;
    if (tile.special.turns !== undefined) turnsInput.value = tile.special.turns;
  } else {
    actionSelect.value = '';
    targetInput.value = '';
    turnsInput.value = '';
  }
  updateSpecialVisibility();
}

function onTileTypeChange() {
  const type = document.getElementById('editTileType').value;
  if (TILE_TYPES[type]) {
    document.getElementById('editTileIcon').value = TILE_TYPES[type].icon;
    document.getElementById('editTileColor').value = TILE_TYPES[type].color;
    const actionSelect = document.getElementById('editSpecialAction');
    switch (type) {
      case 'goose': actionSelect.value = 'roll_again'; break;
      case 'bridge': actionSelect.value = 'jump'; break;
      case 'inn': actionSelect.value = 'skip_turns'; document.getElementById('editSpecialTurns').value = 1; break;
      case 'well': actionSelect.value = 'skip_turns'; document.getElementById('editSpecialTurns').value = 2; break;
      case 'maze': actionSelect.value = 'go_back'; break;
      case 'prison': actionSelect.value = 'prison'; document.getElementById('editSpecialTurns').value = 3; break;
      case 'death': actionSelect.value = 'go_back'; break;
      default: actionSelect.value = ''; break;
    }
    updateSpecialVisibility();
  }
}

function updateSpecialVisibility() {
  const action = document.getElementById('editSpecialAction').value;
  document.getElementById('editSpecialTarget').style.display = (action === 'jump' || action === 'go_back') ? 'block' : 'none';
  document.getElementById('editSpecialTurns').style.display = (action === 'skip_turns' || action === 'prison') ? 'block' : 'none';
}

function saveTileEdit() {
  const tileId = parseInt(document.getElementById('editTileId').value);
  const updates = {
    type: document.getElementById('editTileType').value,
    name: document.getElementById('editTileName').value.trim(),
    icon: document.getElementById('editTileIcon').value,
    challenge: document.getElementById('editTileChallenge').value.trim(),
    color: document.getElementById('editTileColor').value,
  };

  const action = document.getElementById('editSpecialAction').value;
  if (action) {
    updates.special = { action };
    if (action === 'jump' || action === 'go_back') {
      updates.special.target = parseInt(document.getElementById('editSpecialTarget').value) || 0;
    }
    if (action === 'skip_turns' || action === 'prison') {
      updates.special.turns = parseInt(document.getElementById('editSpecialTurns').value) || 1;
    }
  } else {
    updates.special = null;
  }

  game.updateTile(tileId, updates);

  const saveBtn = document.querySelector('.btn-save');
  saveBtn.textContent = '✓ Saved!';
  setTimeout(() => { saveBtn.textContent = '💾 Save Tile'; }, 1500);
}

function cancelTileEdit() {
  selectedTileId = null;
  document.getElementById('tileEditPanel').style.display = 'none';
  document.querySelectorAll('.tile-mini').forEach(el => el.classList.remove('selected'));
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════

function doUpdateSettings() {
  game.updateSettings({
    exactFinish: document.getElementById('exactFinish').checked,
    boardName: document.getElementById('boardName').value,
    diceCount: parseInt(document.getElementById('diceCount').value),
  });
}

function exportTiles() {
  const data = JSON.stringify(game.state.tiles, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'osrs-goose-tiles.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importTiles(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const tiles = JSON.parse(e.target.result);
      if (Array.isArray(tiles) && tiles.length === 64) {
        tiles.forEach(tile => {
          game.updateTile(tile.id, {
            type: tile.type, name: tile.name, icon: tile.icon,
            challenge: tile.challenge, color: tile.color, special: tile.special,
          });
        });
        alert('Tiles imported successfully!');
      } else {
        alert('Invalid tile file. Must contain exactly 64 tiles.');
      }
    } catch (err) {
      alert('Error parsing JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ═══════════════════════════════════════════════════════════════
//  UPDATE UI
// ═══════════════════════════════════════════════════════════════

function updateUI() {
  const state = game.state;

  // Turn indicator
  const turnTeam = document.getElementById('adminTurnTeam');
  if (state.teams.length > 0 && state.gameStarted) {
    const team = state.teams[state.currentTeamIndex];
    if (team) { turnTeam.textContent = team.name; turnTeam.style.color = team.color; }
  } else {
    turnTeam.textContent = state.gameStarted ? 'Waiting...' : 'Not Started';
    turnTeam.style.color = 'var(--accent-gold)';
  }

  // Button states
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnRoll = document.getElementById('btnRoll');

  if (state.gameStarted) {
    btnStart.disabled = true; btnStart.style.opacity = '0.5';
    btnPause.textContent = state.gamePaused ? '▶ Resume' : '⏸ Pause';
    btnRoll.disabled = state.gamePaused || state.teams.length === 0;
    btnRoll.style.opacity = (state.gamePaused || state.teams.length === 0) ? '0.5' : '1';
  } else {
    btnStart.disabled = state.teams.length === 0;
    btnStart.style.opacity = state.teams.length === 0 ? '0.5' : '1';
    btnPause.disabled = true; btnPause.style.opacity = '0.5';
    btnRoll.disabled = true; btnRoll.style.opacity = '0.5';
  }

  // Settings
  document.getElementById('exactFinish').checked = state.settings.exactFinish;
  document.getElementById('boardName').value = state.settings.boardName;
  document.getElementById('diceCount').value = state.settings.diceCount;

  // Teams
  renderTeamList(state.teams, state.currentTeamIndex);

  // Tile grid
  renderTileGrid(state.tiles);

  // Log
  const log = document.getElementById('adminLog');
  log.innerHTML = (state.history || []).slice(-40).map(entry =>
    `<div class="log-entry">${entry.message}</div>`
  ).join('');
  log.scrollTop = log.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

game.on('state:full', () => updateUI());
game.on('tile:updated', () => updateUI());
game.on('dice:result', () => updateUI());
game.on('turn:skipped', () => updateUI());

document.getElementById('newTeamName')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTeam();
});

document.addEventListener('DOMContentLoaded', () => {
  updateSpecialVisibility();
  updateUI();
});
