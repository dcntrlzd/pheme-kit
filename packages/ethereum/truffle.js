/* eslint-disable import/no-extraneous-dependencies, @typescript-eslint/camelcase, @typescript-eslint/no-var-requires */
require('ts-node').register();

const path = require('path');

module.exports = {
  test_file_extension_regexp: /.*\.[tj]s$/,
  contracts_build_directory: path.join(__dirname, 'artifacts', 'full'),
  contracts_directory: path.join(__dirname, 'contracts'),
  migrations_directory: path.join(__dirname, 'migrations'),
  compilers: {
    solc: {
      version: '0.4.25',
    },
  },
};
