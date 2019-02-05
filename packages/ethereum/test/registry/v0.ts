import assert = require('assert');
import utils = require('web3-utils');

import { assertTxEvent, assertRejection } from '../utils';

const RegistryContract = artifacts.require('RegistryV0');

const BASE_MULTIHASH = 'QmfQ5QAjvg4GtA3wg3adpnDJug8ktA1BxurVqBD8rtgVjM';
const NEW_MULTIHASH = 'QmYtUc4iTCbbfVSDNKvtQqrfyezPPnFvE33wFmutw9PBBk';

contract('Registry v0', (accounts) => {
  let registry;
  let owner;
  let otherUser;

  const handle = utils.fromUtf8('test');
  const paddedHandle = handle.padEnd(66, '0');

  before(async () => {
    [owner, otherUser] = accounts;
    registry = await RegistryContract.deployed();
  });

  it('can insert a record', async () => {
    const tx = await registry.registerHandle(handle);
    assertTxEvent(tx, 'RecordAdded', { handle: paddedHandle });
    const ownerInRegistry = await registry.getHandleOwner.call(handle);
    assert.strictEqual(ownerInRegistry, owner);
  });

  it('can not insert a record a node which is already registered', async () => {
    await assertRejection(registry.registerHandle(handle, { from: otherUser }));
  });

  it('can update an owned record', async () => {
    const tx = await registry.setHandlePointer(handle, BASE_MULTIHASH, {
      from: owner,
    });
    assertTxEvent(tx, 'RecordUpdated', {
      handle: paddedHandle,
      key: 'pointer',
    });

    const pointer = await registry.getHandlePointer.call(handle);
    assert.strictEqual(pointer, BASE_MULTIHASH);
  });

  it('can not update a non-owned record', async () => {
    await assertRejection(registry.setHandlePointer(handle, NEW_MULTIHASH, { from: otherUser }));
    const pointer = await registry.getHandlePointer.call(handle);
    assert.strictEqual(pointer, BASE_MULTIHASH);
  });
});
