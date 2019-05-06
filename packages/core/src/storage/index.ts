import * as URL from 'url';
import IPFS from 'ipfs-http-client';
import axios from 'axios';

import { PROTOCOL_PATTERN, V3_CONTENT_ADDRESS } from '../constants';
import { Block } from '../types';
import ChainNode from '../chain-node';

export interface DAGNode {
  data: Buffer;
  links: any[];
  multihash: number[];
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPFSFileReference {
  path: string;
  hash: string;
  size: number;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPFSFileResponse {
  path: string;
  content: Buffer;
}

interface AssetMap {
  [path: string]: Buffer;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
interface IPFSPeerInfo {
  addr: any /* MultiAddr */;
  peer: string /* PeerId */;
  muxer: string;
  latency?: string;
  streams?: string[];
}

type AvailableBlockVersions = 'v1' | 'v2' | 'v3';

type WritableData = string | Buffer;
interface WritableObject {
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
      content?: Buffer;
      meta?: any;
      timestamp?: number;
      previous?: string;
      assets?: AssetMap;
    }
  ): Promise<ChainNode> {
    let nodeToPatch: ChainNode;
    if (['v1', 'v2'].includes(node.blockVersion)) {
      const root = await this.ipfs.object.new().then((cid) => cid.toString());
      const wrappedBlock = await this.ipfs.object.patch.addLink(root, {
        name: 'block.json',
        cid: node.rootAddress,
      });
      nodeToPatch = new ChainNode(this, `${wrappedBlock}/block.json`, node.block);
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
      const update = await this.ipfs.object.patch.addLink(patchedAddress, {
        name: change.path,
        cid: change.hash,
      });

      patchedAddress = update.toString();
    }

    return new ChainNode(this, `${patchedAddress}/block.json`, patchedBlock);
  }

  // TODO: Move to storage
  public async createNode(
    block: Block,
    { content, assets = {} }: { content?: Buffer; assets?: AssetMap } = {}
  ): Promise<ChainNode> {
    const { files, block: savedBlock } = await this.storeBlock(block, { content, assets });
    const root = files.find((item) => item.path === '');

    return new ChainNode(this, `${root.hash}/block.json`, savedBlock);
  }

  // TODO: Move to storage
  private async storeBlock(
    block: Block,
    { content, assets = {} }: { content?: Buffer; assets?: AssetMap } = {}
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

    return { files: await this.store(items), block: blockToWrite };
  }
}
