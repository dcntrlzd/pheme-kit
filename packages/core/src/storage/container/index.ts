import { IPFSFileReference } from '../index';

type WriableData = string | Buffer;
type WritableLink = string;

interface WritableContentObject {
  path: string;
  content: WriableData;
}

interface WritableLinkObject {
  path: string;
  hash: WritableLink;
}

export type WritableObject = WritableContentObject | WritableLinkObject;

export default class Container {
  public readonly address: string;

  public static readonly SEPARATOR = '/';

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

  protected static getDirname = (path: string) => {
    const parts = path.split(Container.SEPARATOR);
    parts.pop();
    return parts.join(Container.SEPARATOR);
  };

  public static async create(
    ipfs: any,
    contents: WritableObject[],
    onlyHash = false
  ): Promise<Container> {
    const writableContents: WritableContentObject[] = contents.filter(
      (content) => !!(content as WritableContentObject).content
    ) as WritableContentObject[];

    const writableLinks: WritableLinkObject[] = contents.filter(
      (content) => !!(content as WritableLinkObject).hash
    ) as WritableLinkObject[];

    const linkDirectories = writableLinks
      .map((link) => Container.getDirname(link.path))
      .filter((path) => !!path);
    const contentDirectories = writableContents
      .map((link) => Container.getDirname(link.path))
      .filter((path) => !!path);
    const directoriesToInitialize = linkDirectories.filter(
      (path) => !contentDirectories.includes(path)
    );
    // TODO: optimize it initialize only the deepest directories

    const filesToAdd = [
      ...writableContents,
      directoriesToInitialize.map((path) => ({
        path: [path, '.empty'].join(Container.SEPARATOR),
        data: '',
      })),
    ];

    const allItems: IPFSFileReference[] = await ipfs.add(filesToAdd, {
      onlyHash,
      recursive: true,
      wrapWithDirectory: true,
    });

    const wrapper = allItems.find((item) => item.path === '');
    let address = wrapper.hash;

    for (const writableLink of writableLinks) {
      const update = await ipfs.object.patch.addLink(address, {
        name: writableLink.path,
        cid: writableLink.hash,
      });

      address = update.toString();
    }

    return Container.load(ipfs, address);
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

  public resolve(path: string) {
    return [this.address, path].join(Container.SEPARATOR);
  }

  public patch(updates: WritableObject[]) {
    const changeMap: { [path: string]: WritableObject } = {};

    this.items.forEach((writable) => {
      changeMap[writable.path] = writable;
    });

    updates.forEach((writable) => {
      changeMap[writable.path] = writable;
    });

    return Container.create(this.ipfs, Object.values(changeMap));
  }
}
