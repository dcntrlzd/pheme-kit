import { V1_PATTERN, V2_PATTERN, V3_PATTERN, PROTOCOL_PATTERN } from './constants';
import { Block, BlockVersion } from './types';

import Container, { ContainerWritable } from './container';
import Storage from './storage';

export const detectBlockVersion = (address: string): BlockVersion => {
  if (V1_PATTERN.test(address)) return 'v1';
  if (V2_PATTERN.test(address)) return 'v2';
  if (V3_PATTERN.test(address)) return 'v3';
  throw new Error(`Unrecognized address: ${address}`);
};

export default class WrappedBlock {
  public readonly block: Block;

  public readonly storage: Storage;

  public readonly address: string;

  private static BLOCK_FILENAME = 'block.json';

  private constructor(storage: Storage, address: string, block?: Block) {
    this.storage = storage;
    this.address = address;
    this.block = block;
  }

  public get isLoaded() {
    return !!this.block;
  }

  public get blockVersion(): BlockVersion {
    return detectBlockVersion(this.address);
  }

  public get root() {
    switch (this.blockVersion) {
      case 'v1':
      case 'v2':
        return this.block.address.replace(PROTOCOL_PATTERN, '');
      case 'v3':
        return this.address.split('/')[0];
      default:
        throw new Error(`Unable to locate root for block version: ${this.blockVersion}`);
    }
  }

  public resolve(address: string) {
    switch (this.blockVersion) {
      case 'v1':
      case 'v2':
        return address.replace(PROTOCOL_PATTERN, '');
      case 'v3':
        return Container.resolve(this.root, address);
      default:
        throw new Error(`Unable to resolve path for version: ${this.blockVersion}`);
    }
  }

  public urlFor(address: string) {
    return this.storage.publicUrlFor(this.resolve(address));
  }

  public get contentAddress() {
    return this.resolve(this.block.address);
  }

  private get containerAddress() {
    return this.blockVersion === 'v3' ? this.root : undefined;
  }

  public loadContainer() {
    if (!this.containerAddress) throw new Error('This block does not have a container');
    return Container.load(this.storage.writer, this.containerAddress);
  }

  private ensureContainer(onlyHash = false) {
    if (!this.isLoaded) throw new Error('Block is not loaded yet.');
    if (!this.containerAddress) {
      return Container.create(
        this.storage.writer,
        [
          {
            path: WrappedBlock.BLOCK_FILENAME,
            hash: this.root,
          },
        ],
        onlyHash
      );
    }
    return this.loadContainer();
  }

  private static serializeBlock(block: Block) {
    return JSON.stringify(block);
  }

  private static deserialize(data: any) {
    return JSON.parse(data) as Block;
  }

  public static async load(storage: Storage, address: string) {
    const addressToLoad =
      detectBlockVersion(address) !== 'v3' ? address.replace(PROTOCOL_PATTERN, '') : address;
    const block = await storage.readObject(addressToLoad);
    return new WrappedBlock(storage, address, block);
  }

  public static async create(
    storage: Storage,
    block: Block,
    files: ContainerWritable[] = [],
    onlyHash = false
  ) {
    const contents = [
      ...files.filter((writable) => writable.path !== WrappedBlock.BLOCK_FILENAME),
      {
        path: WrappedBlock.BLOCK_FILENAME,
        content: Buffer.from(WrappedBlock.serializeBlock(block)),
      },
    ];

    const container = await Container.create(storage.writer, contents, onlyHash);
    return new WrappedBlock(storage, container.resolve(WrappedBlock.BLOCK_FILENAME), block);
  }

  public async patch(
    blockPatch: Partial<Block>,
    files: ContainerWritable[] = [],
    onlyHash = false
  ) {
    const patchedBlock = { ...this.block, ...blockPatch };
    const contents = [
      ...files.filter((writable) => writable.path !== WrappedBlock.BLOCK_FILENAME),
      {
        path: WrappedBlock.BLOCK_FILENAME,
        content: Buffer.from(WrappedBlock.serializeBlock(patchedBlock)),
      },
    ];

    const container = await this.ensureContainer();
    const patchedContainer = await container.patch(contents, onlyHash);
    return new WrappedBlock(
      this.storage,
      patchedContainer.resolve(WrappedBlock.BLOCK_FILENAME),
      patchedBlock
    );
  }
}
