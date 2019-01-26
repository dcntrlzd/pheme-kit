import PhemeStorageIPFS from './index';
import IPFS from 'ipfs-http-client';
import axios from 'axios';
import uuid from 'uuid/v4';

const IPFS_RPC = 'http://localhost:5001';
const IPFS_GATEWAY = 'http://localhost';

jest.mock('axios');
jest.mock('ipfs-http-client', () => jest.fn(() => ({ add: jest.fn() })));

describe('PhemeStorageIPFS', () => {
  let instance: PhemeStorageIPFS;

  beforeEach(() => {
    const repo = {};

    instance = new PhemeStorageIPFS(IPFS_RPC, IPFS_GATEWAY);

    (axios.get as any).mockImplementation((url) => {
      const [_, ipfsAddress] = url.match(/http:\/\/localhost\/ipfs\/([0-9a-zA-Z]+)/);
      return Promise.resolve({ data: repo[ipfsAddress] });
    });

    (instance.ipfs.add as any).mockImplementation((object: Buffer) => {
      const path = uuid().replace(/-/gi, '');
      repo[path] = object;
      return Promise.resolve([
        {
          path,
          hash: path,
          size: object.byteLength,
        },
      ]);
    });
  });

  it('should initialize without an issue', async () => {
    expect(IPFS).toHaveBeenCalledWith('localhost', '5001', {
      protocol: 'http',
    });
    expect(instance).toBeDefined();
  });

  it('should be able to read and write data', async () => {
    const data = 'HELLO WORLD';
    const buffer = Buffer.from(data);

    const address = await instance.writeData(buffer);
    expect(address).toBeTruthy();

    const dataFromStorage = await instance.readData(address);
    expect(dataFromStorage).toEqual(buffer);
  });

  it('should be able to read and write objects', async () => {
    const object = { test: 'HELLO WORLD' };

    const address = await instance.writeObject(object);
    expect(address).toBeTruthy();

    const objectFromStorage = await instance.readObject(address);
    expect(objectFromStorage).toEqual(object);
  });
});
