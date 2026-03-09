# Event Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the local-only Game of Goose into a multi-team race event platform with Discord OAuth, real-time board, Discord bot screenshot submission, and AI-powered challenge verification.

**Architecture:** Express monolith + discord.js bot (co-located). PostgreSQL via Prisma for persistent state. Socket.io for real-time board updates replacing BroadcastChannel. Claude Haiku (vision) for AI screenshot verification.

**Tech Stack:** Node.js, Express, Prisma, PostgreSQL, Socket.io, discord.js v14, @anthropic-ai/sdk, passport-discord, express-session, Jest, supertest

**Design doc:** `docs/plans/2026-03-09-event-platform-design.md`

---

## Phase 1: Foundation & Database

### Task 1: Install Dependencies & Environment Setup

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `.gitignore` (ensure `.env` is listed)

**Step 1: Install all packages**

```bash
npm install prisma @prisma/client socket.io express-session connect-pg-simple passport passport-discord discord.js @anthropic-ai/sdk multer dotenv nodemon
npm install --save-dev jest supertest @types/jest
```

**Step 2: Add scripts to package.json**

Replace `"scripts"` block with:
```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "bot": "node bot/index.js",
  "test": "jest --runInBand",
  "db:migrate": "prisma migrate dev",
  "db:push": "prisma db push",
  "db:studio": "prisma studio"
}
```

**Step 3: Create `.env.example`**

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/osrs_goose"

# Discord OAuth (https://discord.com/developers/applications)
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token

# Anthropic (https://console.anthropic.com)
ANTHROPIC_API_KEY=your_api_key

# Session
SESSION_SECRET=change_this_to_a_random_string_in_production

# App
BASE_URL=http://localhost:3000
PORT=3000
```

**Step 4: Copy to `.env` and fill in values**

```bash
cp .env.example .env
```

**Step 5: Ensure `.env` is in `.gitignore`**

Create `.gitignore` if missing:
```
.env
node_modules/
```

**Step 6: Commit**

```bash
git add package.json .env.example .gitignore
git commit -m "chore: add dependencies and env setup"
```

---

### Task 2: Prisma Schema

**Files:**
- Create: `prisma/schema.prisma`

**Step 1: Initialise Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

**Step 2: Replace `prisma/schema.prisma` with full schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  event_organiser
  event_admin
  moderator
  captain
}

enum EventStatus {
  setup
  registration
  active
  finished
}

enum TeamStatus {
  unlocked
  locked
  pending
  finished
}

enum SubmissionVerdict {
  pending
  auto_approved
  approved
  rejected
}

model User {
  id            String   @id @default(cuid())
  discordId     String   @unique
  discordName   String
  discordAvatar String?
  role          Role     @default(captain)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  captainOf     Team[]
  submissions   TileSubmission[]
}

model Event {
  id                  String      @id @default(cuid())
  name                String
  tagword             String
  autoApproveThreshold Int        @default(90)
  status              EventStatus @default(setup)
  tiles               Json        // array of tile objects (same shape as current TILE_TYPES)
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  teams               Team[]

  // Discord channel config
  submitChannelId     String?
  reviewChannelId     String?
  updatesChannelId    String?
}

model Team {
  id          String     @id @default(cuid())
  name        String
  color       String     @default("#6366f1")
  position    Int        @default(0)
  status      TeamStatus @default(unlocked)
  finishOrder Int?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  event       Event      @relation(fields: [eventId], references: [id])
  eventId     String

  captain     User?      @relation(fields: [captainId], references: [id])
  captainId   String?

  submissions TileSubmission[]
}

model TileSubmission {
  id              String            @id @default(cuid())
  tileNumber      Int
  screenshotUrl   String            // URL or file path of screenshot
  aiVerdict       Boolean?
  aiConfidence    Int?              // 0–100
  aiReason        String?
  verdict         SubmissionVerdict @default(pending)
  adminNote       String?
  discordMessageId String?          // message ID in #admin-review for editing
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  team            Team              @relation(fields: [teamId], references: [id])
  teamId          String

  submittedBy     User              @relation(fields: [submittedById], references: [id])
  submittedById   String
}
```

**Step 3: Run migration**

```bash
npm run db:migrate -- --name init
```

Expected output: `✔ Generated Prisma Client`

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add prisma schema with event, team, user, submission models"
```

---

### Task 3: Prisma Client Singleton

**Files:**
- Create: `src/db.js`
- Create: `src/` directory

**Step 1: Create `src/db.js`**

```js
const { PrismaClient } = require('@prisma/client');

const prisma = global.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
```

**Step 2: Write test**

Create `tests/db.test.js`:
```js
const prisma = require('../src/db');

test('prisma client is a singleton', () => {
  const prisma2 = require('../src/db');
  expect(prisma).toBe(prisma2);
});
```

**Step 3: Run test**

```bash
npm test -- tests/db.test.js
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/ tests/
git commit -m "feat: add prisma client singleton"
```

---

## Phase 2: Auth & Sessions

### Task 4: Express Session & Discord OAuth

**Files:**
- Create: `src/auth.js`
- Modify: `server.js`

**Step 1: Write failing test for auth module exports**

Create `tests/auth.test.js`:
```js
const auth = require('../src/auth');
test('auth exports router', () => {
  expect(auth).toBeDefined();
  expect(typeof auth).toBe('function'); // Express router
});
```

**Step 2: Run test — expect FAIL**

```bash
npm test -- tests/auth.test.js
```

Expected: FAIL `Cannot find module '../src/auth'`

**Step 3: Create `src/auth.js`**

```js
require('dotenv').config();
const express = require('express');
const passport = require('passport');
const { Strategy: DiscordStrategy } = require('passport-discord');
const prisma = require('./db');

const router = express.Router();

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI,
  scope: ['identify'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await prisma.user.upsert({
      where: { discordId: profile.id },
      update: { discordName: profile.username, discordAvatar: profile.avatar },
      create: {
        discordId: profile.id,
        discordName: profile.username,
        discordAvatar: profile.avatar,
        // First user ever becomes event_organiser
        role: (await prisma.user.count()) === 0 ? 'event_organiser' : 'captain',
      },
    });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => res.redirect('/dashboard')
);

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    id: req.user.id,
    discordName: req.user.discordName,
    discordAvatar: req.user.discordAvatar,
    role: req.user.role,
  });
});

module.exports = router;
```

**Step 4: Run test — expect PASS**

```bash
npm test -- tests/auth.test.js
```

**Step 5: Wire sessions and auth into `server.js`**

Replace full `server.js` contents:
```js
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const { createServer } = require('http');
const { Server } = require('socket.io');

const authRouter = require('./src/auth');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions (stored in Postgres)
app.use(session({
  store: new PgSession({ conString: process.env.DATABASE_URL }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRouter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Make io accessible in routes
app.set('io', io);

httpServer.listen(PORT, () => {
  console.log(`\n🎲 OSRS Game of Goose running!`);
  console.log(`   Board view:  http://localhost:${PORT}`);
  console.log(`   Admin panel: http://localhost:${PORT}/admin.html\n`);
});

module.exports = { app, io };
```

**Step 6: Commit**

```bash
git add src/auth.js server.js tests/auth.test.js
git commit -m "feat: add discord oauth and session middleware"
```

---

### Task 5: Role Middleware

**Files:**
- Create: `src/middleware/requireAuth.js`
- Create: `src/middleware/requireRole.js`

**Step 1: Write failing tests**

Create `tests/middleware.test.js`:
```js
const { requireAuth, requireRole } = require('../src/middleware/requireAuth');

test('requireAuth redirects unauthenticated user', () => {
  const req = { isAuthenticated: () => false };
  const res = { redirect: jest.fn() };
  const next = jest.fn();
  requireAuth(req, res, next);
  expect(res.redirect).toHaveBeenCalledWith('/login');
  expect(next).not.toHaveBeenCalled();
});

test('requireAuth calls next for authenticated user', () => {
  const req = { isAuthenticated: () => true };
  const res = {};
  const next = jest.fn();
  requireAuth(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('requireRole blocks insufficient role', () => {
  const req = { isAuthenticated: () => true, user: { role: 'captain' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  requireRole(['event_organiser'])(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
});

test('requireRole allows sufficient role', () => {
  const req = { isAuthenticated: () => true, user: { role: 'event_organiser' } };
  const res = {};
  const next = jest.fn();
  requireRole(['event_organiser', 'event_admin'])(req, res, next);
  expect(next).toHaveBeenCalled();
});
```

**Step 2: Run tests — expect FAIL**

```bash
npm test -- tests/middleware.test.js
```

**Step 3: Create `src/middleware/requireAuth.js`**

```js
const ROLE_HIERARCHY = ['captain', 'moderator', 'event_admin', 'event_organiser'];

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, ROLE_HIERARCHY };
```

**Step 4: Run tests — expect PASS**

```bash
npm test -- tests/middleware.test.js
```

**Step 5: Commit**

```bash
git add src/middleware/ tests/middleware.test.js
git commit -m "feat: add role-based auth middleware"
```

---

## Phase 3: Server-Side Game Engine

### Task 6: Game Engine — Core Logic

The existing `GooseGame` class in `public/js/gameState.js` runs client-side. We extract a pure server-side version.

**Files:**
- Create: `src/gameEngine.js`

**Step 1: Write failing tests**

Create `tests/gameEngine.test.js`:
```js
const { createDefaultTiles, resolveMove, applySpecialEffect } = require('../src/gameEngine');

test('createDefaultTiles returns 64 tiles', () => {
  const tiles = createDefaultTiles();
  expect(tiles).toHaveLength(64);
  expect(tiles[0].type).toBe('start');
  expect(tiles[63].type).toBe('finish');
});

test('resolveMove advances position correctly', () => {
  const result = resolveMove({ position: 5 }, 3, tiles);
  expect(result.newPosition).toBe(8);
  expect(result.path).toEqual([5, 6, 7, 8]);
});

test('resolveMove bounces back on exact finish overshoot', () => {
  const result = resolveMove({ position: 61 }, 5, tiles, { exactFinish: true });
  // 61 + 5 = 66, overshoots by 3, bounces to 60
  expect(result.newPosition).toBe(60);
});

test('applySpecialEffect handles roll_again', () => {
  const effect = applySpecialEffect({ action: 'roll_again' }, {});
  expect(effect.rollAgain).toBe(true);
});

test('applySpecialEffect handles jump', () => {
  const team = { position: 5 };
  const effect = applySpecialEffect({ action: 'jump', target: 12 }, team);
  expect(team.position).toBe(12);
  expect(effect.jumped).toBe(true);
});

const tiles = createDefaultTiles();
```

**Step 2: Run tests — expect FAIL**

```bash
npm test -- tests/gameEngine.test.js
```

**Step 3: Create `src/gameEngine.js`**

```js
// Tile type definitions — mirrors public/js/gameState.js TILE_TYPES
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

function resolveMove(team, steps, tiles, settings = { exactFinish: true }) {
  const fromPos = team.position;
  let newPos = fromPos + steps;

  if (settings.exactFinish && newPos > 63) {
    newPos = 63 - (newPos - 63);
  }
  newPos = Math.max(0, Math.min(63, newPos));

  const path = [];
  if (newPos >= fromPos) {
    for (let i = fromPos; i <= newPos; i++) path.push(i);
  } else {
    for (let i = fromPos; i <= 63; i++) path.push(i);
    for (let i = 63; i >= newPos; i--) path.push(i);
  }

  return { newPosition: newPos, path, tile: tiles[newPos] };
}

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
```

**Step 4: Run tests — expect PASS**

```bash
npm test -- tests/gameEngine.test.js
```

**Step 5: Commit**

```bash
git add src/gameEngine.js tests/gameEngine.test.js
git commit -m "feat: add server-side game engine"
```

---

### Task 7: Game API Routes

**Files:**
- Create: `src/routes/events.js`
- Create: `src/routes/teams.js`
- Modify: `server.js`

**Step 1: Write failing tests**

Create `tests/routes/events.test.js`:
```js
const request = require('supertest');
const { app } = require('../../server');

test('GET /api/events returns 200', async () => {
  const res = await request(app).get('/api/events');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});
```

**Step 2: Run test — expect FAIL**

```bash
npm test -- tests/routes/events.test.js
```

**Step 3: Create `src/routes/events.js`**

```js
const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/requireAuth');
const { createDefaultTiles } = require('../gameEngine');

const router = express.Router();

// GET /api/events — list all events
router.get('/', async (req, res) => {
  const events = await prisma.event.findMany({
    select: { id: true, name: true, status: true, tagword: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(events);
});

// GET /api/events/:id — full event with teams
router.get('/:id', async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { teams: { include: { captain: { select: { discordName: true, discordId: true } } } } },
  });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
});

// POST /api/events — create event (event_organiser only)
router.post('/', requireAuth, requireRole(['event_organiser']), async (req, res) => {
  const { name, tagword, autoApproveThreshold } = req.body;
  const event = await prisma.event.create({
    data: {
      name,
      tagword,
      autoApproveThreshold: autoApproveThreshold ?? 90,
      tiles: createDefaultTiles(),
    },
  });
  res.status(201).json(event);
});

// PATCH /api/events/:id — update event settings
router.patch('/:id', requireAuth, requireRole(['event_organiser']), async (req, res) => {
  const { name, tagword, autoApproveThreshold, status, tiles,
          submitChannelId, reviewChannelId, updatesChannelId } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (tagword !== undefined) data.tagword = tagword;
  if (autoApproveThreshold !== undefined) data.autoApproveThreshold = autoApproveThreshold;
  if (status !== undefined) data.status = status;
  if (tiles !== undefined) data.tiles = tiles;
  if (submitChannelId !== undefined) data.submitChannelId = submitChannelId;
  if (reviewChannelId !== undefined) data.reviewChannelId = reviewChannelId;
  if (updatesChannelId !== undefined) data.updatesChannelId = updatesChannelId;

  const event = await prisma.event.update({ where: { id: req.params.id }, data });
  req.app.get('io').emit('event:updated', event);
  res.json(event);
});

module.exports = router;
```

**Step 4: Create `src/routes/teams.js`**

```js
const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/requireAuth');
const { throwDice, resolveMove, applySpecialEffect } = require('../gameEngine');

const router = express.Router();

// POST /api/events/:eventId/teams — add team
router.post('/:eventId/teams', requireAuth, requireRole(['event_organiser', 'event_admin']), async (req, res) => {
  const { name, color } = req.body;
  const team = await prisma.team.create({
    data: { name, color: color || '#6366f1', eventId: req.params.eventId },
  });
  const io = req.app.get('io');
  io.emit('team:added', team);
  res.status(201).json(team);
});

// POST /api/teams/:id/roll — captain rolls dice
router.post('/:id/roll', requireAuth, async (req, res) => {
  const team = await prisma.team.findUnique({
    where: { id: req.params.id },
    include: { event: true },
  });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (team.status !== 'unlocked') return res.status(400).json({ error: 'Team is locked' });

  // Only captain or event_admin+ can roll
  const isCaptain = team.captainId === req.user.id;
  const isAdmin = ['event_organiser', 'event_admin'].includes(req.user.role);
  if (!isCaptain && !isAdmin) return res.status(403).json({ error: 'Only the captain can roll' });

  const tiles = team.event.tiles;
  const diceCount = team.event.settings?.diceCount ?? 2;
  const dice = throwDice(diceCount);
  const total = dice.reduce((a, b) => a + b, 0);
  const { newPosition, path, tile } = resolveMove(
    { position: team.position }, total, tiles,
    { exactFinish: team.event.settings?.exactFinish ?? true }
  );

  const specialEffect = applySpecialEffect(tile.special, { position: newPosition });
  const newStatus = tile.type === 'goose' ? 'unlocked' : 'locked';
  const finalPosition = specialEffect?.jumped || specialEffect?.goBack
    ? (tile.special.target ?? newPosition)
    : newPosition;

  const updated = await prisma.team.update({
    where: { id: team.id },
    data: { position: finalPosition, status: newStatus },
  });

  const io = req.app.get('io');
  io.emit('team:rolled', { team: updated, dice, total, path, tile, specialEffect });
  res.json({ team: updated, dice, total, path, tile, specialEffect });
});

// PATCH /api/teams/:id — admin force-update team
router.patch('/:id', requireAuth, requireRole(['event_organiser', 'event_admin']), async (req, res) => {
  const { position, status, captainId } = req.body;
  const data = {};
  if (position !== undefined) data.position = position;
  if (status !== undefined) data.status = status;
  if (captainId !== undefined) data.captainId = captainId;

  const team = await prisma.team.update({ where: { id: req.params.id }, data });
  req.app.get('io').emit('team:updated', team);
  res.json(team);
});

// POST /api/teams/:id/claim-captain — logged in user claims captain slot
router.post('/:id/claim-captain', requireAuth, async (req, res) => {
  const team = await prisma.team.findUnique({ where: { id: req.params.id } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (team.captainId) return res.status(409).json({ error: 'Team already has a captain' });

  const updated = await prisma.team.update({
    where: { id: req.params.id },
    data: { captainId: req.user.id },
  });
  res.json(updated);
});

module.exports = router;
```

**Step 5: Wire routes into `server.js`** — add after the auth router line:

```js
const eventsRouter = require('./src/routes/events');
const teamsRouter = require('./src/routes/teams');

app.use('/api/events', eventsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/events', teamsRouter); // for /:eventId/teams
```

**Step 6: Run test — expect PASS**

```bash
npm test -- tests/routes/events.test.js
```

**Step 7: Commit**

```bash
git add src/routes/ server.js tests/routes/
git commit -m "feat: add event and team API routes"
```

---

## Phase 4: Discord Bot

### Task 8: Bot Setup

**Files:**
- Create: `bot/index.js`
- Create: `bot/client.js`

**Step 1: Create `bot/client.js`**

```js
require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

module.exports = client;
```

**Step 2: Create `bot/index.js`**

```js
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const client = require('./client');

const commands = [
  new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit proof for your current tile challenge')
    .addIntegerOption(o => o.setName('tile').setDescription('Tile number').setRequired(true))
    .addAttachmentOption(o => o.setName('screenshot').setDescription('Screenshot of completion').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll the dice for your team (captain only)')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('Show your team\'s current challenge')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show standings for the active event')
    .toJSON(),
];

client.once('ready', async () => {
  console.log(`Bot online as ${client.user.tag}`);
  const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );
  console.log('Slash commands registered');
});

// Import handlers
require('./handlers/submit')(client);
require('./handlers/roll')(client);
require('./handlers/challenge')(client);
require('./handlers/status')(client);

client.login(process.env.DISCORD_BOT_TOKEN);
```

**Step 3: Commit**

```bash
git add bot/
git commit -m "feat: add discord bot skeleton with slash commands"
```

---

### Task 9: /submit Command Handler

**Files:**
- Create: `bot/handlers/submit.js`
- Create: `bot/helpers/teamLookup.js`

**Step 1: Create `bot/helpers/teamLookup.js`**

```js
const prisma = require('../../src/db');

// Find the active event's team that has this Discord user as captain,
// OR any team member (captains are the only registered users, others submit by being in the same guild)
async function findTeamForUser(discordId) {
  const user = await prisma.user.findUnique({ where: { discordId } });
  if (!user) return null;

  // Find their team in the active event
  const team = await prisma.team.findFirst({
    where: {
      captainId: user.id,
      event: { status: 'active' },
    },
    include: { event: true },
  });
  return team;
}

module.exports = { findTeamForUser };
```

**Step 2: Create `bot/handlers/submit.js`**

```js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const prisma = require('../../src/db');
const { findTeamForUser } = require('../helpers/teamLookup');
const { analyzeScreenshot } = require('../../src/ai/verifier');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'submit') return;

    await interaction.deferReply({ ephemeral: true });

    const tileNumber = interaction.options.getInteger('tile');
    const attachment = interaction.options.getAttachment('screenshot');

    // Find submitting user in DB (create if first time)
    let user = await prisma.user.upsert({
      where: { discordId: interaction.user.id },
      update: { discordName: interaction.user.username },
      create: {
        discordId: interaction.user.id,
        discordName: interaction.user.username,
        discordAvatar: interaction.user.avatar,
        role: 'captain',
      },
    });

    // Find active team for this user via active event
    const team = await findTeamForUser(interaction.user.id);
    if (!team) {
      return interaction.editReply('❌ You are not registered as a captain in any active event.');
    }

    // Validate tile number matches team's locked position
    if (team.position !== tileNumber) {
      return interaction.editReply(
        `❌ Your team is on tile **${team.position}**, not tile ${tileNumber}. Please use \`/submit ${team.position}\`.`
      );
    }

    if (team.status !== 'locked') {
      return interaction.editReply('❌ Your team is not currently locked on a tile. Roll first!');
    }

    // Run AI verification
    const aiResult = await analyzeScreenshot({
      screenshotUrl: attachment.url,
      challengeText: team.event.tiles[tileNumber].challenge,
      tagword: team.event.tagword,
    });

    // Save submission
    const submission = await prisma.tileSubmission.create({
      data: {
        tileNumber,
        screenshotUrl: attachment.url,
        aiVerdict: aiResult.pass,
        aiConfidence: aiResult.confidence,
        aiReason: aiResult.reason,
        verdict: 'pending',
        teamId: team.id,
        submittedById: user.id,
      },
    });

    // Auto-approve if confidence is high enough
    if (aiResult.pass && aiResult.confidence >= team.event.autoApproveThreshold) {
      await prisma.tileSubmission.update({
        where: { id: submission.id },
        data: { verdict: 'auto_approved' },
      });
      await prisma.team.update({
        where: { id: team.id },
        data: { status: 'unlocked' },
      });

      // Notify updates channel
      if (team.event.updatesChannelId) {
        const ch = await client.channels.fetch(team.event.updatesChannelId);
        ch?.send(`✅ **${team.name}** completed tile **${tileNumber}** — auto-approved! (${aiResult.confidence}% confidence)`);
      }

      return interaction.editReply(`✅ Auto-approved! Your team is unlocked and can roll again.`);
    }

    // Post to admin review channel
    if (team.event.reviewChannelId) {
      const reviewChannel = await client.channels.fetch(team.event.reviewChannelId);
      const embed = new EmbedBuilder()
        .setTitle(`📋 Submission: ${team.name} — Tile ${tileNumber}`)
        .setDescription(team.event.tiles[tileNumber].challenge)
        .addFields(
          { name: 'AI Verdict', value: aiResult.pass ? '✅ PASS' : '❌ FAIL', inline: true },
          { name: 'Confidence', value: `${aiResult.confidence}%`, inline: true },
          { name: 'AI Reason', value: aiResult.reason },
        )
        .setImage(attachment.url)
        .setColor(aiResult.pass ? 0x22c55e : 0xef4444);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve:${submission.id}`)
          .setLabel('Approve')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject:${submission.id}`)
          .setLabel('Reject')
          .setStyle(ButtonStyle.Danger),
      );

      const msg = await reviewChannel.send({ embeds: [embed], components: [row] });
      await prisma.tileSubmission.update({
        where: { id: submission.id },
        data: { discordMessageId: msg.id },
      });
    }

    await prisma.team.update({ where: { id: team.id }, data: { status: 'pending' } });
    interaction.editReply('📤 Screenshot submitted! Awaiting admin review.');
  });

  // Handle Approve/Reject button clicks
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const [action, submissionId] = interaction.customId.split(':');
    if (!['approve', 'reject'].includes(action)) return;

    const submission = await prisma.tileSubmission.findUnique({
      where: { id: submissionId },
      include: { team: { include: { event: true } } },
    });
    if (!submission) return interaction.reply({ content: 'Submission not found.', ephemeral: true });

    if (action === 'approve') {
      await prisma.tileSubmission.update({ where: { id: submissionId }, data: { verdict: 'approved' } });
      await prisma.team.update({ where: { id: submission.teamId }, data: { status: 'unlocked' } });

      if (submission.team.event.updatesChannelId) {
        const ch = await client.channels.fetch(submission.team.event.updatesChannelId);
        ch?.send(`✅ **${submission.team.name}** completed tile **${submission.tileNumber}** — approved by admin!`);
      }
      await interaction.update({ content: '✅ Approved!', components: [] });
    } else {
      await prisma.tileSubmission.update({ where: { id: submissionId }, data: { verdict: 'rejected' } });
      await prisma.team.update({ where: { id: submission.teamId }, data: { status: 'locked' } });
      await interaction.update({ content: '❌ Rejected. Team notified to resubmit.', components: [] });
    }
  });
};
```

**Step 3: Commit**

```bash
git add bot/handlers/submit.js bot/helpers/
git commit -m "feat: add /submit discord command with AI verification and admin approval"
```

---

### Task 10: /roll, /challenge, /status Handlers

**Files:**
- Create: `bot/handlers/roll.js`
- Create: `bot/handlers/challenge.js`
- Create: `bot/handlers/status.js`

**Step 1: Create `bot/handlers/roll.js`**

```js
const prisma = require('../../src/db');
const { findTeamForUser } = require('../helpers/teamLookup');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'roll') return;
    await interaction.deferReply();

    const team = await findTeamForUser(interaction.user.id);
    if (!team) return interaction.editReply('❌ You are not registered as a captain.');
    if (team.status !== 'unlocked') return interaction.editReply(`❌ **${team.name}** is currently locked (status: ${team.status}).`);

    // Call internal API to roll
    const res = await fetch(`${process.env.BASE_URL}/api/teams/${team.id}/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': process.env.BOT_API_SECRET },
    });
    const data = await res.json();
    if (!res.ok) return interaction.editReply(`❌ ${data.error}`);

    const { dice, total, tile } = data;
    interaction.editReply(
      `🎲 **${team.name}** rolled **${dice.join(' + ')} = ${total}**\n` +
      `📍 Landed on tile **${data.team.position}** — ${tile.icon} **${tile.name}**\n` +
      `📋 Challenge: ${tile.challenge}`
    );
  });
};
```

**Step 2: Create `bot/handlers/challenge.js`**

```js
const { findTeamForUser } = require('../helpers/teamLookup');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'challenge') return;

    const team = await findTeamForUser(interaction.user.id);
    if (!team) return interaction.reply({ content: '❌ You are not a registered captain.', ephemeral: true });

    const tile = team.event.tiles[team.position];
    interaction.reply({
      content: `${tile.icon} **${tile.name}** (Tile ${team.position})\n${tile.challenge}\nTeam status: **${team.status}**`,
      ephemeral: true,
    });
  });
};
```

**Step 3: Create `bot/handlers/status.js`**

```js
const prisma = require('../../src/db');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'status') return;

    const event = await prisma.event.findFirst({
      where: { status: 'active' },
      include: { teams: { orderBy: { position: 'desc' } } },
    });

    if (!event) return interaction.reply({ content: 'No active event.', ephemeral: true });

    const statusEmoji = { unlocked: '🔓', locked: '🔒', pending: '⏳', finished: '🏆' };
    const lines = event.teams.map(t =>
      `${statusEmoji[t.status] || '❓'} **${t.name}** — Tile ${t.position}/63`
    );

    interaction.reply({
      content: `**${event.name}** standings:\n${lines.join('\n')}`,
      ephemeral: true,
    });
  });
};
```

**Step 4: Add bot-secret middleware to server for bot→server calls**

In `server.js`, add after auth middleware:
```js
app.use('/api/teams/:id/roll', (req, res, next) => {
  if (req.headers['x-bot-secret'] === process.env.BOT_API_SECRET) {
    req.user = { role: 'event_admin' }; // bot acts as admin for roll
    return next();
  }
  next();
});
```

Add `BOT_API_SECRET=some_random_secret` to `.env.example`.

**Step 5: Commit**

```bash
git add bot/handlers/roll.js bot/handlers/challenge.js bot/handlers/status.js
git commit -m "feat: add /roll, /challenge, /status discord commands"
```

---

## Phase 5: AI Screenshot Verification

### Task 11: Claude Vision Integration

**Files:**
- Create: `src/ai/verifier.js`

**Step 1: Write failing tests**

Create `tests/ai/verifier.test.js`:
```js
jest.mock('@anthropic-ai/sdk');
const { analyzeScreenshot } = require('../../src/ai/verifier');

test('returns structured result object', async () => {
  const Anthropic = require('@anthropic-ai/sdk');
  Anthropic.mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: '{"pass":true,"confidence":95,"reason":"Tagword visible, kill count shown"}' }],
      }),
    },
  }));

  const result = await analyzeScreenshot({
    screenshotUrl: 'https://example.com/screenshot.png',
    challengeText: 'Kill 25 Goblins',
    tagword: 'GOOSE2026',
  });

  expect(result).toEqual({ pass: true, confidence: 95, reason: 'Tagword visible, kill count shown' });
});

test('returns fail result on invalid JSON from AI', async () => {
  const Anthropic = require('@anthropic-ai/sdk');
  Anthropic.mockImplementation(() => ({
    messages: { create: jest.fn().mockResolvedValue({ content: [{ text: 'not json' }] }) },
  }));

  const result = await analyzeScreenshot({ screenshotUrl: '', challengeText: '', tagword: '' });
  expect(result.pass).toBe(false);
  expect(result.confidence).toBe(0);
});
```

**Step 2: Run tests — expect FAIL**

```bash
npm test -- tests/ai/verifier.test.js
```

**Step 3: Create `src/ai/verifier.js`**

```js
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function analyzeScreenshot({ screenshotUrl, challengeText, tagword }) {
  const prompt = `You are verifying a screenshot for an OSRS (Old School RuneScape) clan event.

Challenge: "${challengeText}"
Required tagword (must be visible in the RuneLite overlay): "${tagword}"

Look at this screenshot and determine:
1. Is the tagword "${tagword}" visible anywhere in the screenshot (RuneLite overlay, chat, etc.)?
2. Does the screenshot show evidence of the challenge being completed?

Respond ONLY with valid JSON in this exact format:
{"pass": true/false, "confidence": 0-100, "reason": "brief explanation"}

Be strict: if the tagword is not visible, set pass to false regardless of challenge evidence.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: screenshotUrl } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const text = response.content[0].text.trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('AI verification error:', err.message);
    return { pass: false, confidence: 0, reason: `Verification error: ${err.message}` };
  }
}

module.exports = { analyzeScreenshot };
```

**Step 4: Run tests — expect PASS**

```bash
npm test -- tests/ai/verifier.test.js
```

**Step 5: Commit**

```bash
git add src/ai/ tests/ai/
git commit -m "feat: add claude vision screenshot verification"
```

---

## Phase 6: Web Interface

### Task 12: Replace BroadcastChannel with Socket.io

The existing `public/js/board.js` uses `BroadcastChannel` and `GooseGame` (client-side). Replace the state layer with Socket.io — keep all rendering logic.

**Files:**
- Modify: `public/js/board.js`
- Modify: `public/index.html`

**Step 1: Add Socket.io client to `public/index.html`**

Add before `</body>`:
```html
<script src="/socket.io/socket.io.js"></script>
```

**Step 2: Replace top of `public/js/board.js`**

Remove the `const game = new GooseGame();` line and all `game.on(...)` calls.
Replace with:

```js
const socket = io();
let currentState = null;

socket.on('connect', () => {
  // Request current state on connect
  socket.emit('state:request');
});

socket.on('state:full', (state) => {
  currentState = state;
  refreshAll(state);
});

socket.on('team:rolled', (data) => {
  if (data.dice) {
    animateDice(data.dice, () => {
      if (data.path) {
        animateTokenMovement(data.team.id, data.path, currentState?.teams, () => {
          if (data.tile && data.tile.type !== 'goose') {
            showChallengePopup(data.tile, data.team);
          }
          socket.emit('state:request');
        });
      }
    });
  }
});

socket.on('team:updated', () => socket.emit('state:request'));
socket.on('event:updated', () => socket.emit('state:request'));
```

**Step 3: Update `refreshAll` to accept a `state` parameter instead of calling `game.getFullState()`**

```js
function refreshAll(state) {
  if (!state) return;
  document.getElementById('dice2').style.display =
    (state.settings?.diceCount || 2) === 1 ? 'none' : '';
  renderBoard(state.tiles);
  renderTokens(state.teams, state.currentTeamIndex);
  updateSidePanel(state);
  updateLog(state.history);
}
```

**Step 4: Add Socket.io event emitter in `server.js` for state requests**

```js
io.on('connection', (socket) => {
  socket.on('state:request', async () => {
    const event = await prisma.event.findFirst({
      where: { status: 'active' },
      include: { teams: { include: { captain: { select: { discordName: true } } } } },
    });
    if (event) socket.emit('state:full', event);
  });
});
```

**Step 5: Commit**

```bash
git add public/js/board.js public/index.html server.js
git commit -m "feat: replace BroadcastChannel with socket.io for real-time board"
```

---

### Task 13: Login Page & Auth UI

**Files:**
- Create: `public/login.html`
- Modify: `server.js` (serve login route)

**Step 1: Create `public/login.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — OSRS Game of Goose</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <style>
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .login-card { background:var(--surface); border:1px solid var(--border); border-radius:12px;
                  padding:40px; text-align:center; max-width:360px; width:100%; }
    .login-title { font-size:1.5rem; font-weight:700; margin-bottom:8px; }
    .login-subtitle { color:var(--text-muted); margin-bottom:32px; font-size:0.9rem; }
    .btn-discord { display:inline-flex; align-items:center; gap:10px; background:#5865F2;
                   color:#fff; padding:12px 24px; border-radius:8px; font-weight:600;
                   text-decoration:none; font-size:0.95rem; }
    .btn-discord:hover { background:#4752c4; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="login-title">🎲 OSRS Game of Goose</div>
    <div class="login-subtitle">Log in to manage your team or admin the event</div>
    <a href="/auth/discord" class="btn-discord">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
      </svg>
      Continue with Discord
    </a>
  </div>
</body>
</html>
```

**Step 2: Add login route in `server.js`**

```js
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'public/login.html'));
});
```

**Step 3: Commit**

```bash
git add public/login.html server.js
git commit -m "feat: add login page with discord oauth"
```

---

### Task 14: Captain Dashboard

**Files:**
- Create: `public/dashboard.html`
- Create: `public/js/dashboard.js`
- Create: `public/css/dashboard.css`
- Modify: `server.js`

**Step 1: Add dashboard route to `server.js`**

```js
const { requireAuth } = require('./src/middleware/requireAuth');

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});
```

**Step 2: Create `public/dashboard.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — OSRS Game of Goose</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/dashboard.css">
</head>
<body>
  <header class="header">
    <div class="header-left">
      <span class="logo-text">OSRS Goose</span>
    </div>
    <div class="header-right">
      <span id="userDisplay"></span>
      <a href="/" class="btn-small">Board</a>
      <form action="/auth/logout" method="POST" style="display:inline">
        <button class="btn-small btn-logout" type="submit">Logout</button>
      </form>
    </div>
  </header>

  <main class="dashboard-main">
    <section class="team-card" id="teamCard">
      <div id="noTeam" style="display:none">
        <h2>No team assigned</h2>
        <p>Ask the event organiser to assign you as a captain.</p>
      </div>
      <div id="teamInfo" style="display:none">
        <div class="team-header">
          <div class="team-color-badge" id="teamColorBadge"></div>
          <h2 id="teamNameDisplay"></h2>
          <span class="status-badge" id="statusBadge"></span>
        </div>
        <div class="tile-info" id="tileInfo"></div>
        <div class="dashboard-actions" id="dashboardActions"></div>
      </div>
    </section>

    <section class="standings-card">
      <h3>Standings</h3>
      <div id="dashStandings"></div>
    </section>
  </main>

  <script src="/socket.io/socket.io.js"></script>
  <script src="js/dashboard.js"></script>
</body>
</html>
```

**Step 3: Create `public/js/dashboard.js`**

```js
const socket = io();
let myTeam = null;

async function loadUser() {
  const res = await fetch('/auth/me');
  if (!res.ok) { window.location = '/login'; return; }
  const user = await res.json();
  document.getElementById('userDisplay').textContent = user.discordName;
  return user;
}

async function loadMyTeam() {
  const res = await fetch('/api/my-team');
  if (!res.ok) return null;
  return res.json();
}

function renderDashboard(team, event) {
  if (!team) {
    document.getElementById('noTeam').style.display = '';
    document.getElementById('teamInfo').style.display = 'none';
    return;
  }
  myTeam = team;
  document.getElementById('noTeam').style.display = 'none';
  document.getElementById('teamInfo').style.display = '';

  document.getElementById('teamNameDisplay').textContent = team.name;
  document.getElementById('teamColorBadge').style.background = team.color;

  const statusMap = {
    unlocked: { text: '🔓 Ready to Roll', cls: 'status-unlocked' },
    locked:   { text: '🔒 Challenge Active', cls: 'status-locked' },
    pending:  { text: '⏳ Awaiting Review', cls: 'status-pending' },
    finished: { text: '🏆 Finished!', cls: 'status-finished' },
  };
  const s = statusMap[team.status] || { text: team.status, cls: '' };
  const badge = document.getElementById('statusBadge');
  badge.textContent = s.text;
  badge.className = `status-badge ${s.cls}`;

  if (event) {
    const tile = event.tiles[team.position];
    document.getElementById('tileInfo').innerHTML = `
      <div class="tile-number">Tile ${team.position}/63</div>
      <div class="tile-name">${tile.icon} ${tile.name}</div>
      <div class="tile-challenge">${tile.challenge}</div>
    `;
  }

  const actions = document.getElementById('dashboardActions');
  if (team.status === 'unlocked') {
    actions.innerHTML = `<button class="btn btn-roll" onclick="doRoll()">🎲 Roll Dice</button>`;
  } else if (team.status === 'locked') {
    actions.innerHTML = `<p class="submit-hint">Complete the challenge, then submit via Discord:<br><code>/submit ${team.position} [screenshot]</code></p>`;
  } else if (team.status === 'pending') {
    actions.innerHTML = `<p class="pending-hint">Screenshot submitted — waiting for admin review.</p>`;
  } else {
    actions.innerHTML = '';
  }
}

async function doRoll() {
  if (!myTeam) return;
  const res = await fetch(`/api/teams/${myTeam.id}/roll`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json();
    alert(data.error);
  }
}

async function init() {
  await loadUser();
  const team = await loadMyTeam();

  let event = null;
  if (team) {
    const evRes = await fetch(`/api/events/${team.eventId}`);
    event = await evRes.json();
  }

  renderDashboard(team, event);
}

socket.on('state:full', (event) => {
  if (myTeam) {
    const updated = event.teams.find(t => t.id === myTeam.id);
    if (updated) renderDashboard(updated, event);
  }
});

socket.on('team:rolled', (data) => {
  if (myTeam && data.team.id === myTeam.id) {
    myTeam = data.team;
    // Re-fetch full event for fresh tile data
    init();
  }
});

socket.on('team:updated', () => init());

init();
```

**Step 4: Add `/api/my-team` endpoint to `server.js`**

```js
app.get('/api/my-team', requireAuth, async (req, res) => {
  const team = await prisma.team.findFirst({
    where: { captainId: req.user.id, event: { status: 'active' } },
    include: { event: true },
  });
  if (!team) return res.status(404).json({ error: 'No team found' });
  res.json(team);
});
```

**Step 5: Commit**

```bash
git add public/dashboard.html public/js/dashboard.js public/css/dashboard.css server.js
git commit -m "feat: add captain dashboard with roll button and challenge display"
```

---

### Task 15: Admin Approval Queue

**Files:**
- Modify: `public/admin.html` (add approval queue section)
- Modify: `public/js/admin.js` (add queue rendering)

**Step 1: Add submission route to `server.js`**

```js
app.get('/api/submissions/pending', requireAuth, requireRole(['event_organiser', 'event_admin', 'moderator']),
  async (req, res) => {
    const submissions = await prisma.tileSubmission.findMany({
      where: { verdict: 'pending' },
      include: {
        team: { include: { event: { select: { name: true, tiles: true } } } },
        submittedBy: { select: { discordName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(submissions);
  }
);

app.post('/api/submissions/:id/approve', requireAuth, requireRole(['event_organiser', 'event_admin', 'moderator']),
  async (req, res) => {
    const sub = await prisma.tileSubmission.update({
      where: { id: req.params.id },
      data: { verdict: 'approved' },
      include: { team: true },
    });
    await prisma.team.update({ where: { id: sub.teamId }, data: { status: 'unlocked' } });
    req.app.get('io').emit('team:updated', sub.team);
    res.json({ ok: true });
  }
);

app.post('/api/submissions/:id/reject', requireAuth, requireRole(['event_organiser', 'event_admin', 'moderator']),
  async (req, res) => {
    const { note } = req.body;
    const sub = await prisma.tileSubmission.update({
      where: { id: req.params.id },
      data: { verdict: 'rejected', adminNote: note },
      include: { team: true },
    });
    await prisma.team.update({ where: { id: sub.teamId }, data: { status: 'locked' } });
    req.app.get('io').emit('team:updated', sub.team);
    res.json({ ok: true });
  }
);
```

**Step 2: Add approval queue section to `public/admin.html`**

Add a new `<section>` inside `admin-column controls-column`, after the Game Log section:
```html
<section class="admin-section" id="approvalSection">
  <h2 class="section-heading">Approval Queue <span class="queue-count" id="queueCount">0</span></h2>
  <div id="approvalQueue">
    <div style="color:var(--text-muted);font-size:0.85rem;">No pending submissions.</div>
  </div>
</section>
```

**Step 3: Add queue rendering to `public/js/admin.js`**

```js
async function loadApprovalQueue() {
  const res = await fetch('/api/submissions/pending');
  if (!res.ok) return;
  const submissions = await res.json();

  document.getElementById('queueCount').textContent = submissions.length;
  const container = document.getElementById('approvalQueue');

  if (submissions.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;">No pending submissions.</div>';
    return;
  }

  container.innerHTML = submissions.map(sub => {
    const tile = sub.team.event.tiles[sub.tileNumber];
    const aiColor = sub.aiVerdict ? '#22c55e' : '#ef4444';
    return `
    <div class="submission-card">
      <div class="sub-header">
        <span class="sub-team" style="color:${sub.team.color}">${sub.team.name}</span>
        <span class="sub-tile">Tile ${sub.tileNumber} — ${tile?.name || '?'}</span>
      </div>
      <div class="sub-challenge">${tile?.challenge || ''}</div>
      <img src="${sub.screenshotUrl}" class="sub-screenshot" onclick="window.open('${sub.screenshotUrl}')">
      <div class="sub-ai" style="border-color:${aiColor}">
        <strong>AI:</strong> ${sub.aiVerdict ? '✅ PASS' : '❌ FAIL'}
        (${sub.aiConfidence}%) — ${sub.aiReason}
      </div>
      <div class="sub-actions">
        <button class="btn btn-approve" onclick="approveSubmission('${sub.id}')">Approve</button>
        <button class="btn btn-reject" onclick="rejectSubmission('${sub.id}')">Reject</button>
      </div>
    </div>`;
  }).join('');
}

async function approveSubmission(id) {
  await fetch(`/api/submissions/${id}/approve`, { method: 'POST' });
  loadApprovalQueue();
}

async function rejectSubmission(id) {
  const note = prompt('Rejection reason (sent to team):');
  await fetch(`/api/submissions/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  loadApprovalQueue();
}

// Refresh queue every 30s and on Socket.io events
setInterval(loadApprovalQueue, 30000);
```

Call `loadApprovalQueue()` at the end of the `updateUI()` function.

**Step 4: Commit**

```bash
git add public/admin.html public/js/admin.js server.js
git commit -m "feat: add admin approval queue for screenshot submissions"
```

---

### Task 16: Event Management UI (Event Organiser Only)

**Files:**
- Create: `public/events.html`
- Create: `public/js/events.js`
- Modify: `server.js`

**Step 1: Add events page route**

```js
app.get('/events', requireAuth, requireRole(['event_organiser']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/events.html'));
});
```

**Step 2: Create `public/events.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Events — OSRS Game of Goose</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/admin.css">
</head>
<body>
  <header class="admin-header">
    <div class="admin-header-left">
      <span>Event Management</span>
    </div>
    <div class="admin-header-right">
      <a href="/admin.html">Admin Panel</a>
      <a href="/">Board View</a>
    </div>
  </header>
  <div class="admin-layout">
    <div class="admin-column">

      <section class="admin-section">
        <h2 class="section-heading">Create Event</h2>
        <div class="settings-form">
          <div class="settings-field">
            <label class="field-label">Event Name</label>
            <input type="text" id="newEventName" placeholder="Spring Cup 2026">
          </div>
          <div class="settings-field">
            <label class="field-label">Tagword (RuneLite overlay)</label>
            <input type="text" id="newEventTagword" placeholder="GOOSE2026">
          </div>
          <div class="settings-field">
            <label class="field-label">Auto-Approve Threshold (%)</label>
            <input type="number" id="newEventThreshold" value="90" min="50" max="100">
          </div>
          <div class="settings-field">
            <label class="field-label">Submit Channel ID</label>
            <input type="text" id="newSubmitChannel" placeholder="Discord channel ID">
          </div>
          <div class="settings-field">
            <label class="field-label">Review Channel ID</label>
            <input type="text" id="newReviewChannel" placeholder="Discord channel ID">
          </div>
          <div class="settings-field">
            <label class="field-label">Updates Channel ID</label>
            <input type="text" id="newUpdatesChannel" placeholder="Discord channel ID">
          </div>
          <button class="btn btn-start" onclick="createEvent()">Create Event</button>
        </div>
      </section>

      <section class="admin-section">
        <h2 class="section-heading">Events</h2>
        <div id="eventList"></div>
      </section>
    </div>
  </div>
  <script src="js/events.js"></script>
</body>
</html>
```

**Step 3: Create `public/js/events.js`**

```js
async function loadEvents() {
  const res = await fetch('/api/events');
  const events = await res.json();
  document.getElementById('eventList').innerHTML = events.map(e => `
    <div class="team-entry">
      <div class="team-info">
        <div class="team-name">${e.name}</div>
        <div class="team-pos">Status: ${e.status} | Tagword: ${e.tagword}</div>
      </div>
      <div class="team-controls">
        <button onclick="activateEvent('${e.id}')" ${e.status === 'active' ? 'disabled' : ''}>Activate</button>
        <button onclick="openBoard('${e.id}')">Edit Board</button>
      </div>
    </div>
  `).join('');
}

async function createEvent() {
  const body = {
    name: document.getElementById('newEventName').value.trim(),
    tagword: document.getElementById('newEventTagword').value.trim(),
    autoApproveThreshold: parseInt(document.getElementById('newEventThreshold').value),
    submitChannelId: document.getElementById('newSubmitChannel').value.trim() || null,
    reviewChannelId: document.getElementById('newReviewChannel').value.trim() || null,
    updatesChannelId: document.getElementById('newUpdatesChannel').value.trim() || null,
  };
  if (!body.name || !body.tagword) return alert('Name and tagword required.');
  const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.ok) { alert('Event created!'); loadEvents(); }
  else { const d = await res.json(); alert(d.error); }
}

async function activateEvent(id) {
  await fetch(`/api/events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' }),
  });
  loadEvents();
}

function openBoard(id) {
  window.location = `/admin.html?eventId=${id}`;
}

loadEvents();
```

**Step 4: Commit**

```bash
git add public/events.html public/js/events.js server.js
git commit -m "feat: add event management page for event_organiser"
```

---

### Task 17: Remove Dead Code

**Files:**
- Delete: `gameState.js` (root-level, unused server-side copy)
- Modify: `public/js/gameState.js` (remove GooseGame class — keep TILE_TYPES, hexToRgba, getTileGridPosition for board rendering)

**Step 1: Delete root `gameState.js`**

```bash
rm gameState.js
```

**Step 2: Trim `public/js/gameState.js`**

Remove the `GooseGame` class entirely (lines 148–508). Keep:
- `TILE_TYPES` constant
- `TEAM_COLORS` constant
- `getSpecialEffect()` function (used by admin tile editor)
- `hexToRgba()` utility
- `getTileGridPosition()` utility
- `generateDefaultTiles()` function (used by admin tile editor)

**Step 3: Run tests to confirm nothing broke**

```bash
npm test
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead code, trim client-side gameState to rendering utilities only"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1 | 1–3 | PostgreSQL schema, Prisma client |
| 2 | 4–5 | Discord OAuth, session management, role middleware |
| 3 | 6–7 | Server-side game engine, REST API |
| 4 | 8–10 | Discord bot with /submit, /roll, /challenge, /status |
| 5 | 11 | Claude vision AI screenshot verification |
| 6 | 12–17 | Socket.io real-time, login, captain dashboard, admin queue, event management, cleanup |

**Run the full test suite after each phase:**
```bash
npm test
```

**Start both processes in development:**
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run bot
```
