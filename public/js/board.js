/* ═══════════════════════════════════════════════════════════════
   OSRS GAME OF GOOSE — Board View
   Uses BroadcastChannel + localStorage (no server needed)
   ═══════════════════════════════════════════════════════════════ */

const game = new GooseGame();
let isAnimating = false;

// ── Pip layouts for dice faces (3x3 grid, positions 1-9) ────────
const PIP_LAYOUTS = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

// ── Render Board ────────────────────────────────────────────────
function renderBoard(tiles) {
  const board = document.getElementById('board');
  board.innerHTML = '';

  tiles.forEach(tile => {
    const pos = getTileGridPosition(tile.id);
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.tileId = tile.id;
    el.dataset.type = tile.type;
    el.style.gridRow = pos.gridRow;
    el.style.gridColumn = pos.gridColumn;
    el.style.backgroundColor = hexToRgba(tile.color, 0.2);
    el.style.borderColor = tile.color;

    el.innerHTML = `
      <span class="tile-number">${tile.id}</span>
      <span class="tile-icon">${tile.icon}</span>
      <span class="tile-name">${tile.name}</span>
      <div class="tile-tokens"></div>
    `;

    el.addEventListener('click', () => showChallengePopup(tile));
    board.appendChild(el);
  });
}

// ── Render Team Tokens ──────────────────────────────────────────
function renderTokens(teams, currentTeamIndex) {
  document.querySelectorAll('.tile-tokens').forEach(c => c.innerHTML = '');

  teams.forEach((team, index) => {
    const tileEl = document.querySelector(`.tile[data-tile-id="${team.position}"]`);
    if (!tileEl) return;
    const container = tileEl.querySelector('.tile-tokens');

    const token = document.createElement('div');
    token.className = 'team-token';
    if (index === currentTeamIndex && !team.finished) {
      token.classList.add('active-turn');
    }
    token.style.backgroundColor = team.color;
    token.textContent = team.name.charAt(0).toUpperCase();
    token.title = `${team.name} — Tile ${team.position}`;
    container.appendChild(token);
  });
}

// ── Dice Animation ──────────────────────────────────────────────
function animateDice(dice, callback) {
  const dice1El = document.getElementById('dice1');
  const dice2El = document.getElementById('dice2');
  const totalEl = document.getElementById('diceTotal');
  const singleDie = dice.length === 1;

  dice2El.style.display = singleDie ? 'none' : '';
  dice1El.classList.add('rolling');
  if (!singleDie) dice2El.classList.add('rolling');
  totalEl.textContent = '...';

  let rollCount = 0;
  const rollInterval = setInterval(() => {
    setDiceFace(dice1El, Math.floor(Math.random() * 6) + 1);
    if (!singleDie) setDiceFace(dice2El, Math.floor(Math.random() * 6) + 1);
    rollCount++;
    if (rollCount > 15) {
      clearInterval(rollInterval);
      dice1El.classList.remove('rolling');
      if (!singleDie) dice2El.classList.remove('rolling');
      setDiceFace(dice1El, dice[0]);
      if (!singleDie) setDiceFace(dice2El, dice[1]);
      const total = dice.reduce((a, b) => a + b, 0);
      totalEl.textContent = total;
      totalEl.classList.add('flash');
      setTimeout(() => totalEl.classList.remove('flash'), 600);
      if (callback) setTimeout(callback, 400);
    }
  }, 80);
}

function setDiceFace(diceEl, value) {
  const pips = PIP_LAYOUTS[value] || [];
  diceEl.innerHTML = '';
  for (let i = 1; i <= 9; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip' + (pips.includes(i) ? ' show' : '');
    diceEl.appendChild(pip);
  }
}

// ── Token Movement Animation ────────────────────────────────────
function animateTokenMovement(teamId, path, callback) {
  if (!path || path.length < 2) { if (callback) callback(); return; }

  isAnimating = true;
  const state = game.getFullState();
  const team = state.teams.find(t => t.id === teamId);
  if (!team) { isAnimating = false; if (callback) callback(); return; }

  const boardEl = document.getElementById('board');
  const movingToken = document.createElement('div');
  movingToken.className = 'token-moving';
  movingToken.style.backgroundColor = team.color;
  boardEl.appendChild(movingToken);

  let stepIndex = 0;
  function moveStep() {
    if (stepIndex >= path.length) {
      movingToken.remove();
      isAnimating = false;
      if (callback) callback();
      return;
    }
    const tileEl = document.querySelector(`.tile[data-tile-id="${path[stepIndex]}"]`);
    if (!tileEl) { stepIndex++; moveStep(); return; }

    const boardRect = boardEl.getBoundingClientRect();
    const tileRect = tileEl.getBoundingClientRect();
    movingToken.style.left = (tileRect.left - boardRect.left + tileRect.width/2 - 11) + 'px';
    movingToken.style.top = (tileRect.top - boardRect.top + tileRect.height/2 - 11) + 'px';
    stepIndex++;
    setTimeout(moveStep, 180);
  }
  moveStep();
}

// ── Challenge Popup ─────────────────────────────────────────────
function showChallengePopup(tile, team) {
  const overlay = document.getElementById('challengePopup');
  const tileType = TILE_TYPES[tile.type] || {};

  document.getElementById('popupIcon').textContent = tile.icon;
  document.getElementById('popupType').textContent = tileType.label || tile.type;
  document.getElementById('popupName').textContent = tile.name;
  document.getElementById('popupText').textContent = tile.challenge;
  document.getElementById('popupTeam').textContent = team ? team.name : '';
  overlay.classList.add('show');

  const dismiss = () => { overlay.classList.remove('show'); overlay.removeEventListener('click', dismiss); };
  overlay.addEventListener('click', dismiss);
  setTimeout(dismiss, 6000);
}

// ── Update Side Panel ───────────────────────────────────────────
function updateSidePanel(state) {
  const turnTeamEl = document.getElementById('turnTeamName');
  if (state.teams.length > 0 && state.gameStarted) {
    const team = state.teams[state.currentTeamIndex];
    if (team) { turnTeamEl.textContent = team.name; turnTeamEl.style.color = team.color; }
  } else {
    turnTeamEl.textContent = state.gameStarted ? 'Waiting...' : 'Not Started';
    turnTeamEl.style.color = '#daa520';
  }

  const statusEl = document.getElementById('gameStatus');
  statusEl.className = 'game-status';
  if (!state.gameStarted) { statusEl.textContent = 'Not Started'; statusEl.classList.add('not-started'); }
  else if (state.gamePaused) { statusEl.textContent = 'Paused'; statusEl.classList.add('paused'); }
  else { statusEl.textContent = 'Live'; statusEl.classList.add('running'); }

  if (state.teams.length > 0 && state.gameStarted) {
    const team = state.teams[state.currentTeamIndex];
    if (team) {
      const tile = state.tiles[team.position];
      document.getElementById('challengeTileName').textContent = `${tile.icon} ${tile.name}`;
      document.getElementById('challengeText').textContent = tile.challenge;
    }
  }

  // Standings
  const sorted = [...state.teams].sort((a, b) => {
    if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
    if (a.finished) return -1; if (b.finished) return 1;
    return b.position - a.position;
  });

  document.getElementById('standingsList').innerHTML = sorted.map(team => {
    const isCurrent = state.teams.indexOf(team) === state.currentTeamIndex;
    let badge = '';
    if (team.finished) badge = `<span class="standing-badge winner">#${team.finishOrder}</span>`;
    else if (team.isTrapped) badge = `<span class="standing-badge prison">🔒</span>`;
    else if (team.skipTurns > 0) badge = `<span class="standing-badge skip">⏸ ${team.skipTurns}</span>`;

    return `<div class="standing-entry ${isCurrent ? 'current-turn' : ''} ${team.finished ? 'finished' : ''}">
      <div class="standing-color" style="background:${team.color}"></div>
      <span class="standing-name">${team.name}</span>
      <span class="standing-position">Tile ${team.position}/63</span>
      ${badge}
    </div>`;
  }).join('');
}

function updateLog(history) {
  const container = document.getElementById('logContainer');
  container.innerHTML = (history || []).slice(-30).map(entry => {
    let cls = 'log-system';
    const m = entry.message;
    if (m.includes('rolled')) cls = 'log-roll';
    else if (m.includes('moved') || m.includes('Moved')) cls = 'log-move';
    else if (m.includes('Lucky') || m.includes('bridge') || m.includes('prison') || m.includes('inn') || m.includes('maze') || m.includes('back') || m.includes('Death')) cls = 'log-special';
    else if (m.includes('Admin')) cls = 'log-admin';
    else if (m.includes('FINISHED') || m.includes('🏆')) cls = 'log-finish';
    return `<div class="log-entry ${cls}">${m}</div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

// ── Full Refresh ────────────────────────────────────────────────
function refreshAll() {
  const state = game.getFullState();
  document.getElementById('dice2').style.display =
    (state.settings.diceCount || 2) === 1 ? 'none' : '';
  renderBoard(state.tiles);
  renderTokens(state.teams, state.currentTeamIndex);
  updateSidePanel(state);
  updateLog(state.history);
}

// ── Listen for State Changes ────────────────────────────────────
game.on('state:full', () => refreshAll());
game.on('tile:updated', () => refreshAll());

game.on('dice:result', (data) => {
  if (data && data.dice) {
    animateDice(data.dice, () => {
      if (data.moveResult && data.moveResult.path) {
        animateTokenMovement(data.teamId, data.moveResult.path, () => {
          if (data.moveResult.tile && data.moveResult.tile.type !== 'goose') {
            const team = game.state.teams.find(t => t.id === data.teamId);
            showChallengePopup(data.moveResult.tile, team);
          }
          refreshAll();
        });
      } else {
        refreshAll();
      }
    });
  }
});

game.on('turn:skipped', () => refreshAll());

// ── Initialize ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setDiceFace(document.getElementById('dice1'), 1);
  setDiceFace(document.getElementById('dice2'), 1);
  refreshAll();
});
