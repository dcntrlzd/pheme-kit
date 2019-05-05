import { v4 as generateUuid } from 'uuid';
import { sha256 } from 'hash.js';

import Storage from './storage';
import Registry from './registry';

import { ITask, createTask, modifyTask } from './task';
import * as ethers from 'ethers';

import {
  V1_PATTERN,
  V2_PATTERN,
  V3_PATTERN,
  V3_CONTENT_ADDRESS,
  PROTOCOL_PATTERN,
} from './constants';
import { Block, BlockVersion } from './types';

interface IAssetMap {
  [path: string]: Buffer;
}

// TODO: Move to storage
class ChainNode {
  public readonly block: Block;
  public readonly storage: Storage;
  public readonly address: string;

  constructor(storage: Storage, address: string, block: Block) {
    this.storage = storage;
    this.address = address;
    this.block = block;
  }

  get blockVersion(): BlockVersion {
    return detectBlockVersion(this.block.address);
  }

  get previous() {
    return this.block.previous;
  }

  get rootAddress() {
    switch (this.blockVersion) {
      case 'v1':
        return this.block.address;
      case 'v2':
        return this.block.address.replace(PROTOCOL_PATTERN, '');
      case 'v3':
        return this.address.split('/')[0];
      default:
        throw new Error(`Unrecognized block version: ${this.blockVersion}`);
    }
  }

  get contentAddress() {
    let ipfsAddress;

    switch (this.blockVersion) {
      case 'v1':
        ipfsAddress = this.block.address;
        break;
      case 'v2':
        ipfsAddress = this.block.address.replace(PROTOCOL_PATTERN, '');
        break;
      case 'v3':
        ipfsAddress = `${this.rootAddress}${this.block.address}`;
        break;
      default:
        throw new Error(`Unrecognized block version: ${this.blockVersion}`);
    }

    return ipfsAddress;
  }

  public loadContent(): Promise<Buffer> {
    return this.storage.readData(this.contentAddress);
  }
}

type Chain = ChainNode[];

export const detectBlockVersion = (storageAddress: string): BlockVersion => {
  if (V1_PATTERN.test(storageAddress)) return 'v1';
  if (V2_PATTERN.test(storageAddress)) return 'v2';
  if (V3_PATTERN.test(storageAddress)) return 'v3';
  throw new Error(`Unrecognized address: ${storageAddress}`);
};

type HandleState = [string, Block[]];
type HandleModification = [string, Block];

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

  constructor(registry: Registry, storage: Storage) {
    if (!registry) throw new Error('Cannot initialize without a valid registry supplied.');
    this.registry = registry;

    if (!storage) throw new Error('Cannot initialize without a valid storage supplied.');
    this.storage = storage;
  }

  // TODO: Move to storage
  private async patchNode(
    node: ChainNode,
    changes: {
      uuid?: string;
      content?: Buffer;
      meta?: any;
      timestamp?: number;
      previous?: string;
      assets?: IAssetMap;
    }
  ): Promise<ChainNode> {
    let nodeToPatch: ChainNode;
    if (['v1', 'v2'].includes(node.blockVersion)) {
      const root = await this.storage.ipfs.object.new().then((cid) => cid.toString());
      const wrappedBlock = await this.storage.ipfs.object.patch.addLink(root, {
        name: 'block.json',
        cid: node.rootAddress,
      });
      nodeToPatch = new ChainNode(this.storage, `${wrappedBlock}/block.json`, node.block);
    } else {
      nodeToPatch = node;
    }

    const { rootAddress, block } = nodeToPatch;
    const { content, assets, ...blockPatch } = changes;

    const { files, block: patchedBlock } = await this.storeBlock(
      {
        ...block,
        ...blockPatch,
      },
      { content, assets }
    );

    const changesToApply = files.filter((item) => item.path !== '');

    let patchedAddress = rootAddress;
    for (const change of changesToApply) {
      const update = await this.storage.ipfs.object.patch.addLink(patchedAddress, {
        name: change.path,
        cid: change.hash,
      });

      patchedAddress = update.toString();
    }

    return new ChainNode(this.storage, `${patchedAddress}/block.json`, patchedBlock);
  }

  // TODO: Move to storage
  private async createNode(
    block: Block,
    { content, assets = {} }: { content?: Buffer; assets?: IAssetMap } = {}
  ): Promise<ChainNode> {
    const { files, block: savedBlock } = await this.storeBlock(block, { content, assets });
    const root = files.find((item) => item.path === '');

    return new ChainNode(this.storage, `${root.hash}/block.json`, savedBlock);
  }

  // TODO: Move to storage
  private async storeBlock(
    block: Block,
    { content, assets = {} }: { content?: Buffer; assets?: IAssetMap } = {}
  ) {
    const blockToWrite = { ...block };
    const items = [];

    if (content) {
      blockToWrite.address = V3_CONTENT_ADDRESS;
      items.push({
        path: 'content',
        content,
      });
    }

    items.push({
      path: 'block.json',
      content: Buffer.from(JSON.stringify(blockToWrite)),
    });

    Object.keys(assets).forEach((key) => {
      items.push({
        path: `assets/${key}`,
        content: assets[key],
      });
    });

    return { files: await this.storage.store(items), block: blockToWrite };
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

        const { block, address } = await this.createNode(
          {
            uuid: generateUuid(),
            address: '',
            timestamp: Date.now(),
            meta,
            previous,
          },
          { content: data }
        );

        await this.registry.setPointer(handle, address).execute(context);
        return [address, block] as [string, Block];
      },
    });
  }

  public replaceFromHandle(
    handle: string,
    uuid: string,
    data: Buffer,
    meta: any = {},
    links: string[] = []
  ): ITask<Chain> {
    return this.modifyHandleBlock(handle, uuid, async (nodeToReplace) => {
      return await this.patchNode(nodeToReplace, {
        content: data,
        meta,
      });
    });
  }

  public removeFromHandle(handle: string, uuid: string): ITask<Chain> {
    return this.modifyHandleBlock(handle, uuid, () => undefined);
  }

  public loadHandle(handle: string): ITask<Chain> {
    const task = this.registry.getPointer(handle);
    return modifyTask(task, {
      execute: () =>
        task.execute().then(
          async (address: string): Promise<Chain> => {
            const chain: Chain = [];
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
  ): ITask<Chain> {
    return createTask({
      estimate: () =>
        this.registry.setPointer(handle, this.storage.addressForEstimation()).estimate(),
      execute: async (context) => {
        const modifiedChain: Chain = [];
        const rewrite: Chain = [];
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
          const patchedNode = await this.patchNode(nodeToRewrite, {
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
