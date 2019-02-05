import assert = require('assert');
import utils = require('web3-utils');

import { assertTxEvent, assertRejection } from '../utils';

const RegistryContract = artifacts.require('RegistryV0');
const EndorsementsContract = artifacts.require('EndorsementsV1');

contract('Endorsements v1', (accounts) => {
  let registry;
  let endorsements;
  let endorsee;
  let endorser;
  let owner;

  const handle = utils.fromUtf8('endorsements-test');
  const uuid = 'eb9d203a-566b-4940-bb45-25ec0d98a94d';

  const paddedHandle = handle.padEnd(66, '0');

  before(async () => {
    [owner, endorsee, endorser] = accounts;
    registry = await RegistryContract.deployed();
    endorsements = await EndorsementsContract.deployed();

    await registry.registerHandle(handle, { from: endorsee });
  });

  it('can endorse a content', async () => {
    const initialEndorseeBalance = await web3.eth.getBalance(endorsee);
    const initialContractBalance = await web3.eth.getBalance(endorsements.address);
    const initialEndorsementCount = await endorsements.getEndorsementCount(handle, uuid);

    const totalAmount = utils.toWei('1');
    const serviceFee = totalAmount * 0.01;
    const endorseeShare = totalAmount * 0.99;
    const tx = await endorsements.endorse(handle, uuid, { from: endorser, value: totalAmount });
    assertTxEvent(tx, 'EndorsementAdded', {
      endorser,
      handle: paddedHandle,
      hashedUuid: utils.keccak256(uuid),
    });

    const finalEndorseeBalance = await web3.eth.getBalance(endorsee);
    const finalContractBalance = await web3.eth.getBalance(endorsements.address);
    const finalEndorsementCount = await endorsements.getEndorsementCount(handle, uuid);

    assert.deepEqual(finalEndorseeBalance - initialEndorseeBalance, endorseeShare);
    assert.deepEqual(finalContractBalance - initialContractBalance, serviceFee);
    assert.deepEqual(finalEndorsementCount - initialEndorsementCount, 1);

    const endorsementEndorser = await endorsements.getEndorsementEndorser(handle, uuid, 0);
    assert.deepEqual(endorsementEndorser, endorser);

    const endorsementAmount = await endorsements.getEndorsementAmount(handle, uuid, 0);
    assert.deepEqual(endorsementAmount.toString(), totalAmount);
  });
});
