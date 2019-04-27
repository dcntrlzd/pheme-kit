import { v4 as generateUuid } from 'uuid';

import Storage from './storage';
import Registry from './registry';

import { ITask, createTask, modifyTask } from './task';
import * as ethers from 'ethers';

export interface IRegistry {
  register: (handle: string) => ITask<void>;

  getPointer: (handle: string) => ITask<string>;
  setPointer: (handle: string, value: any) => ITask<void>;

  getProfile: (handle: string) => ITask<string>;
  setProfile: (handle: string, value: any) => ITask<void>;

  getOwner: (handle: string) => ITask<string>;
  setOwner: (handle: string, value: any) => ITask<void>;

  getHandleByOwner: (owner: string) => ITask<string>;
}

export interface IBlock {
  uuid: string;
  address: string;
  meta: any;
  timestamp: number;
  previous: string;
}

type HandleState = [string, IBlock[]];
type HandleModification = [string, IBlock];

export default class Pheme {

  public static create(config: {
    providerOrSigner: ethers.providers.Provider | ethers.ethers.Signer;
    contractAddress: string;
    ipfsRpcUrl: string;
    ipfsGatewayUrl: string;
  }) {
    const registry = Registry.attach(config.contractAddress, config.providerOrSigner);
    const storage = new Storage(config.ipfsRpcUrl, config.ipfsGatewayUrl);
    return new Pheme(registry, storage);
  }
  public readonly registry: Registry;
  public readonly storage: Storage;

  constructor(registry: Registry, storage: Storage) {
    if (!registry) throw new Error('Cannot initialize without a valid registry supplied.');
    this.registry = registry;

    if (!storage) throw new Error('Cannot initialize without a valid storage supplied.');
    this.storage = storage;
  }

  public registerHandle(handle: string): ITask<void> {
    return this.registry.register(handle);
  }

  public getHandleProfile(handle: string): ITask<any> {
    const task = this.registry.getProfile(handle);
    return modifyTask(task, {
      execute: () =>
        task.execute().then((profileAddress: string) => {
          if (!profileAddress) return;
          return this.storage.readObject(profileAddress);
        }),
    });
  }

  public updateHandleProfile(handle: string, profile: any, links: string[] = []): ITask<string> {
    return createTask({
      estimate: async () => {
        return this.registry.setProfile(handle, this.storage.addressForEstimation()).estimate();
      },
      execute: async (context) => {
        const profileAddress = await this.storage.writeObject(profile);
        await this.registry.setProfile(handle, profileAddress).execute(context);
        return profileAddress;
      },
    });
  }

  public pushToHandle(
    handle: string,
    data: Buffer,
    meta: any = {},
    links: string[] = []
  ): ITask<HandleModification> {
    return createTask({
      estimate: () =>
        this.registry.setPointer(handle, this.storage.addressForEstimation()).estimate(),
      execute: async (context) => {
        const previous = await this.registry.getPointer(handle).execute();

        const newBlock = {
          uuid: generateUuid(),
          address: await this.storage.writeData(data),
          timestamp: Date.now(),
          meta,
          previous,
        } as IBlock;

        const resolvedNewBlock = await newBlock;
        const newBlockAddress = await this.storage.writeObject(resolvedNewBlock);

        await this.registry.setPointer(handle, newBlockAddress).execute(context);
        return [newBlockAddress, newBlock] as [string, IBlock];
      },
    });
  }

  public replaceFromHandle(
    handle: string,
    uuid: string,
    data: Buffer,
    meta: any = {},
    links: string[] = []
  ): ITask<HandleState> {
    return this.modifyHandleBlock(handle, uuid, async (oldBlock) => {
      const newBlock: IBlock = {
        ...oldBlock,
        address: await this.storage.writeData(data),
        meta,
      };

      const newBlockAddress = await this.storage.writeObject(newBlock);
      return [newBlockAddress, newBlock];
    });
  }

  public removeFromHandle(handle: string, uuid: string): ITask<HandleState> {
    return this.modifyHandleBlock(handle, uuid, () => undefined);
  }

  public loadHandle(handle: string): ITask<HandleState> {
    const task = this.registry.getPointer(handle);

    return modifyTask(task, {
      execute: () =>
        task.execute().then(
          async (storageAddress: string): Promise<HandleState> => {
            const chain: IBlock[] = [];
            if (!storageAddress) return [undefined, []];

            let cursor = storageAddress;

            do {
              const block: IBlock = await this.storage.readObject(cursor);
              chain.push(block);
              cursor = block.previous;
            } while (cursor);

            return [storageAddress, chain];
          }
        ),
    });
  }

  private modifyHandleBlock(
    handle: string,
    uuid: string,
    modify: (block: IBlock) => Promise<HandleModification>
  ): ITask<HandleState> {
    return createTask({
      estimate: () =>
        this.registry.setPointer(handle, this.storage.addressForEstimation()).estimate(),
      execute: async (context) => {
        const blocks: IBlock[] = [];
        const rewrite: IBlock[] = [];
        const [storageAddress, currentBlocks] = await this.loadHandle(handle).execute();

        const blockIndex: number = null;
        let blockToModify: IBlock;

        currentBlocks.forEach((block, index) => {
          if (block.uuid === uuid) {
            blockToModify = block;
          } else if (!blockToModify) {
            rewrite.push({ ...block });
          } else {
            blocks.push(block);
          }
        });

        if (!blockToModify) throw new Error(`${handle} handle does not need modification`);

        let pointer = blockToModify.previous;
        const blockModification = await modify(blockToModify);

        if (blockModification) {
          const [modifiedBlockAddress, modifiedBlock] = blockModification;
          pointer = modifiedBlockAddress;
          blocks.unshift(modifiedBlock);
        }

        while (rewrite.length > 0) {
          const block = rewrite.pop();
          block.previous = pointer;
          pointer = await this.storage.writeObject(block);
          blocks.unshift(block);
        }

        await this.registry.setPointer(handle, pointer).execute(context);
        return [pointer, blocks] as HandleState;
      },
    });
  }
}
