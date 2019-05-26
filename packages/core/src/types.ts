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

type IPFSWritableData = Buffer;

type IPFSBlock = any;
type CID = any;

export interface IPFSWritableObject {
  path: string;
  content: IPFSWritableData;
}

export type IPFSWritable = IPFSWritableData | IPFSWritableObject | IPFSWritableObject[];

// TODO: Limit to infura methods
export interface IPFSRestrictedClient {
  block: {
    get: (cid: CID) => Promise<IPFSBlock>;
    stat: (cid: CID) => Promise<{ key: string; size: number }>;
  };
  cat: (ipfsPath: string, options?: { offset?: number; length?: number }) => Promise<Buffer>;
  dag: {
    get: (
      cid: CID,
      path?: string,
      options?: { localResolve?: boolean }
    ) => Promise<{ value: Buffer; remainderPath: string }>;
  };
  get: (ipfsPath: string) => Promise<IPFSFileResponse[]>;
  object: {
    data: (multihash: string, options?: { enc?: string }) => Promise<Buffer>;
    get: (multihash: string, options?: { enc?: string }) => Promise<DAGNode>;
    stat: (
      multihash: string,
      options?: { enc?: string }
    ) => Promise<{
      Hash: string;
      NumLinks: number;
      BlockSize: number;
      LinksSize: number;
      DataSize: number;
      CumulativeSize: number;
    }>;
  };
  add: (
    data: IPFSWritable,
    options?: {
      progress?: (progress: number) => any;
      recursive?: boolean;
      hashAlg?: string;
      wrapWithDirectory?: boolean;
      onlyHash?: boolean;
      pin?: boolean;
      chunker?: string;
      'cid-version'?: number;
      'raw-leaves'?: boolean;
    }
  ) => Promise<IPFSFileReference[]>;
}

export interface IPFSClient extends IPFSRestrictedClient {
  swarm: {
    peers: (opts?: { verbose: boolean }) => Promise<IPFSPeerInfo[]>;
  };
  pin: {
    add: (hash: string, options?: any) => Promise<void>;
    ls: (hash?: string, options?: any) => Promise<{ hash: string; type: string }[]>;
    rm: (hash, options?: any) => Promise<void>;
  };
  ls: (hash: string) => Promise<IPFSFileReference[]>;
}
