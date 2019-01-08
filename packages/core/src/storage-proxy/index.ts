import { IStorage, IBlock } from '../index';

export interface IStorageMap {
  [protocol: string]: IStorage;
}

export default class StorageProxy implements IStorage {
  private storageMap: IStorageMap = {};

  // TODO: Implement preferred storage
  constructor(storageMap: IStorageMap) {
    this.storageMap = storageMap;
  }

  public getStorage(address?: string): IStorage {
    const protocol: string = address
      ? this.getAddressProtocol(address)
      : Object.keys(this.storageMap)[0];
    const storage = this.storageMap[protocol];
    if (!storage) throw new Error(`Unknown storage protocol: ${protocol}`);
    return storage;
  }

  public publicUrlFor(address: string) {
    return this.getStorage(address).publicUrlFor(address);
  }

  public readData(address: string) {
    return this.getStorage(address).readData(address);
  }

  public writeData(data: Buffer) {
    return this.getStorage().writeData(data);
  }

  public serialize(input: any) {
    return this.getStorage().serialize(input);
  }

  public deserialize(input: string) {
    return this.getStorage().deserialize(input);
  }

  public readObject(address: string) {
    return this.getStorage(address).readObject(address);
  }

  public writeObject(data: IBlock) {
    return this.getStorage().writeObject(data);
  }

  public addressForEstimation() {
    return this.getStorage().addressForEstimation();
  }

  private getAddressProtocol(address: string): string {
    const url = new URL(address);
    return url.protocol.replace(/\:/, '');
  }
}
