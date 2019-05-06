import * as ethers from 'ethers';

export interface Task<T = void> {
  context: any;
  execute: (parentContext?: any) => Promise<T>;
  estimate: (parentContext?: any) => Promise<ethers.utils.BigNumber>;
}

export const createTask = <Y>(
  {
    execute,
    estimate = () => Promise.resolve(ethers.utils.bigNumberify(0)),
  }: {
    execute: (context: any) => Promise<Y>;
    estimate?: (context: any) => Promise<ethers.utils.BigNumber>;
  },
  context = {}
): Task<Y> => ({
  context,
  execute: (parentContext: any = {}) =>
    execute(context).then((result) => {
      Object.assign(parentContext, context);
      return result;
    }),
  estimate: (parentContext: any = {}) =>
    estimate(context).then((result) => {
      Object.assign(parentContext, context);
      return result;
    }),
});

export const modifyTask = <Z, Y>(task: Z, modifications: Y): Z & Y =>
  new Proxy(task as any, {
    get: (context, prop) => modifications[prop] || context[prop],
  }) as Z & Y;

export const createTaskFromContractMethod = (
  contract: ethers.Contract,
  methodName: string,
  args: any[],
  options: any = {}
): Task<ethers.ContractTransaction> =>
  createTask(
    {
      estimate: () =>
        Promise.all([
          contract.estimate[methodName](...args, options),
          contract.provider.getGasPrice(),
        ]).then(([gasCost, gasPrice]) => gasCost.mul(gasPrice)),
      execute: (context) => {
        const transaction = contract.functions[methodName](...args, options);
        transaction.then((tx) => {
          Object.assign(context, { txHash: tx.hash });
        });
        return transaction;
      },
    },
    { txHash: '' }
  );
