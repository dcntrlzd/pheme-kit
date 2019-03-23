import * as ethers from 'ethers';

export interface ITask<T = void> {
  context: any;
  execute: (parentContext?: any) => Promise<T>;
  estimate: (parentContext?: any) => Promise<ethers.utils.BigNumber>;
}

export const createTask = <Y>(
  {
    execute,
    estimate,
  }: {
    execute: (context: any) => Promise<Y>;
    estimate: (context: any) => Promise<ethers.utils.BigNumber>;
  },
  context = {}
): ITask<Y> => ({
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
): ITask<ethers.ContractTransaction> =>
  createTask(
    {
      estimate: (context) => contract.estimate[methodName](...args, options),
      execute: (context) => {
        const transaction = contract.functions[methodName](...args, options);
        transaction.then((tx) => {
          context.txHash = tx.hash;
        });
        return transaction;
      },
    },
    { txHash: '' }
  );
