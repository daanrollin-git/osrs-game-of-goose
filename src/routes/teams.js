const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/requireAuth');
const { throwDice, resolveMove, applySpecialEffect } = require('../gameEngine');

const router = express.Router();


// POST /api/teams/:id/roll — roll dice for a team
router.post('/:id/roll', requireAuth, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: { event: true },
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.status !== 'unlocked') return res.status(400).json({ error: 'Team is locked' });

    const isCaptain = team.captainId === req.user.id;
    const isAdmin = ['event_organiser', 'event_admin'].includes(req.user.role);
    if (!isCaptain && !isAdmin) {
      return res.status(403).json({ error: 'Only the captain can roll' });
    }

    const tiles = team.event.tiles;
    const diceCount = team.event.settings?.diceCount ?? 2;
    const dice = throwDice(diceCount);
    const total = dice.reduce((a, b) => a + b, 0);
    const { newPosition, path, tile } = resolveMove(
      { position: team.position },
      total,
      tiles,
      { exactFinish: team.event.settings?.exactFinish !== false }
    );

    // Apply special effect (mutates a copy of team position)
    const teamCopy = { position: newPosition };
    const specialEffect = applySpecialEffect(tile.special, teamCopy);
    const finalPosition = teamCopy.position; // may have been mutated by jump/go_back

    const newStatus = tile.type === 'goose' ? 'unlocked' : 'locked';

    const updateData = { position: finalPosition, status: newStatus };

    if (specialEffect?.skipTurns) {
      updateData.skipTurns = specialEffect.skipTurns;
    }
    if (specialEffect?.prison) {
      updateData.prisonTurnsRemaining = specialEffect.turns;
      updateData.status = 'locked'; // prison also locks
    }
    // Reset skip/prison on new roll
    if (!specialEffect?.skipTurns && !specialEffect?.prison) {
      updateData.skipTurns = 0;
      updateData.prisonTurnsRemaining = 0;
    }

    const updated = await prisma.team.update({
      where: { id: team.id },
      data: updateData,
    });

    const io = req.app.get('io');
    io.emit('team:rolled', { team: updated, dice, total, path, tile, specialEffect });
    res.json({ team: updated, dice, total, path, tile, specialEffect });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Team not found' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/teams/:id — admin force-update team
router.patch('/:id', requireAuth, requireRole(['event_organiser', 'event_admin']), async (req, res) => {
  try {
    const { position, status, captainId } = req.body;
    const data = {};
    if (position !== undefined) data.position = position;
    if (status !== undefined) data.status = status;
    if (captainId !== undefined) data.captainId = captainId;

    const team = await prisma.team.update({ where: { id: req.params.id }, data });
    req.app.get('io').emit('team:updated', team);
    res.json(team);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Team not found' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/teams/:id/claim-captain — logged in user claims captain slot
router.post('/:id/claim-captain', requireAuth, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.captainId) return res.status(409).json({ error: 'Team already has a captain' });

    const updated = await prisma.team.update({
      where: { id: req.params.id },
      data: { captainId: req.user.id },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
