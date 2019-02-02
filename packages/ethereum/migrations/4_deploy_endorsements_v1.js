var Registry = artifacts.require('Registry');
var Endorsements = artifacts.require('EndorsementsV1');
var Storage = artifacts.require('EndorsementsStorage');

module.exports = async (deployer) => {
  deployer
    .then(() => Promise.all([
      Registry.deployed(),
      deployer.deploy(Storage)
    ]))
    .then(([registry, storage]) => {
      return deployer.deploy(Endorsements, registry.address);
    })
};
