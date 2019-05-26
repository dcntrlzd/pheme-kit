import { v4 as generateUuid } from 'uuid';

import * as ethers from 'ethers';
import Storage from './storage';
import Container, { ContainerWritable, ContainerWritableContent } from './storage/container';
import BlockWrapper from './storage/block-wrapper';
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
    ipfsRpcUrl: string;
    ipfsGatewayUrl?: string;
  }) {
    const registry = Registry.attach(config.contractAddress, config.providerOrSigner);
    const { ipfsRpcUrl, ipfsGatewayUrl = config.ipfsRpcUrl } = config;
    const storage = new Storage(ipfsRpcUrl, ipfsGatewayUrl);
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
  ): Task<BlockWrapper> {
    return createTask({
      estimate: async () =>
        this.registry.setPointer(handle, Storage.addressForEstimation()).estimate(),
      execute: async (context) => {
        const previous = await this.registry.getPointer(handle).execute();
        const blockWrapper = await BlockWrapper.create(
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

        await this.registry.setPointer(handle, blockWrapper.address).execute(context);
        return blockWrapper;
      },
    });
  }

  public replaceFromHandle(
    handle: string,
    uuid: string,
    content: ContainerWritableContent,
    meta: any = {},
    assets?: AssetMap
  ): Task<BlockWrapper[]> {
    return this.modifyHandleBlock(handle, uuid, async (blockWrapper) => {
      const blockPatch: Partial<Block> = { meta, address: content.path };
      const files = [...convertAssetMapToWritable(assets), content];
      return blockWrapper.patch(this.storage.toWrite, blockPatch, files);
    });
  }

  public removeFromHandle(handle: string, uuid: string): Task<BlockWrapper[]> {
    return this.modifyHandleBlock(handle, uuid, () => undefined);
  }

  public loadHandle(handle: string): Task<BlockWrapper[]> {
    const task = this.registry.getPointer(handle);
    return modifyTask(task, {
      execute: () =>
        task.execute().then(
          async (address: string): Promise<BlockWrapper[]> => {
            const chain: BlockWrapper[] = [];
            if (!address) return [];

            let cursor = address;

            do {
              const blockWrapper = await BlockWrapper.load(this.storage.toRead, cursor);
              chain.push(blockWrapper);
              cursor = blockWrapper.block.previous;
            } while (cursor);

            return chain;
          }
        ),
    });
  }

  private modifyHandleBlock(
    handle: string,
    uuid: string,
    modify: (blockWrapper: BlockWrapper) => Promise<BlockWrapper>
  ): Task<BlockWrapper[]> {
    return createTask({
      estimate: () => this.registry.setPointer(handle, Storage.addressForEstimation()).estimate(),
      execute: async (context) => {
        const modifiedChain: BlockWrapper[] = [];
        const rewrite: BlockWrapper[] = [];
        const currentChain = await this.loadHandle(handle).execute();

        let blockWrapperToModify: BlockWrapper;
        currentChain.forEach((blockWrapper) => {
          if (blockWrapper.block.uuid === uuid) {
            blockWrapperToModify = blockWrapper;
          } else if (!blockWrapperToModify) {
            rewrite.push(blockWrapper);
          } else {
            modifiedChain.push(blockWrapper);
          }
        });

        if (!blockWrapperToModify) throw new Error(`${handle} handle does not need modification`);

        let pointer = blockWrapperToModify.block.previous;
        const modifiedBlockWrapper = await modify(blockWrapperToModify);

        if (modifiedBlockWrapper) {
          pointer = modifiedBlockWrapper.address;
          modifiedChain.unshift(modifiedBlockWrapper);
        }

        while (rewrite.length > 0) {
          const blockWrapperToRewrite = rewrite.pop();
          const rewrittenBlockWrapper = await blockWrapperToRewrite.patch(this.storage.toWrite, {
            previous: pointer,
          });
          pointer = rewrittenBlockWrapper.address;
          modifiedChain.unshift(rewrittenBlockWrapper);
        }

        await this.registry.setPointer(handle, pointer).execute(context);
        return modifiedChain;
      },
    });
  }
}
