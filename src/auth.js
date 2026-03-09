const express = require('express');
const passport = require('passport');
const { Strategy: DiscordStrategy } = require('passport-discord');
const prisma = require('./db');

const router = express.Router();

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
  scope: ['identify'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Use a transaction to safely handle first-user role assignment.
    // Without a transaction, two simultaneous logins could both see no existing
    // users and both be promoted to event_organiser.
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { discordId: profile.id } });
      if (existing) {
        return tx.user.update({
          where: { discordId: profile.id },
          data: { discordName: profile.username, discordAvatar: profile.avatar },
        });
      }
      const anyUser = await tx.user.findFirst({ select: { id: true } });
      return tx.user.create({
        data: {
          discordId: profile.id,
          discordName: profile.username,
          discordAvatar: profile.avatar,
          role: anyUser ? 'captain' : 'event_organiser',
        },
      });
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
