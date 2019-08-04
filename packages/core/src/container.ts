// TODO: Improve path parsing/processing
// TODO: Switch to IPFSRestrictedClient
// TODO: Increase performance (avoid reloading in writeLinks)

import { DAGNode, IPFSFileReference, IPFSClient } from './types';

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

export interface ContainerItem {
  path: string;
  hash: string;
  node: DAGNode;
}
export type ContainerWritable = ContainerWritableContent | ContainerWritableLink;

export default class Container {
  public readonly address: string;

  public static readonly SEPARATOR = '/';

  public readonly items: ContainerItem[];

  public readonly ipfs: IPFSClient;

  public static resolve(address: string, path: string) {
    const sections = path.split(Container.SEPARATOR).filter((part) => part !== '');
    return [address, ...sections].join(Container.SEPARATOR);
  }

  private static validateWritables(writables: ContainerWritable[]) {
    writables.forEach((writable) => {
      if (writable.path.includes(Container.SEPARATOR)){
        throw new Error('Directories insides containers are not supported');
      }
    })
  }

  private static async writeContents(
    ipfs: IPFSClient,
    contents: ContainerWritableContent[]
  ): Promise<Container> {
    const items: IPFSFileReference[] = await ipfs.add(contents, {
      recursive: true,
      wrapWithDirectory: true,
    });

    const wrapper = items.find((item) => item.path === '');
    return Container.load(ipfs, wrapper.hash);
  }

  private static async writeLinks(
    container: Container,
    links: ContainerWritableLink[]
  ): Promise<Container> {
    if (links.length === 0) return Promise.resolve(container);
    const { ipfs } = container;
    const rootNode = container.items.find(item => item.path === '');

    const patchedNode = await Container.patchItem(ipfs, rootNode, links);
    return Container.load(ipfs, patchedNode.hash);
  }

  public static async create(ipfs: IPFSClient, writables: ContainerWritable[]): Promise<Container> {
    Container.validateWritables(writables);

    const contents: ContainerWritableContent[] = writables.filter(
      (content) => !!(content as ContainerWritableContent).content
    ) as ContainerWritableContent[];

    const links: ContainerWritableLink[] = writables.filter(
      (content) => !!(content as ContainerWritableLink).hash
    ) as ContainerWritableLink[];

    const container = await Container.writeContents(ipfs, [
      ...contents,
    ]);

    return Container.writeLinks(container, links);
  }

  private static async patchItem(
    ipfs: IPFSClient,
    item: ContainerItem,
    links: ContainerWritableLink[]
  ) {
    let { node } = item;
    for (const link of links) {
      const linkName = link.path.replace(item.path, '').replace(/^\//, '');
      if (node.Links.find((nodeLink) => nodeLink.Name === linkName)) {
        node = await (node.constructor as any).rmLink(node, linkName);
      }

      // TODO: Can we add the size here as well so it's more accurate?
      node = await (node.constructor as any).addLink(node, {
        name: linkName,
        hash: link.hash,
      });
    }

    const cid = await ipfs.object.put(node);
    const hash = cid.toBaseEncodedString();

    return { ...item, node, hash };
  }

  private static async loadItems(
    ipfs: IPFSClient,
    hash: string,
  ): Promise<ContainerItem[]> {
    const node = await ipfs.object.get(hash);
    const list = [{ hash, path: '', node }];
    if (!node.Links.length) return list;

    for (const link of node.Links) {
      list.push({
        path: link.Name,
        hash: link.Hash.toString(),
        node: await ipfs.object.get(hash)
      });
    }

    return list;
}

  public static async load(ipfs: IPFSClient, address: string): Promise<Container> {
    const items = await Container.loadItems(ipfs, address);

    return new Container(ipfs, address, items);
  }

  private constructor(ipfs: any, address: string, items: ContainerItem[]) {
    this.ipfs = ipfs;
    this.address = address;
    this.items = items;
  }

  public resolve(path: string) {
    return Container.resolve(this.address, path);
  }

  public patch(updates: ContainerWritable[]) {
    const changeMap: { [path: string]: ContainerWritable } = {};

    this.items.forEach((writable) => {
      changeMap[writable.path] = writable;
    });

    updates.forEach((writable) => {
      changeMap[writable.path] = writable;
    });

    return Container.create(this.ipfs, Object.values(changeMap));
  }
}
