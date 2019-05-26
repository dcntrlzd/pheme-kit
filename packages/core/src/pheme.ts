import { v4 as generateUuid } from 'uuid';

import * as ethers from 'ethers';
import Storage from './storage';
import Container, { ContainerWritable, ContainerWritableContent } from './container';
import WrappedBlock from './wrapped-block';
import Registry from './registry';

import { Task, createTask, modifyTask } from './task';
import { Block } from './types';

export interface AssetMap {
  [path: string]: string;
}

const convertAssetMapToWritable = (assetMap: AssetMap = {}) =>
  Object.keys(assetMap).reduce(
    (acc, path) => {
      return [
        ...acc,
        {
          path,
          hash: assetMap[path],
        },
      ];
    },
    [] as ContainerWritable[]
  );

export default class Pheme {
  public static create(config: {
    providerOrSigner: ethers.providers.Provider | ethers.ethers.Signer;
    contractAddress: string;
    ipfsApiUrl: string;
    ipfsGatewayUrl?: string;
  }) {
    const registry = Registry.attach(config.contractAddress, config.providerOrSigner);
    const { ipfsApiUrl, ipfsGatewayUrl = config.ipfsApiUrl } = config;
    const storage = new Storage(ipfsApiUrl, ipfsGatewayUrl);
    return new Pheme(registry, storage);
  }

  public readonly registry: Registry;

  public readonly storage: Storage;

  public constructor(registry: Registry, storage: Storage) {
    if (!registry) throw new Error('Cannot initialize without a valid registry supplied.');
    this.registry = registry;

    if (!storage) throw new Error('Cannot initialize without a valid storage supplied.');
    this.storage = storage;
  }

  public registerHandle(handle: string): Task<void> {
    return this.registry.register(handle);
  }

  public getHandleProfile(handle: string): Task<any> {
    const task = this.registry.getProfile(handle);
    return modifyTask(task, {
      execute: () =>
        task.execute().then((profileAddress: string) => {
          if (!profileAddress) return undefined;
          return this.storage.readObject(profileAddress);
        }),
    });
  }

  public updateHandleProfile(handle: string, profile: any, assets?: AssetMap): Task<string> {
    const profileFilename = 'profile.json';

    const profileFile: ContainerWritable = {
      path: profileFilename,
      content: Buffer.from(Storage.serialize(profile)),
    };

    const files = [...convertAssetMapToWritable(assets), profileFile];

    return createTask({
      estimate: async () =>
        this.registry.setProfile(handle, Storage.addressForEstimation()).estimate(),
      execute: async (context) => {
        const container = await Container.create(this.storage.toWrite, files);
        const profileAddress = container.resolve(profileFilename);
        await this.registry.setProfile(handle, profileAddress).execute(context);
        return profileAddress;
      },
    });
  }

  public pushToHandle(
    handle: string,
    content: ContainerWritableContent,
    meta: any = {},
    assets?: AssetMap
  ): Task<WrappedBlock> {
    return createTask({
      estimate: async () =>
        this.registry.setPointer(handle, Storage.addressForEstimation()).estimate(),
      execute: async (context) => {
        const previous = await this.registry.getPointer(handle).execute();
        const wrappedBlock = await WrappedBlock.create(
          this.storage.toWrite,
          {
            uuid: generateUuid(),
            address: content.path,
            timestamp: Date.now(),
            meta,
            previous,
          },
          [...convertAssetMapToWritable(assets), content]
        );

        await this.registry.setPointer(handle, wrappedBlock.address).execute(context);
        return wrappedBlock;
      },
    });
  }

  public replaceFromHandle(
    handle: string,
    uuid: string,
    content: ContainerWritableContent,
    meta: any = {},
    assets?: AssetMap
  ): Task<WrappedBlock[]> {
    return this.modifyHandleBlock(handle, uuid, async (wrappedBlock) => {
      const blockPatch: Partial<Block> = { meta, address: content.path };
      const files = [...convertAssetMapToWritable(assets), content];
      return wrappedBlock.patch(this.storage.toWrite, blockPatch, files);
    });
  }

  public removeFromHandle(handle: string, uuid: string): Task<WrappedBlock[]> {
    return this.modifyHandleBlock(handle, uuid, () => undefined);
  }

  public loadHandle(handle: string): Task<WrappedBlock[]> {
    const task = this.registry.getPointer(handle);
    return modifyTask(task, {
      execute: () =>
        task.execute().then(
          async (address: string): Promise<WrappedBlock[]> => {
            const chain: WrappedBlock[] = [];
            if (!address) return [];

            let cursor = address;

            do {
              const wrappedBlock = await WrappedBlock.load(this.storage.toRead, cursor);
              chain.push(wrappedBlock);
              cursor = wrappedBlock.block.previous;
            } while (cursor);

            return chain;
          }
        ),
    });
  }

  private modifyHandleBlock(
    handle: string,
    uuid: string,
    modify: (wrappedBlock: WrappedBlock) => Promise<WrappedBlock>
  ): Task<WrappedBlock[]> {
    return createTask({
      estimate: () => this.registry.setPointer(handle, Storage.addressForEstimation()).estimate(),
      execute: async (context) => {
        const modifiedChain: WrappedBlock[] = [];
        const rewrite: WrappedBlock[] = [];
        const currentChain = await this.loadHandle(handle).execute();

        let wrappedBlockToModify: WrappedBlock;
        currentChain.forEach((wrappedBlock) => {
          if (wrappedBlock.block.uuid === uuid) {
            wrappedBlockToModify = wrappedBlock;
          } else if (!wrappedBlockToModify) {
            rewrite.push(wrappedBlock);
          } else {
            modifiedChain.push(wrappedBlock);
          }
        });

        if (!wrappedBlockToModify) throw new Error(`${handle} handle does not need modification`);

        let pointer = wrappedBlockToModify.block.previous;
        const modifiedwrappedBlock = await modify(wrappedBlockToModify);

        if (modifiedwrappedBlock) {
          pointer = modifiedwrappedBlock.address;
          modifiedChain.unshift(modifiedwrappedBlock);
        }

        while (rewrite.length > 0) {
          const wrappedBlockToRewrite = rewrite.pop();
          const rewrittenwrappedBlock = await wrappedBlockToRewrite.patch(this.storage.toWrite, {
            previous: pointer,
          });
          pointer = rewrittenwrappedBlock.address;
          modifiedChain.unshift(rewrittenwrappedBlock);
        }

        await this.registry.setPointer(handle, pointer).execute(context);
        return modifiedChain;
      },
    });
  }
}
