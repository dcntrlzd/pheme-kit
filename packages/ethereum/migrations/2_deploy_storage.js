const Storage = artifacts.require('RegistryStorage');

module.exports = function deployStorage(deployer) {
  deployer.deploy(Storage);
};
