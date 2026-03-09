require('dotenv').config();
const { validateEnv } = require('./src/validateEnv');

validateEnv(['SESSION_SECRET', 'DATABASE_URL']);
if (process.env.NODE_ENV === 'production') {
  validateEnv(['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI']);
}

const express = require('express');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const { createServer } = require('http');
const { Server } = require('socket.io');

const authRouter = require('./src/auth');
const prisma = require('./src/db');
const { requireAuth, requireRole } = require('./src/middleware/requireAuth');
const eventsRouter = require('./src/routes/events');
const teamsRouter = require('./src/routes/teams');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions (stored in Postgres — falls back gracefully if DB not yet connected)
app.use(session({
  store: process.env.DATABASE_URL
    ? new PgSession({ conString: process.env.DATABASE_URL })
    : undefined,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRouter);

app.use('/api/events', eventsRouter);
app.use('/api/teams', teamsRouter);

// My team endpoint
app.get('/api/my-team', requireAuth, async (req, res) => {
  try {
    const team = await prisma.team.findFirst({
      where: { captainId: req.user.id, event: { status: 'active' } },
      include: { event: true },
    });
    if (!team) return res.status(404).json({ error: 'No team found' });
    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submission routes
app.get('/api/submissions/pending', requireAuth, requireRole(['event_organiser', 'event_admin', 'moderator']), async (req, res) => {
  try {
    const submissions = await prisma.tileSubmission.findMany({
      where: { verdict: 'pending' },
      include: {
        team: { include: { event: { select: { name: true, tiles: true } } } },
        submittedBy: { select: { discordName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/submissions/:id/approve', requireAuth, requireRole(['event_organiser', 'event_admin', 'moderator']), async (req, res) => {
  try {
    const sub = await prisma.tileSubmission.update({
      where: { id: req.params.id },
      data: { verdict: 'approved' },
      include: { team: true },
    });
    await prisma.team.update({ where: { id: sub.teamId }, data: { status: 'unlocked' } });
    req.app.get('io').emit('team:updated', sub.team);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/submissions/:id/reject', requireAuth, requireRole(['event_organiser', 'event_admin', 'moderator']), async (req, res) => {
  try {
    const { note } = req.body;
    const sub = await prisma.tileSubmission.update({
      where: { id: req.params.id },
      data: { verdict: 'rejected', adminNote: note },
      include: { team: true },
    });
    await prisma.team.update({ where: { id: sub.teamId }, data: { status: 'locked' } });
    req.app.get('io').emit('team:updated', sub.team);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User management (event_organiser only)
app.get('/api/users', requireAuth, requireRole(['event_organiser']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, discordName: true, discordId: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/users/:id/role', requireAuth, requireRole(['event_organiser']), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['event_organiser', 'event_admin', 'moderator', 'captain'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Make io accessible in routes
app.set('io', io);

// Socket.io connection handler (placeholder — expanded in Task 12)
io.on('connection', (socket) => {
  socket.on('state:request', () => {
    // Will be implemented in Task 12
  });
});

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`\n🎲 OSRS Game of Goose running!`);
    console.log(`   Board view:  http://localhost:${PORT}`);
    console.log(`   Admin panel: http://localhost:${PORT}/admin.html\n`);
  });
}

module.exports = { app, io, httpServer };
