import '@testing-library/jest-dom';

// Global test setup
beforeEach(() => {
  // Reset any mocks or global state before each test
  jest.clearAllMocks();
});

// Mock console methods for cleaner test output
const originalConsole = console;
beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});