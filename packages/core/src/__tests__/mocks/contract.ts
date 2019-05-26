import BigNumber from 'bn.js';

const Contract: any = jest.fn(() => {
  const storage = {};

  return {
    provider: {
      getGasPrice: jest.fn(() => Promise.resolve(new BigNumber(5))),
    },
    functions: {
      getHandlePointer: jest.fn((handle) => Promise.resolve(storage[handle].pointer)),
      getHandleProfile: jest.fn((handle) => Promise.resolve(storage[handle].profile)),
      getHandleOwner: jest.fn((handle) => Promise.resolve(storage[handle].owner)),
      getHandleAt: jest.fn((index) => {
        const handle = Object.keys(storage)[index] || '';
        return Promise.resolve(handle);
      }),
      getHandleCount: jest.fn(() => {
        const count = Object.keys(storage).length;
        return Promise.resolve(new BigNumber(count));
      }),
      getHandleByOwner: jest.fn((owner) => {
        const handle = Object.keys(storage).find((cursor) => storage[cursor].owner === owner) || '';
        return Promise.resolve(handle);
      }),
      registerHandle: jest.fn((handle) => {
        storage[handle] = { owner: 'owner' };
        return Promise.resolve({ hash: 'TX_HASH' });
      }),
      setHandlePointer: jest.fn((handle, pointer) => {
        storage[handle] = { ...storage[handle], pointer };
        return Promise.resolve({ hash: 'TX_HASH' });
      }),
      setHandleProfile: jest.fn((handle, profile) => {
        storage[handle] = { ...storage[handle], profile };
        return Promise.resolve({ hash: 'TX_HASH' });
      }),
      setHandleOwner: jest.fn((handle, owner) => {
        storage[handle] = { ...storage[handle], owner };
        return Promise.resolve({ hash: 'TX_HASH' });
      }),
    },
    estimate: {
      getHandlePointer: jest.fn(() => Promise.resolve(new BigNumber(0))),
      getHandleProfile: jest.fn(() => Promise.resolve(new BigNumber(0))),
      getHandleOwner: jest.fn(() => Promise.resolve(new BigNumber(0))),
      getHandleAt: jest.fn(() => Promise.resolve(new BigNumber(0))),
      getHandleCount: jest.fn(() => Promise.resolve(new BigNumber(0))),
      getHandleByOwner: jest.fn(() => Promise.resolve(new BigNumber(0))),
      registerHandle: jest.fn(() => Promise.resolve(new BigNumber(10))),
      setHandlePointer: jest.fn(() => Promise.resolve(new BigNumber(10))),
      setHandleProfile: jest.fn(() => Promise.resolve(new BigNumber(10))),
      setHandleOwner: jest.fn(() => Promise.resolve(new BigNumber(10))),
    },
  };
});

export default Contract;
