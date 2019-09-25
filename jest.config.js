module.exports = {
  "testEnvironment": "node",
  "transform": {
    "^.+\\.tsx?$": "ts-jest"
  },
  "testRegex": "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
  "testPathIgnorePatterns": [
    "/node_modules/",
    "/mocks/",
  ],
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node",
    "sol"
  ],
  "globalSetup": "./config/jest-setup.ts",
  "globalTeardown": "./config/jest-teardown.ts",
  "moduleDirectories": [
    "node_modules",
    "packages"
  ]
};
