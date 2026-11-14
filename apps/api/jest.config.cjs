module.exports = { preset: 'ts-jest/presets/default-esm', testEnvironment: 'node', testMatch: ['**/test/**/*.spec.ts'], moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' } };
