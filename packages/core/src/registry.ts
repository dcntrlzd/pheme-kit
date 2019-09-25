import * as ethers from 'ethers';
import RegistryAbi from '@pheme-kit/ethereum/artifacts/abi/RegistryV1.json';
import { modifyTask, createTaskFromContractMethod, Task } from './task';

const stringToBytes = (input: string) => ethers.utils.formatBytes32String(input);

const bytesToString = (input: string) => ethers.utils.parseBytes32String(input);

export default class PhemeRegistry {
  public static attach(
    address: string,
    providerOrSigner: ethers.providers.Provider | ethers.ethers.Signer
  ): PhemeRegistry {
    const contract = new ethers.Contract(address, RegistryAbi, providerOrSigner);
    return new PhemeRegistry(contract);
  }

  public contract: ethers.Contract;

  public constructor(contract: ethers.Contract) {
    this.contract = contract;
  }

  public register(handle: string): Task {
    return this.createTask('registerHandle', [stringToBytes(handle)]);
  }

  public getPointer(handle: string): Task<string> {
    return this.createTask('getHandlePointer', [stringToBytes(handle)]);
  }

  public setPointer(handle: string, value = ''): Task {
    return this.createTask('setHandlePointer', [stringToBytes(handle), value]);
  }

  public getProfile(handle: string): Task<string> {
    return this.createTask('getHandleProfile', [stringToBytes(handle)]);
  }

  public setProfile(handle: string, value = ''): Task {
    return this.createTask('setHandleProfile', [stringToBytes(handle), value]);
  }

  public getOwner(handle: string): Task<string> {
    return this.createTask('getHandleOwner', [stringToBytes(handle)]);
  }

  public setOwner(handle: string, value = ''): Task {
    return this.createTask('setHandleOwner', [stringToBytes(handle), value]);
  }

  public getHandleAt(index: number): Task<string> {
    const task = this.createTask('getHandleAt', [index]);

    return modifyTask(task, {
      execute: () => task.execute().then((handleAsBytes: string) => bytesToString(handleAsBytes)),
    });
  }

  public getHandleCount(): Task<number> {
    return this.createTask('getHandleCount');
  }

  public getHandleByOwner(owner: string): Task<string> {
    const task = this.createTask('getHandleByOwner', [owner]);

    return modifyTask(task, {
      execute: () => task.execute().then((handleAsBytes: string) => bytesToString(handleAsBytes)),
    });
  }

  private createTask(methodName: string, args: any[] = [], options: any = {}): Task<any> {
    return createTaskFromContractMethod(this.contract, methodName, args, options);
  }
}
