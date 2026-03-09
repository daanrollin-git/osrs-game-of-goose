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

function getDefaultSpecialEffect(type) {
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

function createDefaultTiles() {
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
    { type: 'wilderness', name: 'Green Dragon Hunt',   challenge: 'Kill 5 Green Dragons in the Wilderness and bank the hides.' },
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
    { type: 'wilderness', name: 'Revenant Hunter',     challenge: 'Kill any 3 Revenants in the Revenant Caves.' },
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
    { type: 'quest',      name: 'Recipe for Disaster', challenge: 'Complete any RFD subquest not yet done (or buy barrows gloves if done).' },
    { type: 'prison',     name: 'Port Sarim Jail',     challenge: 'Locked up! Skip 3 turns OR roll doubles on your next roll to escape.' },
    { type: 'combat',     name: 'Demon Destroyer',     challenge: 'Kill 30 Black Demons in Taverley Dungeon or Catacombs.' },
    { type: 'goose',      name: 'Lucky Totem',         challenge: 'Lucky tile! Roll again and move forward by that amount too!' },
    { type: 'boss',       name: 'Corp Beast',          challenge: 'Get 1 Corporeal Beast kill as a team.' },
    { type: 'wilderness', name: 'Wildy Diary',         challenge: 'Complete any 1 task from the Wilderness Achievement Diary.' },
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
      special: getDefaultSpecialEffect(def.type),
    };
  });
}

function throwDice(count = 2) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

function resolveMove(team, steps, tiles, settings = {}) {
  const exactFinish = settings.exactFinish !== false; // default true
  const fromPos = team.position;
  let newPos = fromPos + steps;

  if (exactFinish && newPos > 63) {
    const overshoot = newPos - 63;
    newPos = 63 - overshoot;
  }
  newPos = Math.max(0, Math.min(63, newPos));

  const path = [];
  if (newPos >= fromPos) {
    for (let i = fromPos; i <= newPos; i++) path.push(i);
  } else {
    for (let i = fromPos; i <= 63; i++) path.push(i);
    for (let i = 62; i >= newPos; i--) path.push(i);
  }

  return { newPosition: newPos, path, tile: tiles[newPos] };
}

/**
 * Applies a tile's special effect. NOTE: mutates `team.position` for jump/go_back actions.
 * Always pass a copy of the team object: applySpecialEffect(special, { position: team.position })
 * @param {object|null} special - The tile's special effect config
 * @param {object} team - Mutable team object (only .position is read/written)
 * @returns {object|null} Effect result descriptor
 */
function applySpecialEffect(special, team) {
  if (!special) return null;
  switch (special.action) {
    case 'roll_again':
      return { rollAgain: true };
    case 'jump':
      team.position = special.target;
      return { jumped: true, target: special.target };
    case 'skip_turns':
      return { skipTurns: special.turns };
    case 'go_back':
      team.position = special.target;
      return { goBack: true, target: special.target };
    case 'prison':
      return { prison: true, turns: special.turns };
    default:
      return null;
  }
}

module.exports = { createDefaultTiles, throwDice, resolveMove, applySpecialEffect, TILE_TYPES };
