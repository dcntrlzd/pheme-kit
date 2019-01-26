var Registry = artifacts.require("./Registry.sol");
var Endorsements = artifacts.require("./Endorsements.sol");

module.exports = async (deployer) => {
  let registry;
  let endorsements;

  deployer
    .then(() => Registry.deployed())
    .then((instance) => {
      registry = instance;
      return deployer.deploy(Endorsements, registry.address);
    });
};
