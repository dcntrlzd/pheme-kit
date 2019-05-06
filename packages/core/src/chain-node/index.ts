import Storage from '../storage';
import {
  V1_PATTERN,
  V2_PATTERN,
  V3_PATTERN,
  V3_CONTENT_ADDRESS,
  PROTOCOL_PATTERN,
} from '../constants';
import { Block, BlockVersion } from '../types';

export const detectBlockVersion = (storageAddress: string): BlockVersion => {
  if (V1_PATTERN.test(storageAddress)) return 'v1';
  if (V2_PATTERN.test(storageAddress)) return 'v2';
  if (V3_PATTERN.test(storageAddress)) return 'v3';
  throw new Error(`Unrecognized address: ${storageAddress}`);
};

export default class ChainNode {
  public readonly block: Block;

  public readonly storage: Storage;

  public readonly address: string;

  public constructor(storage: Storage, address: string, block: Block) {
    this.storage = storage;
    this.address = address;
    this.block = block;
  }

  public get blockVersion(): BlockVersion {
    return detectBlockVersion(this.block.address);
  }

  public get previous() {
    return this.block.previous;
  }

  public get rootAddress() {
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

  public get contentAddress() {
    return this.getResourcePath(this.block.address);
  }

  public getResourcePath(resourceAddress: string) {
    const resourceVersion = detectBlockVersion(resourceAddress);

    switch (resourceVersion) {
      case 'v1':
        return resourceAddress;
      case 'v2':
        return resourceAddress.replace(PROTOCOL_PATTERN, '');
      case 'v3':
        return `${this.rootAddress}${resourceAddress}`;
      default:
        throw new Error(`Unrecognized resource version: ${resourceVersion}`);
    }
  }

  public loadContent(): Promise<Buffer> {
    return this.storage.readData(this.contentAddress);
  }
}
