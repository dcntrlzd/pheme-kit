const Registry = artifacts.require('RegistryV1');
const Endorsements = artifacts.require('EndorsementsV1');
const Storage = artifacts.require('EndorsementsStorage');

module.exports = async (deployer) => {
  let registry;
  let storage;

  deployer
    .then(() => Registry.deployed())
    .then((instance) => {
      registry = instance;
    })
    .then(() => deployer.deploy(Storage))
    .then((instance) => {
      storage = instance;
    })
    .then(() => {
      return deployer.deploy(Endorsements, storage.address, registry.address);
    })
    .then((instance) => {
      return storage.addOwner(instance.address);
    });
};
