import PhemeStorage from './index';

describe('PhemeStorage', () => {
  const instance: PhemeStorage = new PhemeStorage(
    process.env.IPFS_RPC_URL,
    process.env.IPFS_GATEWAY_URL
  );

  it('should be able to read and write data', async () => {
    const data = 'HELLO WORLD';
    const buffer = Buffer.from(data);

    const address = await instance.write(buffer);
    expect(address).toBeTruthy();

    const dataFromStorage = await instance.read(address);
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
