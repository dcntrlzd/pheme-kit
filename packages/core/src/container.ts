import { IPFSFileReference } from './types';

export type WritableContent = Buffer;
export type WritableLink = string;

export interface ContainerWritableContent {
  path: string;
  content: WritableContent;
}

export interface ContainerWritableLink {
  path: string;
  hash: WritableLink;
}

export type ContainerWritable = ContainerWritableContent | ContainerWritableLink;

export default class Container {
  public readonly address: string;

  public static readonly SEPARATOR = '/';

  public readonly items: IPFSFileReference[];

  public readonly ipfs: any;

  public static getDirname = (path: string) => {
    const sections = path.split(Container.SEPARATOR);
    sections.pop();
    return sections.filter((part) => part !== '').join(Container.SEPARATOR);
  };

  public static resolve(address: string, path: string) {
    const sections = path.split(Container.SEPARATOR).filter((part) => part !== '');
    return [address, ...sections].join(Container.SEPARATOR);
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

    const directoryContent = Buffer.from('');

    const filesToAdd = [
      ...writableContents,
      ...directoriesToInitialize.map((path) => ({
        path,
        data: directoryContent,
      })),
    ];

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
    const listDirectory = async (path: string, depthLimit = 5) => {
      const items: IPFSFileReference[] = await ipfs.ls(path);
      const directories = items.filter((item) => item.type === 'dir');
      const files = items.filter((item) => !directories.includes(item));

      if (depthLimit > 0) {
        for (const directory of directories) {
          const replacement = await listDirectory(`${path}/${directory.name}`, depthLimit - 1);
          files.push(...replacement);
        }
      }

      return files;
    };

    const items = await listDirectory(address);
    const root = [address, Container.SEPARATOR].join('');

    return new Container(
      ipfs,
      address,
      items.map(({ path, hash }) => ({
        path: path.replace(root, ''),
        hash,
      }))
    );
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

    this.items.forEach((writable) => {
      changeMap[writable.path] = writable;
    });

    updates.forEach((writable) => {
      changeMap[writable.path] = writable;
    });

    return Container.create(this.ipfs, Object.values(changeMap), onlyHash);
  }
}
