var Storage = artifacts.require("./Storage.sol");
var Endorsements = artifacts.require("./Endorsements.sol");

module.exports = async (deployer) => {
  let storage;
  let endorsements;

  deployer
    .then(() => Storage.deployed())
    .then((instance) => {
      storage = instance;
      return deployer.deploy(Endorsements, storage.address);
    }).then((instance) => {
      endorsements = instance;
      return storage.addOwner(endorsements.address);
    });
};
