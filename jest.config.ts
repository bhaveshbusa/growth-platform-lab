import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/apps/**/*.spec.ts', '<rootDir>/docs/**/*.spec.ts'],
  watchman: false,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverageFrom: ['apps/**/src/**/*.ts', '!apps/**/src/main.ts'],
  coverageDirectory: 'coverage',
};

export default config;
