import { v4 as generateUuid } from 'uuid';

import * as ethers from 'ethers';
import Storage from './storage';
import Registry from './registry';

import { Task, createTask, modifyTask } from './task';
import ChainNode from './chain-node';
import { Block } from './types';

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

  public updateHandleProfile(handle: string, profile: any): Task<string> {
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

  public pushToHandle(handle: string, data: Buffer, meta: any = {}): Task<ChainNode> {
    return createTask({
      estimate: () =>
        this.registry.setPointer(handle, this.storage.addressForEstimation()).estimate(),
      execute: async (context) => {
        const previous = await this.registry.getPointer(handle).execute();

        const node = await this.storage.createNode(
          {
            uuid: generateUuid(),
            address: '',
            timestamp: Date.now(),
            meta,
            previous,
          },
          { content: data }
        );

        await this.registry.setPointer(handle, node.address).execute(context);
        return node;
      },
    });
  }

  public replaceFromHandle(
    handle: string,
    uuid: string,
    data: Buffer,
    meta: any = {}
  ): Task<ChainNode[]> {
    return this.modifyHandleBlock(handle, uuid, async (nodeToReplace) =>
      this.storage.patchNode(nodeToReplace, {
        content: data,
        meta,
      })
    );
  }

  public removeFromHandle(handle: string, uuid: string): Task<ChainNode[]> {
    return this.modifyHandleBlock(handle, uuid, () => undefined);
  }

  public loadHandle(handle: string): Task<ChainNode[]> {
    const task = this.registry.getPointer(handle);
    return modifyTask(task, {
      execute: () =>
        task.execute().then(
          async (address: string): Promise<ChainNode[]> => {
            const chain: ChainNode[] = [];
            if (!address) return [];

            let cursor = address;

            do {
              const block: Block = await this.storage.readObject(cursor);
              chain.push(new ChainNode(this.storage, cursor, block));
              cursor = block.previous;
            } while (cursor);

            return chain;
          }
        ),
    });
  }

  private modifyHandleBlock(
    handle: string,
    uuid: string,
    modify: (node: ChainNode) => Promise<ChainNode>
  ): Task<ChainNode[]> {
    return createTask({
      estimate: () =>
        this.registry.setPointer(handle, this.storage.addressForEstimation()).estimate(),
      execute: async (context) => {
        const modifiedChain: ChainNode[] = [];
        const rewrite: ChainNode[] = [];
        const currentChain = await this.loadHandle(handle).execute();

        let nodeToModify: ChainNode;
        currentChain.forEach((node) => {
          if (node.block.uuid === uuid) {
            nodeToModify = node;
          } else if (!nodeToModify) {
            rewrite.push(node);
          } else {
            modifiedChain.push(node);
          }
        });

        if (!nodeToModify) throw new Error(`${handle} handle does not need modification`);

        let pointer = nodeToModify.previous;
        const modifiedNode = await modify(nodeToModify);

        if (modifiedNode) {
          pointer = modifiedNode.address;
          modifiedChain.unshift(modifiedNode);
        }

        while (rewrite.length > 0) {
          const nodeToRewrite = rewrite.pop();
          const patchedNode = await this.storage.patchNode(nodeToRewrite, {
            previous: pointer,
          });
          pointer = patchedNode.address;
          modifiedChain.unshift(patchedNode);
        }

        await this.registry.setPointer(handle, pointer).execute(context);
        return modifiedChain;
      },
    });
  }
}
