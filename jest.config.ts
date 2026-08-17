import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/apps/**/*.spec.ts',
    '<rootDir>/libs/**/*.spec.ts',
    '<rootDir>/docs/**/*.spec.ts',
  ],
  // Tests read the library from source, so a stale dist can never make a test pass.
  moduleNameMapper: {
    '^@growth/event-contracts$': '<rootDir>/libs/event-contracts/src',
    '^@growth/event-contracts/(.*)$': '<rootDir>/libs/event-contracts/src/$1',
  },
  watchman: false,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverageFrom: [
    'apps/**/src/**/*.ts',
    'libs/**/src/**/*.ts',
    '!apps/**/src/main.ts',
  ],
  coverageDirectory: 'coverage',
};

export default config;
