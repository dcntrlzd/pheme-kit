import assert = require('assert');

declare var artifacts: any;
declare var contract: (name: string, callback: (accounts: string[]) => any) => any;

const StorageContract = artifacts.require('Storage');
const RegistryContract = artifacts.require('Registry');
const utils = require('web3-utils');

const BASE_MULTIHASH = 'QmfQ5QAjvg4GtA3wg3adpnDJug8ktA1BxurVqBD8rtgVjM';
const NEW_MULTIHASH = 'QmYtUc4iTCbbfVSDNKvtQqrfyezPPnFvE33wFmutw9PBBk';

const assertTxEvent = (tx, event, args) => {
  const log = tx.logs.find(log => log.event === event);
  const argsToCompare = Object.keys(args).reduce((acc, key) => ({ ...acc, [key]: log.args[key] }), {});
  assert.deepStrictEqual(args, argsToCompare);
}

const assertRejection = promise => promise.then(() => { throw new Error('Should not resolve'); }, () => assert.ok(true));

contract("Registry", (accounts) => {
  let storage;
  let registry;
  let withEvent;
  let owner;
  let otherUser;

  const handle = utils.fromUtf8('test');
  const paddedHandle = handle.padEnd(66, '0');

  before(async () => {
    ([owner, otherUser] = accounts);
    storage = await StorageContract.deployed();
    registry = await RegistryContract.deployed();
  });

  it('can insert a record', async () => {
    const tx = await registry.registerHandle(handle);
    assertTxEvent(tx, 'RecordAdded', { handle: paddedHandle });
    const ownerInRegistry = await registry.getHandleOwner.call(handle);
    assert.strictEqual(ownerInRegistry, owner);
  });

  it ('can not insert a record a node which is already registered', async () => {
    await assertRejection(registry.registerHandle(handle, { from: otherUser }));
  });

  it('can update an owned record', async () => {
    const tx = await registry.setHandlePointer(handle, BASE_MULTIHASH, { from: owner });
    assertTxEvent(tx, 'RecordUpdated', { handle: paddedHandle, key: 'pointer' });

    const pointer = await registry.getHandlePointer.call(handle);
    assert.strictEqual(pointer, BASE_MULTIHASH);
  });

  it('can not update a non-owned record', async () => {
    await assertRejection(registry.setHandlePointer(handle, NEW_MULTIHASH,{ from: otherUser }));
    const pointer = await registry.getHandlePointer.call(handle);
    assert.strictEqual(pointer, BASE_MULTIHASH);
  });
});

