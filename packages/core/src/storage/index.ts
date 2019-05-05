import * as URL from 'url';
import IPFS from 'ipfs-http-client';
import axios from 'axios';

import { PROTOCOL_PATTERN } from '../constants';

export interface IDAGNode {
  data: Buffer;
  links: any[];
  multihash: number[];
}

export interface IIPFSFileReference {
  path: string;
  hash: string;
  size: number;
}

export interface IIPFSFileResponse {
  path: string;
  content: Buffer;
}

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

export interface IIPFSClient {
  swarm: {
    peers: (opts?: { verbose: boolean }) => Promise<IPFSPeerInfo[]>;
  };
  pin: {
    add: (hash: string, options?: any) => Promise<void>;
    ls: (hash?: string, options?: any) => Promise<Array<{ hash: string; type: string }>>;
    rm: (hash, options?: any) => Promise<void>;
  };
  object: any; // TODO: fill
  add: (object: Writable, options?: any) => Promise<IIPFSFileReference[]>;
  get: (ipfsPath: string) => Promise<IIPFSFileResponse[]>;
}

export const stripProtocol = (url: string) => {
  return url.replace(PROTOCOL_PATTERN, '');
};

export const getIPFSAddressFor = (address: string): string => {
  return stripProtocol(address);
};

export const buildIPFSInstaceFromUrl = (url: string): IIPFSClient => {
  const uri = URL.parse(url);

  const protocol = (uri.protocol || 'http').replace(/\:$/, '');
  const port = uri.port || (protocol === 'https' ? '443' : '80');
  return IPFS(uri.hostname, port, { protocol }) as IIPFSClient;
};

export default class PhemeStorage {
  public readonly ipfs: IIPFSClient;
  public readonly gateway: IIPFSClient;

  public readonly gatewayUrl: string;

  constructor(rpcUrl: string, gatewayUrl: string) {
    const rpcUri = URL.parse(rpcUrl);
    const gatewayUri = URL.parse(gatewayUrl);

    this.gatewayUrl = gatewayUrl;

    this.ipfs = buildIPFSInstaceFromUrl(rpcUrl);
    this.gateway = buildIPFSInstaceFromUrl(gatewayUrl);
  }

  public addressForEstimation = () => 'qmv8ndh7ageh9b24zngaextmuhj7aiuw3scc8hkczvjkww';

  public serialize(input: any) {
    return JSON.stringify(input);
  }

  public deserialize(input: string) {
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

  public async get(address: string) {
    // https://gateway.ipfs.io/api/v0/object/get\?arg\=QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
  }

  public async writeData(data: any, estimate: boolean = false) {
    const [{ hash }] = await this.ipfs.add(data, { onlyHash: estimate, recursive: true });
    return hash;
  }

  public async readObject(address: string): Promise<any> {
    return this.deserialize((await this.readData(address)).toString());
  }

  public async writeObject(object: any, estimate: boolean = false): Promise<string> {
    return this.writeData(Buffer.from(this.serialize(object)), estimate);
  }
}
