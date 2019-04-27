import * as URL from 'url';
import IPFS from 'ipfs-http-client';
import axios from 'axios';

const PROTOCOL_PATTERN = /([a-zA-Z0-9]+):\/\/([a-zA-Z0-9]+)/;

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

export interface IIPFSClient {
  swarm: {
    peers: (opts?: { verbose: boolean }) => Promise<IPFSPeerInfo[]>;
  };
  pin: {
    add: (hash: string, options?: any) => Promise<void>;
    ls: (hash?: string, options?: any) => Promise<Array<{ hash: string; type: string }>>;
    rm: (hash, options?: any) => Promise<void>;
  };
  add: (object: Buffer, options?: any) => Promise<IIPFSFileReference[]>;
  get: (ipfsPath: string) => Promise<IIPFSFileResponse[]>;
}

export const stripProtocol = (url: string) => {
  const matches = url.match(PROTOCOL_PATTERN);
  return matches ? matches[2] : url;
};

export default class PhemeStorage {
  public readonly ipfs: IIPFSClient;
  public readonly gatewayUrl: string;

  constructor(rpcUrl: string, gatewayUrl: string) {
    const uri = URL.parse(rpcUrl);

    this.gatewayUrl = gatewayUrl;
    this.ipfs = IPFS(uri.hostname, uri.port || '5001', {
      protocol: (uri.protocol || 'http').replace(/\:$/, ''),
    }) as IIPFSClient;
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

    const ipfsHash = stripProtocol(address);
    return ipfsHash ? `${this.gatewayUrl}/ipfs/${ipfsHash}` : '';
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

  public async writeData(data: Buffer, estimate: boolean = false) {
    const [{ hash }] = await this.ipfs.add(data, { onlyHash: estimate });
    return hash;
  }

  public async readObject(address: string): Promise<any> {
    return this.deserialize((await this.readData(address)).toString());
  }

  public async writeObject(object: any, estimate: boolean = false): Promise<string> {
    return this.writeData(Buffer.from(this.serialize(object)), estimate);
  }
}
