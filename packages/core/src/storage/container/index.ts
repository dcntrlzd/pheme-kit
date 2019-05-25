import { IPFSFileReference, WritableObject } from '../index';

export default class Container {
  public readonly address: string;

  public readonly items: IPFSFileReference[];

  public readonly ipfs: any;

  public static async wrap(ipfs: any, item: IPFSFileReference): Promise<Container> {
    const wrapper = await ipfs.object.new('unixfs-dir').then((cid) => cid.toString());
    const address = await ipfs.object.patch.addLink(wrapper, {
      name: item.path,
      cid: item.hash,
    });

    return new Container(ipfs, address, [item]);
  }

  public static async create(
    ipfs: any,
    contents: WritableObject[],
    onlyHash = false
  ): Promise<Container> {
    const allItems: IPFSFileReference[] = await ipfs.add(contents, {
      onlyHash,
      recursive: true,
      wrapWithDirectory: true,
    });

    const wrapper = allItems.find((item) => item.path === '');
    const items = allItems.filter((item) => item !== wrapper);

    return new Container(ipfs, wrapper.hash, items);
  }

  public static async load(ipfs: any, address: string): Promise<Container> {
    const items = await ipfs.object.get(address);
    return new Container(ipfs, address, items);
  }

  private constructor(ipfs: any, address: string, items: IPFSFileReference[]) {
    this.ipfs = ipfs;
    this.address = address;
    this.items = items;
  }

  public resolve(address: string) {
    return [this.address, address].join('/');
  }
}
