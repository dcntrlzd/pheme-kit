/* eslint-disable @typescript-eslint/interface-name-prefix */
export interface Block<M = any> {
  uuid: string;
  address: string;
  meta: M;
  timestamp: number;
  previous: string;
}

export interface Node<M = any> {
  block: Block<M>;
  address: string;
  previous: string;
}

export type Chain<M = any> = Node<M>[];

export type BlockVersion = 'v1' | 'v2' | 'v3';

export interface DAGNode {
  data: Buffer;
  links: any[];
  multihash: number[];
}

export interface IPFSFileReference {
  path: string;
  hash: string;
  size?: number;
  name?: string;
  type?: string;
}

export interface IPFSFileResponse {
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

type IPFSWritableData = string | Buffer;

export interface IPFSWritableObject {
  path: string;
  content: IPFSWritableData;
}

export type IPFSWritable = IPFSWritableData | IPFSWritableObject | IPFSWritableObject[];

// TODO: Limit to infura methods
export interface IPFSLimitedClient {

}

// TODO: Extend IPFSLimitedClient
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
  refs: any; // TODO: fill
  files: any; // TODO: fill
  add: (object: IPFSWritable, options?: any) => Promise<IPFSFileReference[]>;
  get: (hash: string) => Promise<IPFSFileResponse[]>;
  ls: (hash: string) => Promise<IPFSFileReference[]>;
}
