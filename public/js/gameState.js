/* ═══════════════════════════════════════════════════════════════
   OSRS GAME OF GOOSE — Client-Side Game State Engine
   Shared between Board View and Admin Panel
   Syncs via BroadcastChannel + localStorage
   ═══════════════════════════════════════════════════════════════ */

// ── Tile Type Definitions ──────────────────────────────────────
const TILE_TYPES = {
  start:      { label: 'Start',       icon: '🏁', color: '#2d5a1b' },
  finish:     { label: 'Finish',      icon: '🏆', color: '#b8860b' },
  combat:     { label: 'Combat',      icon: '⚔️', color: '#8B0000' },
  skilling:   { label: 'Skilling',    icon: '🪓', color: '#1a6b1a' },
  quest:      { label: 'Quest',       icon: '📜', color: '#4B0082' },
  minigame:   { label: 'Minigame',    icon: '🎲', color: '#c46200' },
  clue:       { label: 'Clue Scroll', icon: '🗺️', color: '#8B6914' },
  trivia:     { label: 'Trivia',      icon: '❓', color: '#2856a3' },
  boss:       { label: 'Boss',        icon: '💀', color: '#5c0a0a' },
  wilderness: { label: 'Wilderness',  icon: '☠️', color: '#1a1a2e' },
  collection: { label: 'Collection',  icon: '📦', color: '#6b3a1a' },
  speed:      { label: 'Speed',       icon: '⏱️', color: '#b34700' },
  goose:      { label: 'Lucky',       icon: '🦢', color: '#a88700' },
  bridge:     { label: 'Bridge',      icon: '🌉', color: '#1a6b4a' },
  inn:        { label: 'Inn',         icon: '🍺', color: '#8B4513' },
  well:       { label: 'Well',        icon: '🪣', color: '#1a4a6b' },
  maze:       { label: 'Maze',        icon: '🔄', color: '#6b1a6b' },
  prison:     { label: 'Prison',      icon: '🔒', color: '#4a4a4a' },
  death:      { label: 'Death',       icon: '💀', color: '#0d0d0d' },
};

const TEAM_COLORS = [
  '#e6192c', '#1a6bff', '#1ab34d', '#e6b800',
  '#9933ff', '#00b3b3', '#e65c00', '#e64d8c',
];

// ── Default Special Effects ────────────────────────────────────
function getSpecialEffect(type) {
  switch (type) {
    case 'goose':  return { action: 'roll_again' };
    case 'bridge': return { action: 'jump', target: 12 };
    case 'inn':    return { action: 'skip_turns', turns: 1 };
    case 'well':   return { action: 'skip_turns', turns: 2 };
    case 'maze':   return { action: 'go_back', target: 30 };
    case 'prison': return { action: 'prison', turns: 3 };
    case 'death':  return { action: 'go_back', target: 40 };
    default:       return null;
  }
}

// ── Shared Utilities ───────────────────────────────────────────
function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(128,128,128,${alpha})`;
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.substring(0,2),16)||128},${parseInt(h.substring(2,4),16)||128},${parseInt(h.substring(4,6),16)||128},${alpha})`;
}

function getTileGridPosition(tileId) {
  const row = Math.floor(tileId / 8);
  const col = (row % 2 === 0) ? (tileId % 8) : (7 - tileId % 8);
  return { gridRow: 8 - row, gridColumn: col + 1 };
}

// ── Generate Default 64 Tiles ──────────────────────────────────
function generateDefaultTiles() {
  const defs = [
    { type: 'start',      name: 'Lumbridge',           challenge: 'All teams begin their adventure here! Gear up and prepare.' },
    { type: 'combat',     name: 'Goblin Slayer',       challenge: 'Kill 25 Goblins anywhere in Lumbridge.' },
    { type: 'skilling',   name: 'Shrimp Fisher',       challenge: 'Catch 40 Shrimps at Lumbridge Swamp.' },
    { type: 'trivia',     name: 'Gielinor Quiz',       challenge: 'Answer 3 OSRS trivia questions correctly (admin asks).' },
    { type: 'collection', name: 'Bone Collector',      challenge: 'Collect and bury 50 bones of any type.' },
    { type: 'goose',      name: 'Lucky Clover',        challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'bridge',     name: 'Lumbridge Bridge',    challenge: 'Cross the bridge! Jump ahead to tile 12.' },
    { type: 'quest',      name: "Cook's Assistant",    challenge: "Complete Cook's Assistant quest (or provide all items if done)." },
    { type: 'skilling',   name: 'Copper Miner',        challenge: 'Mine 40 Copper ore at the Lumbridge mine.' },
    { type: 'goose',      name: 'Lucky Impling',       challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'combat',     name: 'Cow Killer',          challenge: 'Kill 20 Cows in the Lumbridge cow field and collect their hides.' },
    { type: 'minigame',   name: 'Pest Control',        challenge: 'Complete 1 round of Pest Control.' },
    { type: 'speed',      name: 'Skilling Sprint',     challenge: 'First team member to reach 100 total resources (any skill) wins!' },
    { type: 'clue',       name: 'Beginner Clue',       challenge: 'Complete a Beginner clue scroll from start to finish.' },
    { type: 'goose',      name: 'Lucky Drop',          challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'boss',       name: 'Giant Mole',          challenge: 'Get 1 Giant Mole kill (all team members must be present).' },
    { type: 'skilling',   name: 'Oak Woodcutter',      challenge: 'Cut 50 Oak logs as a team.' },
    { type: 'trivia',     name: 'F2P Expert',          challenge: 'Name all F2P quests in order of release (admin verifies).' },
    { type: 'goose',      name: 'Lucky Seed',          challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'inn',        name: 'Blue Moon Inn',       challenge: 'Rest at the Blue Moon Inn in Varrock. Skip your next turn!' },
    { type: 'combat',     name: 'Hill Giant Basher',   challenge: 'Kill 30 Hill Giants in the Edgeville Dungeon.' },
    { type: 'collection', name: 'Feather Gatherer',    challenge: 'Collect 200 feathers from chickens.' },
    { type: 'quest',      name: 'Dragon Slayer Prep',  challenge: 'Collect all items needed for Dragon Slayer (anti-dragon shield, etc.).' },
    { type: 'goose',      name: 'Lucky Charm',         challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'skilling',   name: 'Lobster Fisher',      challenge: 'Catch 40 Lobsters at Catherby or Karamja.' },
    { type: 'wilderness',  name: 'Green Dragon Hunt', challenge: 'Kill 5 Green Dragons in the Wilderness and bank the hides.' },
    { type: 'minigame',   name: 'Barbarian Assault',   challenge: 'Complete 1 wave of Barbarian Assault.' },
    { type: 'goose',      name: 'Lucky Ore',           challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'speed',      name: 'Varrock Sprint',      challenge: 'Race from Lumbridge to Varrock and back. Fastest team time!' },
    { type: 'clue',       name: 'Easy Treasure',       challenge: 'Complete an Easy clue scroll from start to finish.' },
    { type: 'combat',     name: 'Elvarg Slayer',       challenge: 'Kill Elvarg in Dragon Slayer (or KBD if already completed).' },
    { type: 'well',       name: 'Lumbridge Well',      challenge: 'Fell into the well! Skip 2 turns or wait for another team to land here.' },
    { type: 'goose',      name: 'Lucky Rune',          challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'boss',       name: 'Barrows Brothers',    challenge: 'Complete 1 full Barrows run (kill all 6 brothers and loot chest).' },
    { type: 'skilling',   name: 'Steel Smelter',       challenge: 'Smelt 30 Steel bars at any furnace.' },
    { type: 'trivia',     name: 'History Lesson',      challenge: 'Answer 3 questions about OSRS update history (admin asks).' },
    { type: 'goose',      name: 'Lucky Ring',          challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'quest',      name: 'Monkey Madness',      challenge: 'Complete Monkey Madness I (or defeat Kruk if done).' },
    { type: 'collection', name: 'Rune Collector',      challenge: 'Collect a full set of Rune armor (helm, body, legs, kite, sword).' },
    { type: 'wilderness',  name: 'Revenant Hunter',   challenge: 'Kill any 3 Revenants in the Revenant Caves.' },
    { type: 'combat',     name: 'Slayer Task',         challenge: 'Get and complete a full Slayer task from any Slayer master.' },
    { type: 'goose',      name: 'Lucky Gem',           challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'maze',       name: 'Lost in Maze',        challenge: 'Got lost in the maze! Go back to tile 30.' },
    { type: 'minigame',   name: 'Castle Wars',         challenge: 'Play 1 full game of Castle Wars.' },
    { type: 'speed',      name: 'Agility Course',      challenge: 'Complete 10 laps of any Rooftop Agility course. Fastest time!' },
    { type: 'goose',      name: 'Lucky Prayer',        challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'boss',       name: 'Zulrah',              challenge: 'Get 1 Zulrah kill (all team members must attempt).' },
    { type: 'skilling',   name: 'Farm Run',            challenge: 'Complete a full herb + allotment farm run (at least 4 patches).' },
    { type: 'clue',       name: 'Medium Treasure',     challenge: 'Complete a Medium clue scroll from start to finish.' },
    { type: 'trivia',     name: 'GWD Scholar',         challenge: 'Name all 4 GWD bosses AND their unique drops (admin verifies).' },
    { type: 'goose',      name: 'Lucky Bond',          challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'quest',      name: 'Recipe for Disaster',  challenge: 'Complete any RFD subquest not yet done (or buy barrows gloves if done).' },
    { type: 'prison',     name: 'Port Sarim Jail',     challenge: 'Locked up! Skip 3 turns OR roll doubles on your next roll to escape.' },
    { type: 'combat',     name: 'Demon Destroyer',     challenge: 'Kill 30 Black Demons in Taverley Dungeon or Catacombs.' },
    { type: 'goose',      name: 'Lucky Totem',         challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'boss',       name: 'Corp Beast',          challenge: 'Get 1 Corporeal Beast kill as a team.' },
    { type: 'wilderness',  name: 'Wildy Diary',       challenge: 'Complete any 1 task from the Wilderness Achievement Diary.' },
    { type: 'speed',      name: 'Seers Sprint',        challenge: 'Complete 15 laps of the Seers Rooftop course. Fastest time!' },
    { type: 'death',      name: "Death's Office",      challenge: "Death sends you back! Return to tile 40 and try again." },
    { type: 'goose',      name: 'Lucky Max',           challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'boss',       name: 'Vorkath',             challenge: 'Get 1 Vorkath kill (must show loot to admin).' },
    { type: 'collection', name: 'Dragon Trophy',       challenge: 'Obtain any Dragon item drop (not purchased from GE).' },
    { type: 'combat',     name: 'Final Battle',        challenge: 'Win a 1v1 PvM challenge chosen by admin. Last obstacle!' },
    { type: 'finish',     name: 'Grand Exchange',      challenge: 'Congratulations! You have completed the Game of Goose!' },
  ];

  return defs.map((def, i) => {
    const typeInfo = TILE_TYPES[def.type];
    return {
      id: i,
      type: def.type,
      name: def.name,
      icon: typeInfo.icon,
      challenge: def.challenge,
      color: typeInfo.color,
      special: getSpecialEffect(def.type),
    };
  });
}

// ═══════════════════════════════════════════════════════════════
//  GAME STATE MANAGER
// ═══════════════════════════════════════════════════════════════
class GooseGame {
  constructor() {
    this.channel = new BroadcastChannel('osrs-goose');
    this.listeners = [];
    this.loadState();

    // Listen for state changes from other tabs
    this.channel.onmessage = (e) => {
      if (e.data.type === 'state:update') {
        this.state = e.data.state;
        this._saveToStorage();
        this._notify(e.data.event || 'state:full', e.data.payload);
      }
    };

    // Also listen for storage events as fallback
    window.addEventListener('storage', (e) => {
      if (e.key === 'osrs-goose-state') {
        try {
          this.state = JSON.parse(e.newValue);
          this._notify('state:full', this.state);
        } catch(err) {}
      }
    });
  }

  loadState() {
    try {
      const saved = localStorage.getItem('osrs-goose-state');
      if (saved) {
        this.state = JSON.parse(saved);
        // Ensure all fields exist
        this.state.tiles = this.state.tiles || generateDefaultTiles();
        this.state.teams = this.state.teams || [];
        this.state.currentTeamIndex = this.state.currentTeamIndex || 0;
        this.state.gameStarted = this.state.gameStarted || false;
        this.state.gamePaused = this.state.gamePaused || false;
        this.state.lastRoll = this.state.lastRoll ?? null;
        this.state.history = this.state.history || [];
        this.state.settings = this.state.settings || { boardName: 'OSRS Game of Goose', exactFinish: true, diceCount: 2 };
        return;
      }
    } catch(e) {}

    // Default state
    this.state = {
      tiles: generateDefaultTiles(),
      teams: [],
      currentTeamIndex: 0,
      gameStarted: false,
      gamePaused: false,
      lastRoll: null,
      history: [],
      settings: {
        boardName: 'OSRS Game of Goose',
        exactFinish: true,
        diceCount: 2,
      },
    };
    this._saveToStorage();
  }

  // ── Event System ─────────────────────────────────────────────
  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  _notify(event, payload) {
    this.listeners.forEach(l => {
      if (l.event === event || l.event === '*') {
        l.callback(payload || this.state);
      }
    });
  }

  _broadcast(event, payload) {
    this._saveToStorage();
    this.channel.postMessage({
      type: 'state:update',
      state: this.state,
      event,
      payload,
    });
    this._notify(event, payload || this.state);
  }

  _saveToStorage() {
    try {
      localStorage.setItem('osrs-goose-state', JSON.stringify(this.state));
    } catch(e) {}
  }

  getFullState() {
    return { ...this.state, tileTypes: TILE_TYPES };
  }

  // ── Team Management ──────────────────────────────────────────
  addTeam(name, color) {
    if (this.state.teams.length >= 8) return null;
    const team = {
      id: 'team-' + Date.now(),
      name: name || `Team ${this.state.teams.length + 1}`,
      color: color || TEAM_COLORS[this.state.teams.length] || '#888',
      position: 0,
      skipTurns: 0,
      isTrapped: false,
      trapType: null,
      finished: false,
      finishOrder: null,
    };
    this.state.teams.push(team);
    this._addHistory('system', `${team.name} joined the game!`);
    this._broadcast('state:full');
    return team;
  }

  removeTeam(teamId) {
    const team = this.state.teams.find(t => t.id === teamId);
    this.state.teams = this.state.teams.filter(t => t.id !== teamId);
    if (this.state.currentTeamIndex >= this.state.teams.length) {
      this.state.currentTeamIndex = 0;
    }
    if (team) this._addHistory('system', `${team.name} removed from the game.`);
    this._broadcast('state:full');
  }

  // ── Game Control ─────────────────────────────────────────────
  startGame() {
    this.state.gameStarted = true;
    this.state.gamePaused = false;
    this.state.currentTeamIndex = 0;
    this._addHistory('system', 'Game started!');
    this._broadcast('state:full');
  }

  pauseGame() {
    this.state.gamePaused = !this.state.gamePaused;
    this._addHistory('system', this.state.gamePaused ? 'Game paused.' : 'Game resumed.');
    this._broadcast('state:full');
  }

  resetGame() {
    this.state.teams.forEach(t => {
      t.position = 0; t.skipTurns = 0; t.isTrapped = false;
      t.trapType = null; t.finished = false; t.finishOrder = null;
    });
    this.state.currentTeamIndex = 0;
    this.state.gameStarted = false;
    this.state.gamePaused = false;
    this.state.lastRoll = null;
    this.state.history = [];
    this._addHistory('system', 'Game reset!');
    this._broadcast('state:full');
  }

  // ── Dice Roll ────────────────────────────────────────────────
  rollDice() {
    if (!this.state.gameStarted || this.state.gamePaused) return null;
    const team = this.state.teams[this.state.currentTeamIndex];
    if (!team || team.finished) return null;

    // Prison check must come before skipTurns so teams can attempt to roll
    // doubles each turn. skipTurns counts remaining escape attempts.
    if (team.isTrapped && team.trapType === 'prison') {
      const dice = this._throwDice();
      const isDoubles = dice.length === 2 && dice[0] === dice[1];
      if (isDoubles) {
        team.isTrapped = false;
        team.trapType = null;
        team.skipTurns = 0;
        const total = dice.reduce((a, b) => a + b, 0);
        this._addHistory(team.id, `${team.name} rolled doubles (${dice[0]}+${dice[1]})! Escaped prison!`);
        const result = this._moveTeam(team, total, dice);
        this._broadcast('dice:result', { dice, total, teamId: team.id, escaped: true, moveResult: result });
        return result;
      } else {
        team.skipTurns = Math.max(0, team.skipTurns - 1);
        if (team.skipTurns === 0) {
          team.isTrapped = false;
          team.trapType = null;
          this._addHistory(team.id, `${team.name} rolled ${dice[0]}+${dice[1]} — sentence served, released from prison!`);
        } else {
          this._addHistory(team.id, `${team.name} rolled ${dice[0]}+${dice[1]} — not doubles! ${team.skipTurns} attempt(s) left.`);
        }
        this._advanceToNextTeam();
        this._broadcast('dice:result', { dice, total: dice.reduce((a, b) => a + b, 0), teamId: team.id, prison: true });
        return { prison: true, dice, team };
      }
    }

    // Skip turns (inn, well, etc.)
    if (team.skipTurns > 0) {
      team.skipTurns--;
      const msg = `${team.name} skips this turn! (${team.skipTurns} remaining)`;
      this._addHistory(team.id, msg);
      this._advanceToNextTeam();
      this._broadcast('turn:skipped', { team, message: msg });
      return { skipped: true, team, message: msg };
    }

    // Normal roll
    const dice = this._throwDice();
    const total = dice.reduce((a, b) => a + b, 0);
    this.state.lastRoll = { dice, total, teamId: team.id };
    this._addHistory(team.id, `${team.name} rolled ${dice.join(' + ')} = ${total}`);
    const result = this._moveTeam(team, total, dice);

    this._broadcast('dice:result', { dice, total, teamId: team.id, moveResult: result });
    return result;
  }

  _throwDice() {
    const count = this.state.settings.diceCount || 2;
    return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
  }

  _moveTeam(team, steps, dice) {
    const fromPos = team.position;
    let newPos = fromPos + steps;

    if (this.state.settings.exactFinish && newPos > 63) {
      newPos = 63 - (newPos - 63);
      this._addHistory(team.id, `${team.name} overshot! Bounced back to tile ${newPos}.`);
    }
    newPos = Math.max(0, Math.min(63, newPos));

    // Build path
    const path = [];
    if (newPos >= fromPos) {
      for (let i = fromPos; i <= newPos; i++) path.push(i);
    } else {
      for (let i = fromPos; i <= 63; i++) path.push(i);
      for (let i = 63; i >= newPos; i--) path.push(i);
    }

    team.position = newPos;
    this._addHistory(team.id, `${team.name} moved to tile ${newPos} — ${this.state.tiles[newPos].name}`);

    // Special tile
    const tile = this.state.tiles[newPos];
    let specialResult = null;
    if (tile.special) {
      specialResult = this._handleSpecial(team, tile, steps);
    }

    // Finish check
    if (newPos === 63 && !team.finished) {
      const finishedCount = this.state.teams.filter(t => t.finished).length;
      team.finished = true;
      team.finishOrder = finishedCount + 1;
      this._addHistory(team.id, `🏆 ${team.name} FINISHED in position #${team.finishOrder}!`);
    }

    if (!specialResult || !specialResult.rollAgain) {
      this._advanceToNextTeam();
    }

    return { team, dice, total: steps, from: fromPos, to: newPos, path, tile, specialResult };
  }

  _handleSpecial(team, tile, steps) {
    const s = tile.special;
    switch (s.action) {
      case 'roll_again':
        this._addHistory(team.id, `🦢 ${team.name} landed on Lucky tile! Roll again!`);
        return { rollAgain: true, message: 'Lucky! Roll again!' };
      case 'jump':
        team.position = s.target;
        this._addHistory(team.id, `🌉 ${team.name} crossed the bridge to tile ${s.target}!`);
        return { jumped: true, target: s.target };
      case 'skip_turns':
        team.skipTurns = s.turns;
        this._addHistory(team.id, `🍺 ${team.name} rests! Skip ${s.turns} turn(s).`);
        return { skip: true, turns: s.turns };
      case 'go_back':
        team.position = s.target;
        this._addHistory(team.id, `🔄 ${team.name} sent back to tile ${s.target}!`);
        return { goBack: true, target: s.target };
      case 'prison':
        team.isTrapped = true;
        team.trapType = 'prison';
        team.skipTurns = s.turns;
        this._addHistory(team.id, `🔒 ${team.name} is in prison! Roll doubles to escape!`);
        return { prison: true };
      default: return null;
    }
  }

  // ── Admin Controls ───────────────────────────────────────────
  setTeamPosition(teamId, position) {
    const team = this.state.teams.find(t => t.id === teamId);
    if (!team) return;
    const oldPos = team.position;
    team.position = Math.max(0, Math.min(63, position));
    team.isTrapped = false; team.trapType = null; team.skipTurns = 0;
    if (position === 63 && !team.finished) {
      team.finished = true;
      team.finishOrder = this.state.teams.filter(t => t.finished).length;
    } else if (position !== 63) {
      team.finished = false; team.finishOrder = null;
    }
    this._addHistory(team.id, `Admin moved ${team.name} from tile ${oldPos} to tile ${position}.`);
    this._broadcast('state:full');
  }

  setCurrentTeam(index) {
    if (index >= 0 && index < this.state.teams.length) {
      this.state.currentTeamIndex = index;
      this._broadcast('state:full');
    }
  }

  nextTeam() {
    this._advanceToNextTeam();
    this._broadcast('state:full');
  }

  updateTile(tileId, updates) {
    const tile = this.state.tiles.find(t => t.id === tileId);
    if (!tile) return;
    if (updates.type && TILE_TYPES[updates.type]) {
      tile.type = updates.type;
      if (!updates.color) tile.color = TILE_TYPES[updates.type].color;
      if (!updates.icon) tile.icon = TILE_TYPES[updates.type].icon;
      if (updates.special === undefined) tile.special = getSpecialEffect(updates.type);
    }
    if (updates.name !== undefined) tile.name = updates.name;
    if (updates.icon !== undefined) tile.icon = updates.icon;
    if (updates.challenge !== undefined) tile.challenge = updates.challenge;
    if (updates.color !== undefined) tile.color = updates.color;
    if (updates.special !== undefined) tile.special = updates.special;
    this._broadcast('tile:updated', tile);
  }

  updateSettings(settings) {
    Object.assign(this.state.settings, settings);
    this._broadcast('state:full');
  }

  _advanceToNextTeam() {
    if (this.state.teams.length === 0) return;
    const active = this.state.teams.filter(t => !t.finished);
    if (active.length === 0) {
      this._addHistory('system', 'All teams have finished! Game over!');
      this.state.gameStarted = false;
      return;
    }
    let next = (this.state.currentTeamIndex + 1) % this.state.teams.length;
    let attempts = 0;
    while (this.state.teams[next].finished && attempts < this.state.teams.length) {
      next = (next + 1) % this.state.teams.length;
      attempts++;
    }
    this.state.currentTeamIndex = next;
  }

  _addHistory(source, message) {
    this.state.history.push({ timestamp: Date.now(), source, message });
    if (this.state.history.length > 200) this.state.history = this.state.history.slice(-200);
  }
}
