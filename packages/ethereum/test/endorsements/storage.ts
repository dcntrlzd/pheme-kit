import assert = require('assert');
import utils = require('web3-utils');

import { assertTxEvent, assertRejection } from '../utils';

const StorageContract = artifacts.require('EndorsementsStorage');

contract('Endorsements Storage', (accounts) => {
  let storage;

  const primaryKey = utils.fromUtf8('primary');
  const secondaryKey = utils.fromUtf8('secondary');
  const valueKey = utils.fromUtf8('value');

  before(async () => {
    storage = await StorageContract.deployed();
  });

  it('can add & remove a record', async () => {
    const initialCount = await storage.getRecordCountFor(primaryKey);

    await storage.addRecord(primaryKey, secondaryKey);

    const intermediateCount = await storage.getRecordCountFor(primaryKey);
    assert.equal(intermediateCount - initialCount, 1);

    await storage.removeRecord(primaryKey, secondaryKey);

    const finalCount = await storage.getRecordCountFor(primaryKey);
    assert.equal(finalCount - initialCount, 0);
  });

  describe('Getters and Setters', () => {
    before(async () => {
      await storage.addRecord(primaryKey, secondaryKey);
    });

    after(async () => {
      await storage.removeRecord(primaryKey, secondaryKey);
    });

    const getterAndSetterTester = (getterMethod, setterMethod, value) => async () => {
      const index = await storage.getSecondaryKeyIndex(primaryKey, secondaryKey);
      const initialValue = await storage[getterMethod](primaryKey, index, valueKey);
      await storage[setterMethod](primaryKey, index, valueKey, value);

      const finalValue = await storage[getterMethod](primaryKey, index, valueKey);
      assert.notEqual(finalValue, initialValue);
      assert.equal(finalValue, value);
    };

    it('can set uint of a record', getterAndSetterTester('getUint', 'setUint', 10));
    it('can set seting of a record', getterAndSetterTester('getString', 'setString', 'test'));
    it(
      'can set address of a record',
      getterAndSetterTester(
        'getAddress',
        'setAddress',
        '0x29A5cdb637924ea266BDef0d590A98542702147F'
      )
    );
    it('can set int of a record', getterAndSetterTester('getInt', 'setInt', -10));
    it('can set bytes of a record', getterAndSetterTester('getBytes', 'setBytes', valueKey));
    it('can set bool of a record', getterAndSetterTester('getBool', 'setBool', true));
  });
});
