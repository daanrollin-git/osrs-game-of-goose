const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/requireAuth');
const { createDefaultTiles } = require('../gameEngine');

const router = express.Router();

// GET /api/events — list all events
router.get('/', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      select: { id: true, name: true, status: true, tagword: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:id — full event with teams
router.get('/:id', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        teams: {
          include: { captain: { select: { discordName: true, discordId: true } } },
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events — create event (event_organiser only)
router.post('/', requireAuth, requireRole(['event_organiser']), async (req, res) => {
  try {
    const { name, tagword, autoApproveThreshold, submitChannelId, reviewChannelId, updatesChannelId } = req.body;
    if (!name || !tagword) return res.status(400).json({ error: 'name and tagword are required' });

    const event = await prisma.event.create({
      data: {
        name,
        tagword,
        autoApproveThreshold: autoApproveThreshold ?? 90,
        tiles: createDefaultTiles(),
        submitChannelId: submitChannelId || null,
        reviewChannelId: reviewChannelId || null,
        updatesChannelId: updatesChannelId || null,
      },
    });
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/events/:id — update event settings (event_organiser only)
router.patch('/:id', requireAuth, requireRole(['event_organiser']), async (req, res) => {
  try {
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
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Event not found' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:id/teams — add team to event
router.post('/:id/teams', requireAuth, requireRole(['event_organiser', 'event_admin']), async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const team = await prisma.team.create({
      data: { name, color: color || '#6366f1', eventId: req.params.id },
    });
    req.app.get('io').emit('team:added', team);
    res.status(201).json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
