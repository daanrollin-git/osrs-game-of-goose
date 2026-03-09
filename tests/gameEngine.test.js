const { createDefaultTiles, throwDice, resolveMove, applySpecialEffect } = require('../src/gameEngine');

const tiles = createDefaultTiles();

test('createDefaultTiles returns 64 tiles', () => {
  expect(tiles).toHaveLength(64);
  expect(tiles[0].type).toBe('start');
  expect(tiles[63].type).toBe('finish');
});

test('throwDice returns correct count of values in range 1-6', () => {
  const dice = throwDice(2);
  expect(dice).toHaveLength(2);
  dice.forEach(d => {
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(6);
  });
});

test('resolveMove advances position correctly', () => {
  const result = resolveMove({ position: 5 }, 3, tiles);
  expect(result.newPosition).toBe(8);
  expect(result.path).toContain(5);
  expect(result.path).toContain(8);
});

test('resolveMove bounces back on overshoot with exactFinish', () => {
  // 61 + 5 = 66, overshoots by 3, bounces to 60
  const result = resolveMove({ position: 61 }, 5, tiles, { exactFinish: true });
  expect(result.newPosition).toBe(60);
});

test('resolveMove allows landing exactly on 63', () => {
  const result = resolveMove({ position: 60 }, 3, tiles, { exactFinish: true });
  expect(result.newPosition).toBe(63);
});

test('applySpecialEffect returns rollAgain for goose', () => {
  const effect = applySpecialEffect({ action: 'roll_again' }, {});
  expect(effect).toEqual({ rollAgain: true });
});

test('applySpecialEffect mutates team position on jump', () => {
  const team = { position: 5 };
  const effect = applySpecialEffect({ action: 'jump', target: 12 }, team);
  expect(team.position).toBe(12);
  expect(effect.jumped).toBe(true);
});

test('applySpecialEffect returns null for no special', () => {
  expect(applySpecialEffect(null, {})).toBeNull();
});

test('resolveMove bounce path starts at fromPos, peaks at 63, ends at newPos', () => {
  // 61 + 5 = 66 → overshoots by 3 → bounces to 60
  // path goes forward through 63 then back: [61, 62, 63, 62, 61, 60]
  const result = resolveMove({ position: 61 }, 5, tiles, { exactFinish: true });
  expect(result.path[0]).toBe(61);
  expect(result.path).toContain(63);
  expect(result.path[result.path.length - 1]).toBe(60);
  expect(result.newPosition).toBe(60);
  // 63 should appear exactly once (no double-peak)
  expect(result.path.filter(p => p === 63)).toHaveLength(1);
});
