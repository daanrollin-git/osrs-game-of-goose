const request = require('supertest');

// Mock prisma before requiring app
jest.mock('../../src/db', () => ({
  event: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    count: jest.fn().mockResolvedValue(1),
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    $transaction: jest.fn(),
  },
}));

const { app } = require('../../server');

test('GET /api/events returns 200 with array', async () => {
  const res = await request(app).get('/api/events');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('GET /api/events/:id returns 404 for unknown id', async () => {
  const res = await request(app).get('/api/events/nonexistent');
  expect(res.status).toBe(404);
});

test('POST /api/events returns 401 when not authenticated', async () => {
  const res = await request(app)
    .post('/api/events')
    .send({ name: 'Test Event', tagword: 'TEST' });
  expect(res.status).toBe(401);
});
