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
  expect(next).not.toHaveBeenCalled();
});

test('requireRole allows sufficient role', () => {
  const req = { isAuthenticated: () => true, user: { role: 'event_organiser' } };
  const res = {};
  const next = jest.fn();
  requireRole(['event_organiser', 'event_admin'])(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('requireRole returns 401 when not authenticated', () => {
  const req = { isAuthenticated: () => false };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  requireRole(['event_organiser'])(req, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
});
