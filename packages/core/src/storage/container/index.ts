import { IPFSFileReference } from '../../types';

type WriableData = Buffer;
type WritableLink = string;

export interface ContainerWritableContent {
  path: string;
  content: WriableData;
}

export interface ContainerWritableLink {
  path: string;
  hash: WritableLink;
}

export type ContainerWritable = ContainerWritableContent | ContainerWritableLink;

export default class Container {
  public readonly address: string;

  public static readonly SEPARATOR = '/';

  public static readonly EMPTY_FILENAME = '.empty';

  public readonly items: IPFSFileReference[];

  public readonly ipfs: any;

  protected static getDirname = (path: string) => {
    const parts = path.split(Container.SEPARATOR);
    parts.pop();
    return parts.join(Container.SEPARATOR);
  };

  public static resolve(address: string, path: string) {
    return [address, path].join(Container.SEPARATOR);
  }

  public static async create(
    ipfs: any,
    contents: ContainerWritable[],
    onlyHash = false
  ): Promise<Container> {
    const writableContents: ContainerWritableContent[] = contents.filter(
      (content) => !!(content as ContainerWritableContent).content
    ) as ContainerWritableContent[];

    const writableLinks: ContainerWritableLink[] = contents.filter(
      (content) => !!(content as ContainerWritableLink).hash
    ) as ContainerWritableLink[];

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

    const emptyFile = Buffer.from('');

    const filesToAdd = [
      ...writableContents,
      ...directoriesToInitialize.map((path) => ({
        path: [path, Container.EMPTY_FILENAME].join(Container.SEPARATOR),
        data: emptyFile,
      })),
    ];

    if (!writableContents.length)
      filesToAdd.push({ path: Container.EMPTY_FILENAME, data: emptyFile });

    const allItems: IPFSFileReference[] = await ipfs.add(filesToAdd, {
      onlyHash,
      recursive: true,
      wrapWithDirectory: true,
    });

    const wrapper = allItems.find((item) => item.path === '');
    let address = wrapper.hash;

    if (onlyHash) return new Container(ipfs, address, [...allItems, ...writableLinks]);

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
    const items = await ipfs.ls(address);
    return new Container(ipfs, address, items.map(({ path, hash }) => ({ path, hash })));
  }

  private constructor(ipfs: any, address: string, items: IPFSFileReference[]) {
    this.ipfs = ipfs;
    this.address = address;
    this.items = items;
  }

  public resolve(path: string) {
    return Container.resolve(this.address, path);
  }

  public patch(updates: ContainerWritable[], onlyHash = false) {
    const changeMap: { [path: string]: ContainerWritable } = {};
    const rootPath = this.resolve('');

    this.items.forEach((writable) => {
      const path = writable.path.replace(rootPath, '');
      changeMap[path] = { ...writable, path };
    });

    updates.forEach((writable) => {
      changeMap[writable.path] = writable;
    });

    return Container.create(this.ipfs, Object.values(changeMap), onlyHash);
  }
}
