jest.mock('@prisma/client', () => {
  const mockPrismaClient = jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((fn) => fn({
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    })),
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
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
