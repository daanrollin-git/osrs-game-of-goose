jest.mock('@prisma/client', () => {
  const mockPrismaClient = jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      count: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  }));
  return { PrismaClient: mockPrismaClient };
});

test('auth exports an express router', () => {
  const auth = require('../src/auth');
  expect(auth).toBeDefined();
  // Express routers are functions
  expect(typeof auth).toBe('function');
});
