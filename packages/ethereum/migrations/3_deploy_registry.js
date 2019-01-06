var Storage = artifacts.require("./Storage.sol");
var Registry = artifacts.require("./Registry.sol");

module.exports = async (deployer) => {
  let storage;
  let registry;

  deployer
    .then(() => Storage.deployed())
    .then((instance) => {
      storage = instance;
      return deployer.deploy(Registry, storage.address);
    }).then((instance) => {
      registry = instance;
      return storage.addOwner(registry.address);
    });
};
