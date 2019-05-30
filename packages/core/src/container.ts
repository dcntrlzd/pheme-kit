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

const compactArray = (list) => list.filter((item) => item !== undefined);

export type ContainerWritable = ContainerWritableContent | ContainerWritableLink;

export default class Container {
  public readonly address: string;

  public static readonly SEPARATOR = '/';

  public readonly items: ContainerItem[];

  public readonly ipfs: IPFSClient;

  public static sortWritablesByPath = (writables: ContainerWritable[]) =>
    [...writables].sort((a, b) => {
      const aBasename = Container.getBasename(a.path);
      const bBasename = Container.getBasename(b.path);

      const depthComparison =
        bBasename.split(Container.SEPARATOR).length - aBasename.split(Container.SEPARATOR).length;

      let nameComparison = 0;
      if (aBasename < bBasename) {
        nameComparison = -1;
      } else if (aBasename > bBasename) {
        nameComparison = 1;
      }

      return depthComparison === 0 ? nameComparison : depthComparison;
    });

  public static getBasename = (path: string) => {
    const sections = path.replace(/^\//, '').split(Container.SEPARATOR);
    sections.pop();
    return sections.join(Container.SEPARATOR);
  };

  public static resolve(address: string, path: string) {
    const sections = path.split(Container.SEPARATOR).filter((part) => part !== '');
    return [address, ...sections].join(Container.SEPARATOR);
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
    let { address } = container;

    const linksGroupedByBasename: { [basename: string]: ContainerWritableLink[] } = {};
    links.forEach((link) => {
      const basename = Container.getBasename(link.path);
      if (!linksGroupedByBasename[basename]) linksGroupedByBasename[basename] = [];
      linksGroupedByBasename[basename].push(link);
    });

    const { items } = container;
    for (const pathToPatch of Object.keys(linksGroupedByBasename)) {
      const patchList = Container.buildPatchPlan(items, pathToPatch);
      let itemsToAdd = linksGroupedByBasename[pathToPatch];

      for (const itemToPatch of patchList) {
        const itemIndex = items.findIndex((item) => item === itemToPatch);
        const patchedItem = await Container.patchItem(ipfs, itemToPatch, itemsToAdd);
        items[itemIndex] = patchedItem;
        itemsToAdd = [patchedItem];
        if (itemToPatch.path === '') address = patchedItem.hash;
      }
    }

    return Container.load(ipfs, address);
  }

  public static async create(ipfs: IPFSClient, writables: ContainerWritable[]): Promise<Container> {
    const sortedWritables = Container.sortWritablesByPath(writables);

    const contents: ContainerWritableContent[] = sortedWritables.filter(
      (content) => !!(content as ContainerWritableContent).content
    ) as ContainerWritableContent[];

    const links: ContainerWritableLink[] = sortedWritables.filter(
      (content) => !!(content as ContainerWritableLink).hash
    ) as ContainerWritableLink[];

    const linkDirectories = links
      .map((link) => Container.getBasename(link.path))
      .filter((path) => !!path);

    const contentDirectories = contents
      .map((link) => Container.getBasename(link.path))
      .filter((path) => !!path);

    const allDirectoriesToInitialize = linkDirectories.filter(
      (path) => !contentDirectories.includes(path)
    );

    const directoriesToInitialize = allDirectoriesToInitialize.filter((path) => {
      const pathIndex = allDirectoriesToInitialize.indexOf(path);
      const matchedIndex = allDirectoriesToInitialize.findIndex((item) => item.indexOf(path) === 0);
      return pathIndex === matchedIndex;
    });

    const container = await Container.writeContents(ipfs, [
      ...contents,
      ...directoriesToInitialize.map((path) => ({
        path,
        content: Buffer.from(''),
      })),
    ]);

    return Container.writeLinks(container, links);
  }

  private static buildPatchPlan(items: ContainerItem[], path: string): ContainerItem[] {
    const parts = path.split(Container.SEPARATOR);
    // TODO: this part is suuuuper smelly
    if (parts[0] !== '') parts.unshift('');

    const steps = parts
      .map((part, i) => {
        const pathToMatch = parts.slice(1, i + 1).join(Container.SEPARATOR);
        const match = items.find((cursor) => cursor.path === pathToMatch);
        if (!match) throw new Error('Failed to find an ancestor');
        return match;
      })
      .reverse();

    return steps;
  }

  private static async patchItem(
    ipfs: IPFSClient,
    item: ContainerItem,
    links: ContainerWritableLink[]
  ) {
    const linksToAdd = links.filter((link) => Container.getBasename(link.path) === item.path);

    let { node } = item;
    for (const link of linksToAdd) {
      const linkName = link.path.replace(item.path, '').replace(/^\//, '');
      if (node.Links.find((nodeLink) => nodeLink.Name === linkName)) {
        node = await (node.constructor as any).rmLink(node, linkName);
      }

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
    address: string,
    maxDepth: number = 5
  ): Promise<ContainerItem[]> {
    const traverse = async (
      hash: string,
      depthLimit: number,
      base?: string
    ): Promise<ContainerItem[]> => {
      if (depthLimit < 0) return [];
      const node = await ipfs.object.get(hash);
      const list = [{ hash, path: base || '', node }];
      if (!node.Links.length) return list;

      for (const link of node.Links) {
        const linkHash = link.Hash.toString();
        const linkName = link.Name;
        const linkPath = compactArray([base, linkName]).join(Container.SEPARATOR);
        const traversedLink = await traverse(linkHash, depthLimit - 1, linkPath);
        list.push(...traversedLink);
      }

      return list;
    };

    return traverse(address, maxDepth);
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
