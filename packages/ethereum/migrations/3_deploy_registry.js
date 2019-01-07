var Storage = artifacts.require('./Storage.sol');
var Registry = artifacts.require('./Registry.sol');

module.exports = async (deployer) => {
  let storage;
  let registry;

  deployer
    .then(() => Storage.deployed())
    .then((instance) => {
      storage = instance;
      // Get the deployed instance of B
      return deployer.deploy(Registry, storage.address);
    })
    .then((instance) => {
      registry = instance;
      // Set the new instance of A's address on B via B's setA() function.
      return storage.addOwner(registry.address);
    });
};
