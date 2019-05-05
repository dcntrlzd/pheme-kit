declare var artifacts: any;
declare var contract: (name: string, callback: (accounts: string[]) => any) => any;

import Pheme from '@pheme-kit/core/src';

import * as ethers from 'ethers';
import IPFSFactory from 'ipfsd-ctl';

import assert = require('assert');

const assertTxEvent = (tx, event, args) => {
  const log = tx.logs.find((cursor) => cursor.event === event);
  assert.deepStrictEqual(log.args, args);
};

const HANDLE = 'test';
const PROFILE = { description: 'HELLO' };

contract('E2E Test', (accounts) => {
  const Registry: any = artifacts.require('RegistryV1');
  let registry: any;

  let owner: string;
  let pheme: Pheme;
  let ipfsServer: any;
  let provider: ethers.providers.Web3Provider;

  before(async () => {
    [owner] = accounts;
    registry = await Registry.deployed();

    provider = new ethers.providers.Web3Provider(registry.constructor.web3.currentProvider);

    ipfsServer = await new Promise((resolve, reject) => {
      IPFSFactory.create().spawn((err, ipfsd) => {
        if (err) {
          throw err;
          reject(err);
        }

        resolve(ipfsd);
      });
    });

    pheme = Pheme.create({
      providerOrSigner: provider.getSigner(),
      contractAddress: registry.address,
      ipfsRpcUrl: `http://localhost:5001`,
      ipfsGatewayUrl: `http://localhost:9000`,
      // ipfsRpcUrl: `http://${ipfsServer.api.apiHost}:${ipfsServer.api.apiPort}`,
      // ipfsGatewayUrl: `http://${ipfsServer.api.gatewayHost}:${ipfsServer.api.gatewayPort}`,
    });
  });

  it('should be able to create, read and modify feeds.', async () => {
    const registerTask = pheme.registerHandle(HANDLE);
    await registerTask.execute();
    assert(registerTask.context.txHash);

    await pheme.updateHandleProfile(HANDLE, PROFILE).execute();
    const profile = await pheme.getHandleProfile(HANDLE).execute();
    assert.deepEqual(profile, PROFILE);

    const chainBefore = await pheme.loadHandle(HANDLE).execute();
    assert.deepEqual(chainBefore, []);

    await pheme
      .pushToHandle(HANDLE, Buffer.from('# FIRST\nLorem ipsum dolor sit amet.'), { title: 'FIRST' })
      .execute();
    await pheme
      .pushToHandle(HANDLE, Buffer.from('# SECOND\nLorem ipsum dolor sit amet.'), {
        title: 'SECOND',
      })
      .execute();

    const chain = await pheme.loadHandle(HANDLE).execute();
    assert.equal(chain.length, 2);

    const [secondNode, firstNode] = chain;

    const { block: secondPost } = secondNode;
    const { block: firstPost } = firstNode;

    assert(firstPost.uuid);
    assert(firstPost.address);
    assert(firstPost.timestamp);
    assert.deepEqual(firstPost.meta, { title: 'FIRST' });
    assert(!firstPost.previous);
    const firstPostContent = await firstNode.loadContent();
    assert(firstPostContent.toString(), '# FIRST\nLorem ipsum dolor sit amet.');

    assert(secondPost.uuid);
    assert(secondPost.address);
    assert(secondPost.timestamp);
    assert.deepEqual(secondPost.meta, { title: 'SECOND' });
    assert(secondPost.previous);
    const secondPostContent = await secondNode.loadContent();
    assert(secondPostContent.toString(), '# SECOND\nLorem ipsum dolor sit amet.');

    await pheme
      .replaceFromHandle(HANDLE, secondPost.uuid, Buffer.from('# SECOND MODIFIED'), {
        title: 'SECOND MODIFIED',
      })
      .execute();
    const [modifiedSecondNode, unmodifiedFirstNode] = await pheme.loadHandle(HANDLE).execute();

    const { block: unmodifiedFirstPost } = unmodifiedFirstNode;
    const { block: modifiedSecondPost } = modifiedSecondNode;

    assert.notEqual(modifiedSecondNode.address, secondNode.address);
    assert.deepEqual(unmodifiedFirstPost, firstPost);

    assert.equal(modifiedSecondNode.block.uuid, secondPost.uuid);
    assert.notEqual(modifiedSecondNode.contentAddress, secondNode.contentAddress);
    // TODO: We should update the timestamp as well
    assert.equal(modifiedSecondPost.timestamp, secondPost.timestamp);
    assert.deepEqual(modifiedSecondPost.meta, { title: 'SECOND MODIFIED' });
    assert.equal(modifiedSecondPost.previous, secondPost.previous);
    const modifiedSecondPostContent = await modifiedSecondNode.loadContent();
    assert(modifiedSecondPostContent.toString(), '# SECOND MODIFIED');

    await pheme.pushToHandle(HANDLE, Buffer.from('# THIRD'), { title: 'THIRD' }).execute();
    await pheme.removeFromHandle(HANDLE, modifiedSecondPost.uuid).execute();
    const [thirdNode] = await pheme.loadHandle(HANDLE).execute();
    const { block: thirdPost } = thirdNode;

    assert.notEqual(thirdNode.address, modifiedSecondNode.address);
    assert.notEqual(thirdNode.address, secondNode.address);
    assert(thirdPost.uuid);
    assert.notEqual(thirdPost.uuid, modifiedSecondPost.uuid);
    assert(thirdPost.address);
    assert(thirdPost.timestamp);
    assert.deepEqual(thirdPost.meta, { title: 'THIRD' });
    assert.equal(thirdPost.previous, modifiedSecondPost.previous);
    const thirdPostContent = await thirdNode.loadContent();
    assert(thirdPostContent.toString(), '# THIRD');
  });

  it('should be able to deal with v1 and v2 content', async () => {
    const v1ContentAddress = await pheme.storage.writeData(Buffer.from('V1'));
    const v1BlockAddress = await pheme.storage.writeObject({
      uuid: 'v1-uuid',
      address: v1ContentAddress,
      meta: { version: 1 },
      timestamp: Date.now(),
      previous: null,
    });

    const v2ContentAddress = await pheme.storage.writeData(Buffer.from('V2'));
    const v2BlockAddress = await pheme.storage.writeObject({
      uuid: 'v2-uuid',
      address: `ipfs://${v2ContentAddress}`,
      meta: { version: 2 },
      timestamp: Date.now(),
      previous: `ipfs://${v1BlockAddress}`,
    });

    await pheme.registry.setPointer(HANDLE, v2BlockAddress).execute();
    const [v2Node, v1Node] = await pheme.loadHandle(HANDLE).execute();

    assert.deepEqual(v1Node.block.meta.version, 1);
    assert.deepEqual(await v1Node.loadContent().then((buffer) => buffer.toString()), 'V1');

    assert.deepEqual(v2Node.block.meta.version, 2);
    assert.deepEqual(await v2Node.loadContent().then((buffer) => buffer.toString()), 'V2');

    await pheme
      .replaceFromHandle(HANDLE, 'v1-uuid', Buffer.from('V1-NEW'), v1Node.block.meta)
      .execute();
    const patchedChain = await pheme.loadHandle(HANDLE).execute();

    // ensure that v2 node is converted to v3
    assert(patchedChain[0].address.includes('block.json'));
    // ensure that v1 node is converted to v3
    assert(patchedChain[1].address.includes('block.json'));
    // ensure that the content is updated
    assert.deepEqual(
      await patchedChain[1].loadContent().then((buffer) => buffer.toString()),
      'V1-NEW'
    );
  });
});
