import Container, { WritableContent, WritableLink } from '../container';
import { buildIPFSInstaceFromUrl } from '../storage';

describe('Container', () => {
  const ipfs = buildIPFSInstaceFromUrl(process.env.IPFS_API_URL);
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

  describe('Container.resolve', () => {
    it('should resolve the path based on the given address', () => {
      expect(Container.resolve('ADDRESS', 'test.txt')).toBe('ADDRESS/test.txt');
      expect(Container.resolve('ADDRESS', '/test.txt')).toBe('ADDRESS/test.txt');
    });
  });

  describe('Container.create', () => {
    it('should be able to create an empty container', async () => {
      const container = await Container.create(ipfs, []);
      expect(container.address).not.toBeUndefined();
    });

    it('should be able to create a container with writable contents', async () => {
      const container = await Container.create(ipfs, [
        { path: contentPath, content: writableContent },
      ]);
      expect(container.address).not.toBeUndefined();

      const item = container.items.find((containerItem) => containerItem.path === contentPath);
      expect(item.path).toBe(contentPath);
      expect(item.hash).not.toBeUndefined();
      await expectHashToContainTestData(Container.resolve(container.address, item.path));
    });

    it('should be able to create a container with writable links', async () => {
      const container = await Container.create(ipfs, [{ path: linkPath, hash: writableLink }]);

      expect(container.address).not.toBeUndefined();

      const item = container.items.find((containerItem) => containerItem.path === linkPath);
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
      const contentItem = container.items.find((item) => item.path === contentPath);
      const linkItem = container.items.find((item) => item.path === linkPath);

      expect(contentItem.path).toBe(contentPath);
      expect(contentItem.hash).not.toBeUndefined();
      await expectHashToContainTestData(Container.resolve(container.address, contentItem.path));

      expect(linkItem.path).toBe(linkPath);
      expect(linkItem.hash).not.toBeUndefined();
      await expectHashToContainTestData(Container.resolve(container.address, linkItem.path));
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
        { path: 'overwrite-first.txt', content: Buffer.from('TO BE OVERWRITTEN') },
        { path: 'overwrite-second.txt', content: Buffer.from('TO BE OVERWRITTEN') },
      ]);
      const initialMap = mapContainer(initialContainer);

      const patchedContainer = await initialContainer.patch([
        { path: 'overwrite-first.txt', content: Buffer.from('OVERWRITTEN FIRST') },
        { path: 'overwrite-second.txt', content: Buffer.from('OVERWRITTEN SECOND') },
        { path: 'new.txt', content: Buffer.from('NEW') },
      ]);

      const patchedMap = mapContainer(patchedContainer);

      expect(patchedContainer.address).not.toBe(initialContainer.address);
      expect(patchedMap['same.txt']).toBe(initialMap['same.txt']);
      expect(patchedMap['overwrite-first.txt']).not.toBe(initialMap['overwrite-first.txt']);
      expect(patchedMap['overwrite-second.txt']).not.toBe(initialMap['overwrite-second.txt']);
    });
  });
});
