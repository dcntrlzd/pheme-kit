import { IStorage } from '../index';
import { v4 as uuid } from 'uuid';

export default class PhemeStorageTest implements IStorage {
  public storage: { [address: string]: any } = {};

  public publicUrlFor = jest.fn((address: string) => `https://GATEWAY_URL/${address}`);

  public readData = jest.fn((address: string) => {
    const url = new URL(address);
    return Promise.resolve(this.storage[url.host]);
  });

  public writeData = jest.fn((data: Buffer) => {
    const address = uuid();
    this.storage[address] = data;
    return Promise.resolve(`test://${address}`);
  });

  public readObject = jest.fn(
    async (address: string): Promise<any> => {
      return this.deserialize(await this.readData(address));
    }
  );

  public writeObject = jest.fn(
    (object: any): Promise<string> => {
      return this.writeData(Buffer.from(this.serialize(object)));
    }
  );

  public serialize(input: any) {
    return JSON.stringify(input);
  }

  public deserialize(input: string) {
    return JSON.parse(input);
  }

  public addressForEstimation = () => 'TEST_ADDRESS_FOR_ESTIMATION';
}
