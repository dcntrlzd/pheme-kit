import * as ethers from 'ethers';
import Pheme from '../pheme';
import { Task, modifyTask, createTask } from '../task';

jest.mock('../registry', () => jest.requireActual('./mocks/registry'));

const buildContentFile = (content: string) => ({
  path: 'content.txt',
  content: Buffer.from(content),
});

describe('modifyTask', () => {
  it('should override the task', async () => {
    const taskBuilder = (): Task => {
      return createTask(
        {
          estimate: async () => ethers.constants.Zero,
          execute: (context) => {
            Object.assign(context, { status: 'DONE' });
            return Promise.resolve();
          },
        },
        { status: 'READY' }
      );
    };

    const baseTask = taskBuilder();
    expect(baseTask.context.status).toBe('READY');
    expect(await baseTask.execute()).toBeUndefined();
    expect(baseTask.context.status).toBe('DONE');

    const taskToBeModified = taskBuilder();
    const modifiedTask = modifyTask(taskToBeModified, {
      execute: () => taskToBeModified.execute().then(() => 'HELLO WORLD'),
    });

    expect(modifiedTask.context.status).toBe('READY');
    expect(await modifiedTask.execute()).toBe('HELLO WORLD');
    expect(modifiedTask.context.status).toBe('DONE');
  });
});

describe('Core', () => {
  let core: Pheme;

  beforeEach(() => {
    core = Pheme.create({
      providerOrSigner: undefined,
      contractAddress: undefined,
      ipfsGatewayUrl: process.env.IPFS_GATEWAY_URL,
      ipfsRpcUrl: process.env.IPFS_RPC_URL,
    });
  });

  describe('constructor', () => {
    it('should be able to initialize', () => {
      expect(core).toBeTruthy();
    });

    it('should not initialize if no registry is passed', () => {
      expect(() => new Pheme(undefined, core.storage)).toThrowError(
        'Cannot initialize without a valid registry supplied.'
      );
    });

    it('should not initialize if no storage is passed', () => {
      expect(() => new Pheme(core.registry, undefined)).toThrowError(
        'Cannot initialize without a valid storage supplied.'
      );
    });
  });

  describe('registerHandle', () => {
    it('should register the supplied handle', async () => {
      expect((core.registry as any).records.test).toBeUndefined();
      expect(await core.registerHandle('test').execute()).toBeUndefined();
      expect((core.registry as any).records.test).toBeDefined();
    });
  });

  describe('getHandleProfile & updateHandleProfile', () => {
    beforeEach(() => core.registerHandle('test').execute());

    it('should update the handle profile', async () => {
      await expect(
        core.updateHandleProfile('test', { bio: 'Hello World' }).execute()
      ).resolves.toBeDefined();
    });

    it('should get the handle profile', async () => {
      await core.updateHandleProfile('test', { bio: 'Hello World' }).execute();
      await expect(core.getHandleProfile('test').execute()).resolves.toEqual({
        bio: 'Hello World',
      });
    });
  });

  describe('pushToHandle', () => {
    beforeEach(() => core.registerHandle('test').execute());

    it('should push content to the supplied handle', async () => {
      await core
        .pushToHandle('test', buildContentFile('CONTENT 1'), { title: 'CONTENT 1' })
        .execute();
      await core
        .pushToHandle('test', buildContentFile('CONTENT 2'), { title: 'CONTENT 2' })
        .execute();
      await core
        .pushToHandle('test', buildContentFile('CONTENT 3'), { title: 'CONTENT 3' })
        .execute();

      const chain = await core.loadHandle('test').execute();
      expect(chain.length).toBe(3);

      chain.forEach((ring, i) => {
        expect(ring.block.address).toBeDefined();
        expect(ring.block.uuid).toBeDefined();
        expect(ring.block.timestamp).toBeDefined();
        expect(ring.block.meta.title).toBe(`CONTENT ${chain.length - i}`);
      });
    });

    it('should pass a blank meta object if not provided', async () => {
      await core.pushToHandle('test', buildContentFile('CONTENT')).execute();
      const chain = await core.loadHandle('test').execute();
      expect(chain[0].block.meta).toEqual({});
    });
  });

  describe('replaceFromHandle', () => {
    beforeEach(async () => {
      await core.registerHandle('test').execute();

      await core
        .pushToHandle('test', buildContentFile('CONTENT 1'), { title: 'CONTENT 1' })
        .execute();
      await core
        .pushToHandle('test', buildContentFile('CONTENT 2'), { title: 'CONTENT 2' })
        .execute();
      await core
        .pushToHandle('test', buildContentFile('CONTENT 3'), { title: 'CONTENT 3' })
        .execute();
    });

    it('should replace the block contents of the block with the supplied uuid', async () => {
      const oldChain = await core.loadHandle('test').execute();
      const oldAddress = oldChain[0].address;
      const blockToReplace = oldChain[1];

      const oldContent = await core.storage.read(blockToReplace.contentAddress);
      expect(oldContent.toString()).toBe('CONTENT 2');

      const newContent = 'CONTENT 2 (MODIFIED)';

      const newChain = await core
        .replaceFromHandle('test', blockToReplace.block.uuid, buildContentFile(newContent), {
          title: newContent,
        })
        .execute();

      expect(newChain).toHaveLength(3);
      expect(newChain[0].address).not.toBe(oldAddress);
      const newBlockWrapper = newChain[1];
      expect(newBlockWrapper.block.meta.title).toBe(newContent);
      expect((await core.storage.read(newBlockWrapper.contentAddress)).toString()).toBe(newContent);
    });
  });

  describe('removeFromHandle', () => {
    describe('with single content', () => {
      beforeEach(async () => {
        await core.registerHandle('test').execute();

        await core
          .pushToHandle('test', buildContentFile('CONTENT 1'), {
            title: 'CONTENT 1',
          })
          .execute();
      });

      it('should remove the content with the supplied uuid for the supplied handle', async () => {
        const oldChain = await core.loadHandle('test').execute();
        await core.removeFromHandle('test', oldChain[0].block.uuid).execute();

        const chain = await core.loadHandle('test').execute();
        expect(chain.length).toBe(0);
        expect(chain.map((blockWrapper) => blockWrapper.block.meta.title)).toEqual([]);
      });
    });

    describe('with multiple content', () => {
      beforeEach(async () => {
        await core.registerHandle('test').execute();

        await core
          .pushToHandle('test', buildContentFile('CONTENT 1'), {
            title: 'CONTENT 1',
          })
          .execute();
        await core
          .pushToHandle('test', buildContentFile('CONTENT 2'), {
            title: 'CONTENT 2',
          })
          .execute();
        await core
          .pushToHandle('test', buildContentFile('CONTENT 3'), {
            title: 'CONTENT 3',
          })
          .execute();
      });

      it('should remove the content with the supplied uuid for the supplied handle', async () => {
        const oldChain = await core.loadHandle('test').execute();
        await core.removeFromHandle('test', oldChain[1].block.uuid).execute();

        const chain = await core.loadHandle('test').execute();
        expect(chain.length).toBe(2);
        expect(chain.map((wrappedBlock) => wrappedBlock.block.meta.title)).toEqual([
          'CONTENT 3',
          'CONTENT 1',
        ]);
        expect(chain[0].address).not.toEqual(oldChain[0].address);
      });

      it('should not remove any content when an invalid uuid is passed', async () => {
        const oldChain = await core.loadHandle('test').execute();

        expect(core.removeFromHandle('test', 'XXXXXX').execute()).rejects.toThrow(
          'test handle does not need modification'
        );

        const chain = await core.loadHandle('test').execute();
        expect(chain.length).toBe(3);
        expect(chain.map((wrappedBlock) => wrappedBlock.block.meta.title)).toEqual([
          'CONTENT 3',
          'CONTENT 2',
          'CONTENT 1',
        ]);
        expect(chain[0].address).toEqual(oldChain[0].address);
      });
    });
  });

  describe('loadHandle', () => {
    beforeEach(() => core.registerHandle('test').execute());

    it('should load the handle for an empty chain', async () => {
      const chain = await core.loadHandle('test').execute();
      expect(chain.length).toEqual(0);
    });

    it('should load the handle for a loaded chain', async () => {
      const newContent = await core
        .pushToHandle('test', buildContentFile('HELLO WORLD'), {
          title: 'HELLO WORLD',
        })
        .execute();

      const secondChain = await core.loadHandle('test').execute();
      expect(newContent.address).toBe(secondChain[0].address);
    });
  });
});
