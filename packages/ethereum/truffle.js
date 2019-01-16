require('ts-node').register();

const path = require('path');

module.exports = {
  test_file_extension_regexp: /.*\.[tj]s$/,
  contracts_build_directory: path.join(__dirname, 'artifacts'),
  compilers: {
    solc: {
      version: '0.4.25',
    },
  },
};
