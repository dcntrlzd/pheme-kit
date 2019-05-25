import Pheme from '@pheme-kit/core/src';

import * as ethers from 'ethers';
import IPFSFactory from 'ipfsd-ctl';

declare let artifacts: any;
declare let contract: (name: string, callback: (accounts: string[]) => any) => any;

import assert = require('assert');

const HANDLE = 'test';
const PROFILE = { description: 'HELLO' };

contract('E2E Test', () => {
  const Registry: any = artifacts.require('RegistryV1');
  let registry: any;
  let pheme: Pheme;
  let ipfsServer: any;
  let provider: ethers.providers.Web3Provider;

  before(async () => {
    registry = await Registry.deployed();
    provider = new ethers.providers.Web3Provider(registry.constructor.web3.currentProvider);

    ipfsServer = await new Promise((resolve, reject) => {
      IPFSFactory.create().spawn((err, ipfsd) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(ipfsd);
      });
    });

    pheme = Pheme.create({
      providerOrSigner: provider.getSigner(),
      contractAddress: registry.address,
      ipfsRpcUrl: `http://${ipfsServer.api.apiHost}:${ipfsServer.api.apiPort}`,
      ipfsGatewayUrl: `http://${ipfsServer.api.gatewayHost}:${ipfsServer.api.gatewayPort}`,
      // ipfsRpcUrl: `http://localhost:5001`,
      // ipfsGatewayUrl: `http://localhost:5000`,
    });
  });

  it('should be able to create, read and modify feeds', async () => {
    const registerTask = pheme.registerHandle(HANDLE);
    await registerTask.execute();
    assert(registerTask.context.txHash);

    await pheme.updateHandleProfile(HANDLE, PROFILE).execute();
    const profile = await pheme.getHandleProfile(HANDLE).execute();
    assert.deepEqual(profile, PROFILE);

    const chainBefore = await pheme.loadHandle(HANDLE).execute();
    assert.deepEqual(chainBefore, []);

    await pheme
      .pushToHandle(
        HANDLE,
        { path: 'content.txt', content: Buffer.from('# FIRST\nLorem ipsum dolor sit amet.') },
        { title: 'FIRST' }
      )
      .execute();
    await pheme
      .pushToHandle(
        HANDLE,
        { path: 'content.txt', content: Buffer.from('# SECOND\nLorem ipsum dolor sit amet.') },
        {
          title: 'SECOND',
        }
      )
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
    const firstPostContent = await pheme.storage.read(firstNode.contentAddress);
    assert(firstPostContent.toString(), '# FIRST\nLorem ipsum dolor sit amet.');

    assert(secondPost.uuid);
    assert(secondPost.address);
    assert(secondPost.timestamp);
    assert.deepEqual(secondPost.meta, { title: 'SECOND' });
    assert(secondPost.previous);
    const secondPostContent = await pheme.storage.read(secondNode.contentAddress);
    assert(secondPostContent.toString(), '# SECOND\nLorem ipsum dolor sit amet.');

    await pheme
      .replaceFromHandle(
        HANDLE,
        secondPost.uuid,
        {
          path: 'content.txt',
          content: Buffer.from('# SECOND MODIFIED'),
        },
        {
          title: 'SECOND MODIFIED',
        }
      )
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
    const modifiedSecondPostContent = await pheme.storage.read(modifiedSecondNode.contentAddress);
    assert(modifiedSecondPostContent.toString(), '# SECOND MODIFIED');

    await pheme
      .pushToHandle(
        HANDLE,
        {
          path: 'content.txt',
          content: Buffer.from('# THIRD'),
        },
        { title: 'THIRD' }
      )
      .execute();
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
    const thirdPostContent = await pheme.storage.read(thirdNode.contentAddress);
    assert(thirdPostContent.toString(), '# THIRD');
  });

  it('should be able to deal with v1 and v2 content', async () => {
    const v1ContentAddress = await pheme.storage.write(Buffer.from('V1'));
    const v1BlockAddress = await pheme.storage.writeObject({
      uuid: 'v1-uuid',
      address: v1ContentAddress,
      meta: { version: 1 },
      timestamp: Date.now(),
      previous: null,
    });

    const v2ContentAddress = await pheme.storage.write(Buffer.from('V2'));
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
    assert.deepEqual(
      await pheme.storage.read(v1Node.contentAddress).then((buffer) => buffer.toString()),
      'V1'
    );

    assert.deepEqual(v2Node.block.meta.version, 2);
    assert.deepEqual(
      await pheme.storage.read(v2Node.contentAddress).then((buffer) => buffer.toString()),
      'V2'
    );

    await pheme
      .replaceFromHandle(
        HANDLE,
        'v1-uuid',
        {
          path: 'content.txt',
          content: Buffer.from('V1-NEW'),
        },
        v1Node.block.meta
      )
      .execute();
    const patchedChain = await pheme.loadHandle(HANDLE).execute();

    // ensure that v2 node is converted to await v.loadContainer();
    assert(patchedChain[0].address.includes('block.json'));
    // ensure that v1 node is converted to v3
    assert(patchedChain[1].address.includes('block.json'));
    // ensure that the content is updated
    assert.deepEqual(
      await pheme.storage.read(patchedChain[1].contentAddress).then((buffer) => buffer.toString()),
      'V1-NEW'
    );
  });

  it('should be able to deal with assets', async () => {
    await pheme.registry.setPointer(HANDLE, '').execute();
    const testAsset = Buffer.from('TEST ASSET');
    const testAssetAddress = await pheme.storage.write(testAsset);

    const testContent = Buffer.from('TEST CONTENT');
    await pheme
      .pushToHandle(
        HANDLE,
        { path: 'content.txt', content: testContent },
        {},
        { 'test.txt': testAssetAddress }
      )
      .execute();

    const [node] = await pheme.loadHandle(HANDLE).execute();
    const loadedAsset = await pheme.storage.read(node.resolve('test.txt'));
    assert.equal(testAsset.toString(), loadedAsset.toString());
  });
});
