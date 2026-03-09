jest.mock('@prisma/client', () => {
  const mockPrismaClient = jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  }));
  return { PrismaClient: mockPrismaClient };
});

test('prisma client is a singleton', () => {
  // Clear module cache to get a fresh require
  jest.resetModules();

  // Re-apply the mock after resetModules
  jest.mock('@prisma/client', () => {
    const mockPrismaClient = jest.fn().mockImplementation(() => ({
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    }));
    return { PrismaClient: mockPrismaClient };
  });

  // Clear the global singleton so the test is self-contained
  delete global.__prisma;

  const p1 = require('../src/db');
  const p2 = require('../src/db');
  expect(p1).toBe(p2);

  // Cleanup
  delete global.__prisma;
});
