import assert = require('assert');
import utils = require('web3-utils');

import { assertTxEvent, assertRejection } from '../utils';

const RegistryContract = artifacts.require('RegistryV1');
const EndorsementsContract = artifacts.require('EndorsementsV1');

interface ICount {
  byEndorser: number;
  byHandle: number;
  byContent: number;
}

contract('Endorsements v1', (accounts) => {
  let registry;
  let endorsements;
  let endorsee;
  let endorser;
  let recipient;
  let anotherEndorser;
  let owner;
  let endorsementId;

  const handle = utils.fromUtf8('endorsements-test');
  const uuid = 'eb9d203a-566b-4940-bb45-25ec0d98a94d';
  const anotherUuid = '70a77f55-b53a-4166-8016-adb885c7f62b';

  const totalAmount = utils.toWei('1');
  const serviceFee = totalAmount * 0.01;
  const endorseeShare = totalAmount * 0.99;

  const paddedHandle = handle.padEnd(66, '0');

  before(async () => {
    [owner, endorsee, endorser, recipient, anotherEndorser] = accounts;
    registry = await RegistryContract.deployed();
    endorsements = await EndorsementsContract.deployed();
    endorsementId = await endorsements.getEndorsementId(handle, uuid, endorser);

    await registry.registerHandle(handle, { from: endorsee });
  });

  const count = async (handleToCount, uuidToCount, endorserToCount): Promise<ICount> => {
    const [byEndorser, byHandle, byContent] = await Promise.all([
      endorsements.getEndorsementCountByEndorser(endorserToCount),
      endorsements.getEndorsementCountByHandle(handleToCount),
      endorsements.getEndorsementCountByContent(handleToCount, uuidToCount),
    ]);

    return { byEndorser, byHandle, byContent };
  };

  const loopRecordsBy = async (countMethod: string, fetchMethod: string, ...params: any[]) => {
    const endorsementCount = await endorsements[countMethod](...params);
    const list = [];

    for (let i = 0; i < endorsementCount; i += 1) {
      const id = await endorsements[fetchMethod](...[...params, i]);
      const [recordEndorser, recordHandle, recordUuid, recordAmount] = await Promise.all([
        endorsements.getEndorsementEndorser(id),
        endorsements.getEndorsementHandle(id),
        endorsements.getEndorsementUuid(id),
        endorsements.getEndorsementAmount(id),
      ]);

      list.push({
        endorser: recordEndorser,
        handle: recordHandle.replace(/0+$/, ''),
        uuid: recordUuid,
        amount: recordAmount.toString(),
      });
    }

    return list;
  };

  it('can endorse a content', async () => {
    const initialEndorseeBalance = await web3.eth.getBalance(endorsee);
    const initialContractBalance = await web3.eth.getBalance(endorsements.address);
    const initialCount = await count(handle, uuid, endorser);

    const tx = await endorsements.endorse(handle, uuid, { from: endorser, value: totalAmount });
    assertTxEvent(tx, 'EndorsementAdded', {
      endorser,
      handle: paddedHandle,
      hashedUuid: utils.keccak256(uuid),
    });

    const finalEndorseeBalance = await web3.eth.getBalance(endorsee);
    const finalContractBalance = await web3.eth.getBalance(endorsements.address);
    const finalCount = await count(handle, uuid, endorser);

    assert.equal(finalEndorseeBalance - initialEndorseeBalance, endorseeShare);
    assert.equal(finalContractBalance - initialContractBalance, serviceFee);

    assert.equal(finalCount.byEndorser - initialCount.byEndorser, 1);
    assert.equal(finalCount.byHandle - initialCount.byHandle, 1);
    assert.equal(finalCount.byContent - initialCount.byContent, 1);

    const endorsementEndorser = await endorsements.getEndorsementEndorser(endorsementId);
    assert.deepEqual(endorsementEndorser, endorser);

    const endorsementAmount = await endorsements.getEndorsementAmount(endorsementId);
    assert.deepEqual(endorsementAmount.toString(), totalAmount);
  });

  it('can transfer collected fees', async () => {
    const initialRecipientBalance = await web3.eth.getBalance(recipient);
    const initialContractBalance = await web3.eth.getBalance(endorsements.address);
    assert.notEqual(initialContractBalance, 0);

    const transferAmount = initialContractBalance;

    await endorsements.transfer(transferAmount, recipient);

    const finalRecipientBalance = await web3.eth.getBalance(recipient);
    const finalContractBalance = await web3.eth.getBalance(endorsements.address);

    assert.equal(finalRecipientBalance - initialRecipientBalance, transferAmount);
    assert.equal(finalContractBalance, 0);
  });

  it('does count correct', async () => {
    const [
      initialHandleCount,
      initialEndorserCount,
      initialAnotherEndorserCount,
      initialContentCount,
      initialAnotherContentCount,
    ] = await Promise.all([
      endorsements.getEndorsementCountByHandle(handle),
      endorsements.getEndorsementCountByEndorser(endorser),
      endorsements.getEndorsementCountByEndorser(anotherEndorser),
      endorsements.getEndorsementCountByContent(handle, uuid),
      endorsements.getEndorsementCountByContent(handle, anotherUuid),
    ]);

    await endorsements.endorse(handle, anotherUuid, { from: endorser, value: totalAmount });
    await endorsements.endorse(handle, uuid, { from: anotherEndorser, value: totalAmount });

    const [
      finalHandleCount,
      finalEndorserCount,
      finalAnotherEndorserCount,
      finalContentCount,
      finalAnotherContentCount,
    ] = await Promise.all([
      endorsements.getEndorsementCountByHandle(handle),
      endorsements.getEndorsementCountByEndorser(endorser),
      endorsements.getEndorsementCountByEndorser(anotherEndorser),
      endorsements.getEndorsementCountByContent(handle, uuid),
      endorsements.getEndorsementCountByContent(handle, anotherUuid),
    ]);

    assert.equal(finalHandleCount - initialHandleCount, 2);
    assert.equal(finalEndorserCount - initialEndorserCount, 1);
    assert.equal(finalAnotherEndorserCount - initialAnotherEndorserCount, 1);
    assert.equal(finalContentCount - initialContentCount, 1);
    assert.equal(finalAnotherContentCount - initialAnotherContentCount, 1);
  });

  it('can tip more', async () => {
    const initialCount = await endorsements.getEndorsementCountByContent(handle, uuid);
    const initialAmount = await endorsements.getEndorsementAmount(endorsementId);

    const tx = await endorsements.endorse(handle, uuid, { from: endorser, value: totalAmount });

    const finalCount = await endorsements.getEndorsementCountByContent(handle, uuid);
    const finalAmount = await endorsements.getEndorsementAmount(endorsementId);

    assert.equal(finalCount.toString(), initialCount.toString());
    assert.equal(finalAmount - initialAmount, totalAmount);
  });

  it('can loop over endorsements by handle', async () => {
    const records = await loopRecordsBy(
      'getEndorsementCountByHandle',
      'getRecordIdByHandleAt',
      handle
    );
    assert.deepEqual(records, [
      {
        endorser,
        handle,
        uuid,
        amount: '2000000000000000000',
      },
      {
        endorser,
        handle,
        uuid: anotherUuid,
        amount: '1000000000000000000',
      },
      {
        endorser: anotherEndorser,
        handle,
        uuid,
        amount: '1000000000000000000',
      },
    ]);
  });

  it('can loop over endorsements by content', async () => {
    const records = await loopRecordsBy(
      'getEndorsementCountByContent',
      'getRecordIdByContentAt',
      handle,
      uuid
    );
    assert.deepEqual(records, [
      {
        endorser,
        handle,
        uuid,
        amount: '2000000000000000000',
      },
      {
        endorser: anotherEndorser,
        handle,
        uuid,
        amount: '1000000000000000000',
      },
    ]);
  });

  it('can loop over endorsements by endorser', async () => {
    const records = await loopRecordsBy(
      'getEndorsementCountByEndorser',
      'getRecordIdByEndorserAt',
      endorser
    );
    assert.deepEqual(records, [
      {
        endorser,
        handle,
        uuid,
        amount: '2000000000000000000',
      },
      {
        endorser,
        handle,
        uuid: anotherUuid,
        amount: '1000000000000000000',
      },
    ]);
  });

  it('can revoke the endorsement', async () => {
    const initialCount = await count(handle, uuid, endorser);
    await endorsements.revokeEndorsement(handle, uuid, { from: endorser });
    const finalCount = await count(handle, uuid, endorser);

    assert.equal(initialCount.byEndorser - finalCount.byEndorser, 1);
    assert.equal(initialCount.byHandle - finalCount.byHandle, 1);
    assert.equal(initialCount.byContent - finalCount.byContent, 1);
  });
});
