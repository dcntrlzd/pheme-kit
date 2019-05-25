import * as URL from 'url';
import IPFS from 'ipfs-http-client';
import axios from 'axios';

import { PROTOCOL_PATTERN, V3_CONTENT_ADDRESS } from '../constants';
import { Block } from '../types';
import ChainNode from './chain-node';

// TODO: Introduce a clas called container whcih takes care of directory wrapping etc.
// TODO: Extend Container to Become ChainNode

export interface DAGNode {
  data: Buffer;
  links: any[];
  multihash: number[];
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPFSFileReference {
  path: string;
  hash: string;
  size?: number;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPFSFileResponse {
  path: string;
  content: Buffer;
}

export interface AssetMap {
  [path: string]: string;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
interface IPFSPeerInfo {
  addr: any /* MultiAddr */;
  peer: string /* PeerId */;
  muxer: string;
  latency?: string;
  streams?: string[];
}

type WritableData = string | Buffer;
export interface WritableObject {
  path: string;
  content: WritableData;
}
type Writable = WritableData | WritableObject | WritableObject[];

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPFSClient {
  swarm: {
    peers: (opts?: { verbose: boolean }) => Promise<IPFSPeerInfo[]>;
  };
  pin: {
    add: (hash: string, options?: any) => Promise<void>;
    ls: (hash?: string, options?: any) => Promise<{ hash: string; type: string }[]>;
    rm: (hash, options?: any) => Promise<void>;
  };
  object: any; // TODO: fill
  add: (object: Writable, options?: any) => Promise<IPFSFileReference[]>;
  get: (ipfsPath: string) => Promise<IPFSFileResponse[]>;
}

export const stripProtocol = (url: string) => {
  return url.replace(PROTOCOL_PATTERN, '');
};

export const getIPFSAddressFor = (address: string): string => {
  return stripProtocol(address);
};

export const buildIPFSInstaceFromUrl = (url: string): IPFSClient => {
  const uri = URL.parse(url);

  const protocol = (uri.protocol || 'http').replace(/:$/, '');
  const port = uri.port || (protocol === 'https' ? '443' : '80');
  return IPFS(uri.hostname, port, { protocol }) as IPFSClient;
};

export default class PhemeStorage {
  public readonly ipfs: IPFSClient;

  public readonly gateway: IPFSClient;

  public readonly gatewayUrl: string;

  private static BLOCK_FILENAME = 'block.json';

  private static ASSETS_DIRECTORY = 'assets';

  public constructor(rpcUrl: string, gatewayUrl?: string) {
    this.gatewayUrl = gatewayUrl || rpcUrl;

    this.ipfs = buildIPFSInstaceFromUrl(rpcUrl);
    this.gateway = buildIPFSInstaceFromUrl(this.gatewayUrl);
  }

  public addressForEstimation = () => 'qmv8ndh7ageh9b24zngaextmuhj7aiuw3scc8hkczvjkww';

  public static serialize(input: any) {
    return JSON.stringify(input);
  }

  public static deserialize(input: string) {
    return JSON.parse(input);
  }

  public publicUrlFor(address: string) {
    if (!address) return '';

    const ipfsAddress = getIPFSAddressFor(address);
    return ipfsAddress ? `${this.gatewayUrl}/ipfs/${ipfsAddress}` : '';
  }

  public async readData(address: string) {
    // https://github.com/axios/axios/issues/907
    // https://github.com/axios/axios/issues/1516
    const { data } = await axios.get(this.publicUrlFor(address), {
      responseType: 'text',
      transformResponse: undefined,
    });

    return Buffer.from(data);
  }

  public readContent(node: ChainNode) {
    return this.readData(node.getContentAddress());
  }

  public readAsset(node: ChainNode, path: string) {
    return this.readData(node.getAssetAddress(path));
  }

  public async store(writable: Writable, estimate: boolean = false) {
    return this.ipfs.add(writable, { onlyHash: estimate, wrapWithDirectory: true });
  }

  // public async get(address: string) {
  //   https://gateway.ipfs.io/api/v0/object/get\?arg\=QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
  // }

  public async writeData(data: any, estimate: boolean = false) {
    const [{ hash }] = await this.ipfs.add(data, { onlyHash: estimate, recursive: true });
    return hash;
  }

  public async readObject(address: string): Promise<any> {
    return PhemeStorage.deserialize((await this.readData(address)).toString());
  }

  public async writeObject(object: any, estimate: boolean = false): Promise<string> {
    return this.writeData(Buffer.from(PhemeStorage.serialize(object)), estimate);
  }

  public async patchNode(
    node: ChainNode,
    changes: {
      uuid?: string;
      content?: WritableObject;
      meta?: any;
      timestamp?: number;
      previous?: string;
      assets?: AssetMap;
    }
  ): Promise<ChainNode> {
    let nodeToPatch: ChainNode;
    if (['v1', 'v2'].includes(node.blockVersion)) {
      const root = await this.ipfs.object.new('unixfs-dir').then((cid) => cid.toString());
      const wrappedBlock = await this.ipfs.object.patch.addLink(root, {
        name: PhemeStorage.BLOCK_FILENAME,
        cid: node.root,
      });
      nodeToPatch = new ChainNode(`${wrappedBlock}/${PhemeStorage.BLOCK_FILENAME}`, node.block);
    } else {
      nodeToPatch = node;
    }

    const { root: initialAddress, block: blockToPatch } = nodeToPatch;
    const { content, assets, ...blockPatch } = changes;

    let files = [];
    let block = blockToPatch;

    if (Object.keys(blockPatch).length > 0 || !!content) {
      ({ files, block } = await this.storeBlock(
        {
          ...blockToPatch,
          ...blockPatch,
        },
        content
      ));
    }

    const changesToApply = files.filter((item) => item.path !== '');
    if (assets) {
      try {
        await this.ipfs.get(`${initialAddress}/${PhemeStorage.ASSETS_DIRECTORY}`);
      } catch (e) {
        changesToApply.push({
          path: PhemeStorage.ASSETS_DIRECTORY,
          hash: await this.ipfs.object.new('unixfs-dir').then((cid) => cid.toString()),
        });
      }
      Object.keys(assets).forEach((key) => {
        changesToApply.push({
          path: `${PhemeStorage.ASSETS_DIRECTORY}/${key}`,
          hash: assets[key],
        });
      });
    }

    let patchedAddress = initialAddress;
    for (const change of changesToApply) {
      const update = await this.ipfs.object.patch.addLink(patchedAddress, {
        name: change.path,
        cid: change.hash,
      });

      patchedAddress = update.toString();
    }

    return new ChainNode(`${patchedAddress}/${PhemeStorage.BLOCK_FILENAME}`, block);
  }

  // TODO: Move to storage
  public async createNode(
    block: Block,
    { content, assets }: { content?: WritableObject; assets?: AssetMap } = {}
  ): Promise<ChainNode> {
    const { files, block: savedBlock } = await this.storeBlock(block, content);
    const root = files.find((item) => item.path === '');
    const node = new ChainNode(`${root.hash}/${PhemeStorage.BLOCK_FILENAME}`, savedBlock);

    return assets ? this.patchNode(node, { assets }) : node;
  }

  // TODO: Move to storage
  private async storeBlock(block: Block, content?: WritableObject) {
    const blockToWrite = { ...block };
    const items = [];

    if (content) {
      blockToWrite.address = content.path;
      items.push(content);
    }

    items.push({
      path: PhemeStorage.BLOCK_FILENAME,
      content: Buffer.from(JSON.stringify(blockToWrite)),
    });

    return { files: await this.store(items), block: blockToWrite };
  }
}
