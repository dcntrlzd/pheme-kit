import assert = require('assert');
import utils = require('web3-utils');

const StorageContract = artifacts.require('EndorsementsStorage');

contract('Endorsements Storage', () => {
  let storage;

  const handle = utils.fromUtf8('handle');
  const uuid = '70a77f55-b53a-4166-8016-adb885c7f62b';
  const endorser = '0x63a60F403AA3C7fEaf94Ec98647D46EcD3638e4f';

  before(async () => {
    storage = await StorageContract.deployed();
  });

  it('can add & remove a record', async () => {
    const initialCount = await storage.getRecordCountByContent(handle, uuid);

    await storage.addRecord(handle, uuid, endorser);

    const intermediateCount = await storage.getRecordCountByContent(handle, uuid);
    assert.equal(intermediateCount - initialCount, 1);

    await storage.removeRecord(handle, uuid, endorser);

    const finalCount = await storage.getRecordCountByContent(handle, uuid);
    assert.equal(finalCount - initialCount, 0);
  });

  describe('Getters and Setters', () => {
    const valueKey = utils.fromUtf8('valueKey');
    let recordId;

    before(async () => {
      await storage.addRecord(handle, uuid, endorser);
      recordId = await storage.calculateId(handle, uuid, endorser);
    });

    after(async () => {
      await storage.removeRecord(handle, uuid, endorser);
    });

    const getterAndSetterTester = (getterMethod, setterMethod, value) => async () => {
      const initialValue = await storage[getterMethod](recordId, valueKey);
      await storage[setterMethod](recordId, valueKey, value);

      const finalValue = await storage[getterMethod](recordId, valueKey);
      assert.notEqual(finalValue, initialValue);
      assert.equal(finalValue, value);
    };

    it('can set uint of a record', getterAndSetterTester('getUint', 'setUint', 10));
    it('can set seting of a record', getterAndSetterTester('getString', 'setString', 'test'));
    it('can set address of a record', getterAndSetterTester('getAddress', 'setAddress', endorser));
    it('can set int of a record', getterAndSetterTester('getInt', 'setInt', -10));
    it('can set bytes of a record', getterAndSetterTester('getBytes', 'setBytes', valueKey));
    it('can set bool of a record', getterAndSetterTester('getBool', 'setBool', true));
  });
});
