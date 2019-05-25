import { V1_PATTERN, V2_PATTERN, V3_PATTERN, PROTOCOL_PATTERN } from '../../constants';
import { Block, BlockVersion } from '../../types';

export const detectBlockVersion = (storageAddress: string): BlockVersion => {
  if (V1_PATTERN.test(storageAddress)) return 'v1';
  if (V2_PATTERN.test(storageAddress)) return 'v2';
  if (V3_PATTERN.test(storageAddress)) return 'v3';
  throw new Error(`Unrecognized address: ${storageAddress}`);
};

export default class ChainNode {
  public readonly block: Block;

  public readonly address: string;

  public constructor(address: string, block: Block) {
    this.address = address;
    this.block = block;
  }

  public get blockVersion(): BlockVersion {
    return detectBlockVersion(this.block.address);
  }

  public get previous() {
    return this.block.previous;
  }

  public get root() {
    switch (this.blockVersion) {
      case 'v1':
        return this.block.address;
      case 'v2':
        return this.block.address.replace(PROTOCOL_PATTERN, '');
      case 'v3':
        return this.address.split('/')[0];
      default:
        throw new Error(`Unable to locate root for block version: ${this.blockVersion}`);
    }
  }

  public getContentAddress() {
    return this.resolve(this.block.address);
  }

  public getAssetAddress(assetPath: string) {
    if (this.blockVersion !== 'v3') {
      return this.resolve(assetPath);
    }

    return this.resolve(`assets/${assetPath}`);
  }

  public resolve(address: string) {
    switch (this.blockVersion) {
      case 'v1':
        return address;
      case 'v2':
        return address.replace(PROTOCOL_PATTERN, '');
      case 'v3':
        return [this.root, address].join('/');
      default:
        throw new Error(`Unable to resolve path for version: ${this.blockVersion}`);
    }
  }
}
