require('dotenv').config();
const express = require('express');
const passport = require('passport');
const { Strategy: DiscordStrategy } = require('passport-discord');
const prisma = require('./db');

const router = express.Router();

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID || 'placeholder',
  clientSecret: process.env.DISCORD_CLIENT_SECRET || 'placeholder',
  callbackURL: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
  scope: ['identify'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const count = await prisma.user.count();
    const user = await prisma.user.upsert({
      where: { discordId: profile.id },
      update: { discordName: profile.username, discordAvatar: profile.avatar },
      create: {
        discordId: profile.id,
        discordName: profile.username,
        discordAvatar: profile.avatar,
        role: count === 0 ? 'event_organiser' : 'captain',
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
