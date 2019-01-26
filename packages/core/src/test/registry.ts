import { IRegistry, ITask } from '../index';
import { v4 as uuid } from 'uuid';

const mockTask = (fn) =>
  jest.fn((...args) => ({
    execute: jest.fn(() => fn(...args)),
  }));

export default class PhemeTestRegistry implements IRegistry {
  public records: { [handle: string]: any } = {};

  public register = mockTask((handle: string) => {
    if (this.records[handle]) throw new Error('Handle already exists');
    this.records[handle] = {};
    return Promise.resolve();
  });

  public getPointer = mockTask((handle) => Promise.resolve(this.query(handle, 'pointer')));
  public setPointer = mockTask((handle, value) =>
    Promise.resolve(this.update(handle, 'pointer', value))
  );

  public getOwner = mockTask((handle) => Promise.resolve(this.query(handle, 'owner')));
  public setOwner = mockTask((handle, value) =>
    Promise.resolve(this.update(handle, 'owner', value))
  );

  public getProfile = mockTask((handle) => Promise.resolve(this.query(handle, 'profile')));
  public setProfile = mockTask((handle, value) =>
    Promise.resolve(this.update(handle, 'profile', value))
  );

  public getLatestHandles = mockTask((limit) => {
    const handles = Object.keys(this.records)
      .reverse()
      .splice(0, limit);
    return Promise.resolve(handles);
  });

  public getHandleByOwner = mockTask((owner) =>
    Promise.resolve(
      Object.keys(this.records).find((handle) => this.query(handle, 'owner') === owner)
    )
  );

  public update(handle: string, key: string, value: any) {
    this.records[handle][key] = value;
  }

  public query(handle: string, key: string) {
    return this.records[handle][key];
  }
}
