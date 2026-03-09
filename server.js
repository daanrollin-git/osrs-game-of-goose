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

httpServer.listen(PORT, () => {
  console.log(`\n🎲 OSRS Game of Goose running!`);
  console.log(`   Board view:  http://localhost:${PORT}`);
  console.log(`   Admin panel: http://localhost:${PORT}/admin.html\n`);
});

module.exports = { app, io };
