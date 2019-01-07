declare var artifacts: any;
declare var contract: (name: string, callback: (accounts: string[]) => any) => any;

import Pheme from '@pheme-kit/core/src';
import PhemeRegistry from '@pheme-kit/core/src/registry';
import PhemeStorageIpfs from '@pheme-kit/storage-ipfs/src';

import assert = require('assert');
import * as ethers from 'ethers';
import IPFSFactory from 'ipfsd-ctl';

const assertTxEvent = (tx, event, args) => {
  const log = tx.logs.find((log) => log.event === event);
  assert.deepStrictEqual(log.args, args);
};

const HANDLE = 'test';
const PROFILE = { description: 'HELLO' };

contract('E2E Test', (accounts) => {
  const Registry: any = artifacts.require('Registry');
  let registry: any;

  let owner: string;
  let pheme: Pheme<PhemeRegistry>;
  let ipfsServer: any;
  let provider: ethers.providers.Web3Provider;

  before(async () => {
    [owner] = accounts;
    registry = await Registry.deployed();

    provider = new ethers.providers.Web3Provider(registry.constructor.web3.currentProvider);
    const contract = new ethers.Contract(registry.address, registry.abi, provider.getSigner());

    const phemeRegistry = new PhemeRegistry(contract);

    ipfsServer = await new Promise((resolve, reject) => {
      IPFSFactory.create().spawn((err, ipfsd) => {
        if (err) {
          throw err;
          reject(err);
        }

        resolve(ipfsd);
      });
    });

    pheme = new Pheme(phemeRegistry, {
      ipfs: new PhemeStorageIpfs(
        `http://${ipfsServer.api.apiHost}:${ipfsServer.api.apiPort}`,
        `http://${ipfsServer.api.gatewayHost}:${ipfsServer.api.gatewayPort}`
      ),
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
    assert.deepEqual(chainBefore, [undefined, []]);

    await pheme
      .pushToHandle(HANDLE, Buffer.from('# FIRST\nLorem ipsum dolor sit amet.'), { title: 'FIRST' })
      .execute();
    await pheme
      .pushToHandle(HANDLE, Buffer.from('# SECOND\nLorem ipsum dolor sit amet.'), {
        title: 'SECOND',
      })
      .execute();

    const [initialPointer, chain] = await pheme.loadHandle(HANDLE).execute();
    assert(initialPointer);
    assert.equal(chain.length, 2);

    const [secondPost, firstPost] = chain;

    assert(firstPost.uuid);
    assert(firstPost.address);
    assert(firstPost.timestamp);
    assert.deepEqual(firstPost.meta, { title: 'FIRST' });
    assert(!firstPost.previous);
    const firstPostContent = await pheme.storage.readData(firstPost.address);
    assert(firstPostContent.toString(), '# FIRST\nLorem ipsum dolor sit amet.');

    assert(secondPost.uuid);
    assert(secondPost.address);
    assert(secondPost.timestamp);
    assert.deepEqual(secondPost.meta, { title: 'SECOND' });
    assert(secondPost.previous);
    const secondPostContent = await pheme.storage.readData(secondPost.address);
    assert(secondPostContent.toString(), '# SECOND\nLorem ipsum dolor sit amet.');

    await pheme
      .replaceFromHandle(HANDLE, secondPost.uuid, Buffer.from('# SECOND MODIFIED'), {
        title: 'SECOND MODIFIED',
      })
      .execute();
    const [modifiedPointer, [modifedSecondPost, unmodifiedFirstPost]] = await pheme
      .loadHandle(HANDLE)
      .execute();
    assert.notEqual(modifiedPointer, initialPointer);
    assert.deepEqual(unmodifiedFirstPost, firstPost);

    assert.equal(modifedSecondPost.uuid, secondPost.uuid);
    assert.notEqual(modifedSecondPost.address, secondPost.address);
    // TODO: We should update the timestamp as well
    assert.equal(modifedSecondPost.timestamp, secondPost.timestamp);
    assert.deepEqual(modifedSecondPost.meta, { title: 'SECOND MODIFIED' });
    assert.equal(modifedSecondPost.previous, secondPost.previous);
    const modifedSecondPostContent = await pheme.storage.readData(modifedSecondPost.address);
    assert(modifedSecondPostContent.toString(), '# SECOND MODIFIED');

    await pheme.pushToHandle(HANDLE, Buffer.from('# THIRD'), { title: 'THIRD' }).execute();
    await pheme.removeFromHandle(HANDLE, modifedSecondPost.uuid).execute();
    const [finalPointer, [thirdPost, waybackFirstPost]] = await pheme.loadHandle(HANDLE).execute();

    assert.notEqual(finalPointer, modifiedPointer);
    assert.notEqual(finalPointer, initialPointer);
    assert(thirdPost.uuid);
    assert.notEqual(thirdPost.uuid, modifedSecondPost.uuid);
    assert(thirdPost.address);
    assert(thirdPost.timestamp);
    assert.deepEqual(thirdPost.meta, { title: 'THIRD' });
    assert.equal(thirdPost.previous, modifedSecondPost.previous);
    const thirdPostContent = await pheme.storage.readData(thirdPost.address);
    assert(thirdPostContent.toString(), '# THIRD');
  });
});
