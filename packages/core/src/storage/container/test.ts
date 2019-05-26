import Container, { WritableContent, WritableLink } from './index';
import { buildIPFSInstaceFromUrl } from '../index';

describe('Container', () => {
  const ipfs = buildIPFSInstaceFromUrl(process.env.IPFS_RPC_URL);
  const TEST_DATA = 'HELLO WORLD';

  const contentPath = 'content.txt';
  const linkPath = 'link.txt';

  let writableContent: WritableContent;
  let writableLink: WritableLink;

  beforeAll(async () => {
    writableContent = Buffer.from(TEST_DATA);
    const [writtenContent] = await ipfs.add(writableContent);
    writableLink = writtenContent.hash;
  });

  const expectHashToContainTestData = async (hash: string) => {
    const [downloadedFile] = await ipfs.get(hash);
    expect(downloadedFile.content.toString()).toBe(TEST_DATA);
  };

  describe('Container.getDirname', () => {
    it('should get the directory name for a regular file path', () => {
      expect(Container.getDirname('hello/world/test.txt')).toBe('hello/world');
      expect(Container.getDirname('/hello/world/test.txt')).toBe('hello/world');
    });

    it('should get the directory name for a file without a directory', () => {
      expect(Container.getDirname('test.txt')).toBe('');
      expect(Container.getDirname('/test.txt')).toBe('');
    });

    it('should get the directory name for a directory path', () => {
      expect(Container.getDirname('hello/world/')).toBe('hello/world');
      expect(Container.getDirname('/hello/world/')).toBe('hello/world');
    });
  });

  describe('Container.resolve', () => {
    it('should resolve the path based on the given address', () => {
      expect(Container.resolve('ADDRESS', 'hello/world/test.txt')).toBe(
        'ADDRESS/hello/world/test.txt'
      );
      expect(Container.resolve('ADDRESS', '/hello/world/test.txt')).toBe(
        'ADDRESS/hello/world/test.txt'
      );
    });
  });

  describe('Container.create', () => {
    it('should be able to create an empty container', async () => {
      const container = await Container.create(ipfs, []);
      expect(container.address).not.toBeUndefined();
      expect(container.items.length).toBe(0);
    });

    it('should be able to create a container with writable contents', async () => {
      const container = await Container.create(ipfs, [
        { path: contentPath, content: writableContent },
      ]);
      expect(container.address).not.toBeUndefined();
      expect(container.items.length).toBe(1);

      const [item] = container.items;
      expect(item.path).toBe(contentPath);
      expect(item.hash).not.toBeUndefined();
      await expectHashToContainTestData(Container.resolve(container.address, item.path));
    });

    it('should be able to create a container with writable links', async () => {
      const container = await Container.create(ipfs, [{ path: linkPath, hash: writableLink }]);

      expect(container.address).not.toBeUndefined();
      expect(container.items.length).toBe(1);

      const [item] = container.items;
      expect(item.path).toBe(linkPath);
      expect(item.hash).not.toBeUndefined();
      await expectHashToContainTestData(Container.resolve(container.address, item.path));
    });

    it('should be able to create a container with mixed writables', async () => {
      const container = await Container.create(ipfs, [
        { path: contentPath, content: writableContent },
        { path: linkPath, hash: writableLink },
      ]);

      expect(container.address).not.toBeUndefined();
      expect(container.items.length).toBe(2);

      const [contentItem, linkItem] = container.items;

      expect(contentItem.path).toBe(contentPath);
      expect(contentItem.hash).not.toBeUndefined();
      await expectHashToContainTestData(Container.resolve(container.address, contentItem.path));

      expect(linkItem.path).toBe(linkPath);
      expect(linkItem.hash).not.toBeUndefined();
      await expectHashToContainTestData(Container.resolve(container.address, linkItem.path));
    });

    it('should be able to create a directories recursively', async () => {
      const container = await Container.create(ipfs, [
        { path: 'base/content/test.txt', content: writableContent },
        { path: 'base/link/test.txt', hash: writableLink },
        { path: 'base/link/directory/test.txt', hash: writableLink },
      ]);

      const [contentItem, firstLinkItem, secondLinkItem] = container.items;

      expect(contentItem.path).toBe('base/content/test.txt');
      expect(contentItem.hash).not.toBeUndefined();
      await expectHashToContainTestData(Container.resolve(container.address, contentItem.path));

      expect(firstLinkItem.path).toBe('base/link/test.txt');
      expect(firstLinkItem.hash).not.toBeUndefined();
      await expectHashToContainTestData(Container.resolve(container.address, firstLinkItem.path));

      expect(secondLinkItem.path).toBe('base/link/directory/test.txt');
      expect(secondLinkItem.hash).not.toBeUndefined();
      await expectHashToContainTestData(Container.resolve(container.address, secondLinkItem.path));
    });
  });

  describe('resolve', () => {
    it('should be able to resolve a path in container', async () => {
      const container = await Container.create(ipfs, [
        { path: contentPath, content: writableContent },
      ]);

      expect(container.resolve(contentPath)).toBe(`${container.address}/${contentPath}`);
    });
  });

  describe('patch', () => {
    it('should be able to patch the container', async () => {
      const mapContainer = (container: Container) =>
        container.items.reduce(
          (acc, item) => ({
            ...acc,
            [item.path]: item.hash,
          }),
          {}
        );

      const initialContainer = await Container.create(ipfs, [
        { path: 'same.txt', content: Buffer.from('STAYS SAME') },
        { path: 'overwrite.txt', content: Buffer.from('TO BE OVERWRITTEN') },
      ]);
      const initialMap = mapContainer(initialContainer);

      expect(initialContainer.items).toMatchObject([
        { path: 'overwrite.txt', hash: expect.anything() },
        { path: 'same.txt', hash: expect.anything() },
      ]);

      const patchedContainer = await initialContainer.patch([
        { path: 'overwrite.txt', content: Buffer.from('OVERWRITTEN') },
        { path: 'new.txt', content: Buffer.from('NEW') },
      ]);
      const patchedMap = mapContainer(patchedContainer);

      expect(patchedContainer.items).toMatchObject([
        { path: 'new.txt', hash: expect.anything() },
        { path: 'overwrite.txt', hash: expect.anything() },
        { path: 'same.txt', hash: expect.anything() },
      ]);

      expect(patchedContainer.address).not.toBe(initialContainer.address);
      expect(patchedMap['same.txt']).toBe(initialMap['same.txt']);
      expect(patchedMap['overwrite.txt']).not.toBe(initialMap['overwrite.txt']);
    });
  });
});
