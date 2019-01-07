require('ts-node').register();

module.exports = {
  test_file_extension_regexp: /.*\.[tj]s$/,
  compilers: {
    solc: {
      version: '0.4.25',
    },
  }
};
