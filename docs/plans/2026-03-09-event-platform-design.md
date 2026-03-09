# OSRS Game of Goose — Event Platform Design
**Date:** 2026-03-09
**Status:** Approved

---

## Overview

Transform the existing local admin-driven Game of Goose into a repeatable web-based event platform. Multiple teams race simultaneously across the OSRS-themed board. Challenge completion is verified via Discord bot screenshot submission + AI analysis + optional admin approval.

---

## 1. System Architecture

**Approach:** Option A — Monolith. One Express server with a co-located discord.js bot process.

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Node.js + Express (existing) | Game API, auth, AI verification |
| Database | PostgreSQL + Prisma ORM | Persistent events, teams, users, submissions |
| Auth | Discord OAuth2 | Login for captains and admins |
| Real-time | Socket.io | Live board updates across all devices/networks |
| Bot | discord.js (same repo, separate process) | Screenshot intake, notifications |
| AI | Claude API — Haiku (vision) | Screenshot analysis + auto-approval |
| Hosting | Single VPS / Railway / Render | One deployment |

**State sync:** Socket.io replaces BroadcastChannel. The board view updates in real-time on any device when any team moves or a challenge is approved.

### Core Data Entities

- `Event` — game instance (board config, tagword, auto-approve threshold, status)
- `Team` — belongs to an event, has a designated captain (Discord user)
- `User` — Discord user, has a role
- `TileSubmission` — screenshot + AI result + admin decision
- `TeamState` — per-team state: position, lock status, current challenge

---

## 2. User Roles & Auth

**Auth:** Discord OAuth2. Users click "Login with Discord" — no passwords, no separate accounts.

| Role | Permissions |
|------|-------------|
| `event_organiser` | Create/configure events, **edit tiles/board** (exclusive), set tagword, assign admins |
| `event_admin` | Approve/reject submissions, manage teams, force-advance, game controls |
| `moderator` | Approve/reject submissions only |
| `captain` | Roll dice for their team, view challenge, submit via Discord bot |

**Role assignment:**
- First user to log in becomes `event_organiser`
- Event organiser assigns other admins/moderators by Discord username via web interface
- Captains self-register: log in with Discord → claim a team slot

**Captain backup:** If captain is unavailable, an `event_admin` can roll on their behalf or reassign the captain slot.

**Public access:** The board view (`/`) requires no login — any spectator with the link can watch live.

---

## 3. Game Flow (Race Format)

All teams play **simultaneously and independently**. This is a race, not turn-based.

### Per-Team State Machine

```
UNLOCKED → (captain rolls) → LOCKED → (submit screenshot) → PENDING → (approved) → UNLOCKED
                                                                      → (rejected) → LOCKED
UNLOCKED → (captain rolls on tile 63 + approved) → FINISHED
```

### Detailed Flow

1. Event organiser creates event, configures board and tagword, opens registration
2. Captains log in with Discord, claim a team slot
3. Event organiser starts the event — all teams begin at tile 0 in `UNLOCKED` state
4. Captain clicks Roll (web dashboard) or uses `/roll` (Discord)
5. Team token moves → team immediately enters `LOCKED` state on the new tile
6. Challenge text is shown to the team
7. Team completes the challenge in OSRS
8. **Any team member** runs `/submit [tile_number] [screenshot]` in the designated Discord channel
   - Bot validates tile number matches team's current locked position
9. AI analyzes the screenshot:
   - Is the tagword visible in the RuneLite overlay?
   - Does the screenshot show the challenge completed?
   - Outputs: PASS/FAIL + confidence score (0–100) + reasoning
10. **Auto-approval path:** confidence ≥ threshold (default 90) → team immediately `UNLOCKED`
    **Review path:** confidence < threshold or FAIL → enters admin review queue
11. On admin **APPROVE** → team `UNLOCKED`, captain can roll again
    On admin **REJECT** → team stays `LOCKED`, submitter notified with rejection reason

### Start Screenshot (Optional)
After rolling, the captain may submit a "start screenshot" to timestamp when the challenge began — useful for timed/race challenges.

### Winning
First team to complete the tile 63 challenge (approved) wins. All other teams continue racing for position.

---

## 4. Discord Bot

### Commands

| Command | Who | Description |
|---------|-----|-------------|
| `/submit [tile_number] [screenshot]` | Any team member | Submit proof for current tile challenge |
| `/roll` | Captain only | Roll dice (mirrors web dashboard Roll button) |
| `/challenge` | Any team member | Shows current challenge for the submitter's team |
| `/status` | Anyone | Shows standings and each team's current state |

### Channels (configured per event by event organiser)

| Channel | Purpose |
|---------|---------|
| `#submit` | Where players post `/submit` |
| `#admin-review` | AI results + submissions needing review, with Approve/Reject buttons |
| `#board-updates` | Auto-posts when teams move, challenges complete, turns advance |

### Admin Actions via Discord
Admins can approve/reject directly in `#admin-review` via button interactions on the bot message, without opening the web interface.

---

## 5. AI Screenshot Verification

**Model:** Claude Haiku (vision) — cost-efficient for high-volume screenshot checks.

**Prompt strategy:**
- Provides: challenge description, tagword, tile number
- Checks: tagword visible in RuneLite overlay, challenge completion evidence
- Returns: structured JSON `{ pass: bool, confidence: 0-100, reason: string }`

**Auto-approve threshold:** Configurable per event (default 90). Event organiser can raise/lower based on how strict verification needs to be.

**Admin queue card shows:**
- Team name + tile number + challenge text
- Submitted screenshot
- AI verdict, confidence %, AI reasoning
- Approve / Reject buttons + optional rejection note

---

## 6. Web Interface

| Page | Access | Description |
|------|--------|-------------|
| `/` | Public | Live board — all team tokens, real-time via Socket.io |
| `/login` | Public | Discord OAuth entry point |
| `/dashboard` | Captain | Roll button, current challenge, submission status |
| `/admin` | event_admin+ | Approval queue, team management, game controls, log |
| `/admin/events` | event_organiser | Create/configure events, tagword, thresholds |
| `/admin/board` | event_organiser | Tile editor (existing, restricted to this role) |

### Captain Dashboard States

| State | UI |
|-------|----|
| `Waiting` | Standings view, not your turn to roll yet |
| `Unlocked` | Big "Roll Dice" button |
| `Locked` | Challenge text displayed, submission instructions |
| `Pending` | "Awaiting review" indicator + what was submitted |
| `Rejected` | Rejection reason + "Resubmit" prompt |
| `Finished` | Completion screen with finish position |

### Board View Standings Panel
Each team entry shows: name, position (tile X/63), current state badge (🔓 ready, 🔒 locked, ⏳ pending, ✅ done).

---

## 7. Migration from Current Codebase

| Current | New |
|---------|-----|
| `localStorage` + `BroadcastChannel` | PostgreSQL + Socket.io |
| Admin-only game control | Role-based access (event_organiser / event_admin / moderator / captain) |
| Single-session local state | Persistent multi-event state |
| `public/js/gameState.js` (GooseGame class) | Server-side game engine (Express API) |
| `server.js` (static file server only) | Full API server |
| Root `gameState.js` (dead code) | Remove |

The existing board rendering (`board.js`), tile definitions, and admin tile editor UI are preserved and extended.
