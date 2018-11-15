import { IRegistry, ITask } from '../index';
import { v4 as uuid } from 'uuid';

const mockTask = (fn) => jest.fn((...args) => ({
  execute: jest.fn(() => fn(...args))
}));

export default class PhemeTestRegistry implements IRegistry {
  records: { [handle: string]: any } = {};

  register = mockTask((handle: string) => {
    if (this.records[handle]) throw new Error('Handle already exists');
    this.records[handle] = {};
    return Promise.resolve();
  });

  getPointer = mockTask((handle) => Promise.resolve(this.query(handle, 'pointer')));
  setPointer = mockTask((handle, value) => Promise.resolve(this.update(handle, 'pointer', value)));

  getOwner = mockTask((handle) => Promise.resolve(this.query(handle, 'owner')));
  setOwner = mockTask((handle, value) => Promise.resolve(this.update(handle, 'owner', value)));

  getProfile = mockTask((handle) => Promise.resolve(this.query(handle, 'profile')));
  setProfile = mockTask((handle, value) => Promise.resolve(this.update(handle, 'profile', value)));

  getLatestHandles = mockTask((limit) => {
    const handles = Object.keys(this.records).reverse().splice(0, limit);
    return Promise.resolve(handles);
  });

  getHandleByOwner = mockTask((owner) => 
    Promise.resolve(Object.keys(this.records)
      .find((handle) =>this.query(handle, 'owner') === owner))
  );

  update(handle: string, key: string, value: any) {
    this.records[handle][key] = value;
  };

  query(handle: string, key: string) {
    return this.records[handle][key];
  };
}