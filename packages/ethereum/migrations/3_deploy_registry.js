const Storage = artifacts.require('RegistryStorage');
const Registry = artifacts.require('RegistryV1');

module.exports = async (deployer) => {
  let storage;
  let registry;

  deployer
    .then(() => Storage.deployed())
    .then((instance) => {
      storage = instance;
      return deployer.deploy(Registry, storage.address);
    })
    .then((instance) => {
      registry = instance;
      return storage.addOwner(registry.address);
    });
};
