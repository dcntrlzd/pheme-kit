import Registry from './index';
import Contract from '../test/contract';

const HANDLE = 'test';

describe('registry', () => {
  let otherUser: string;
  let instance: Registry;

  beforeEach(() => {
    instance = new Registry(new Contract());
  });

  it('should be initialized without an issue', () => {
    expect.assertions(1);

    expect(instance).toBeTruthy();
  });

  it('should be able to estimate registry gas cost', async () => {
    expect.assertions(1);

    const cost = await instance.register(HANDLE).estimate();
    expect(Number(cost)).toBeGreaterThan(0);
  });

  it('should register without an issue', async () => {
    expect.assertions(2);

    const task = instance.register(HANDLE);
    await task.execute();

    expect(task.context.txHash).toBeTruthy();
    expect(await instance.getOwner(HANDLE).execute()).toEqual('owner');
  });

  it('should set pointer without an issue', async () => {
    expect.assertions(3);

    await instance.register(HANDLE).execute();
    expect(await instance.getOwner(HANDLE).execute()).toEqual('owner');
    expect(await instance.getHandleByOwner('owner').execute()).toEqual(HANDLE);

    await instance.setPointer(HANDLE, 'TEST').execute();
    expect(await instance.getPointer(HANDLE).execute()).toEqual('TEST');
  });

  it('should set profile without an issue', async () => {
    expect.assertions(2);

    await instance.register(HANDLE).execute();
    expect(await instance.getOwner(HANDLE).execute()).toEqual('owner');

    await instance.setProfile(HANDLE, 'TEST').execute();
    expect(await instance.getProfile(HANDLE).execute()).toEqual('TEST');
  });

  it('should set owner without an issue', async () => {
    expect.assertions(2);

    await instance.register(HANDLE).execute();
    expect(await instance.getOwner(HANDLE).execute()).toEqual('owner');

    await instance.setOwner(HANDLE, 'otherUser').execute();
    expect(await instance.getOwner(HANDLE).execute()).toEqual('otherUser');
  });
});
