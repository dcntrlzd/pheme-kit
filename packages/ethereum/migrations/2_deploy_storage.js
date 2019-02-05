var Storage = artifacts.require('RegistryStorage');

module.exports = function(deployer) {
  deployer.deploy(Storage);
};
