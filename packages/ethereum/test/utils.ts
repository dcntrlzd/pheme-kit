import assert = require('assert');

export const assertTxEvent = (tx, event, args) => {
  const log = tx.logs.find((cursor) => cursor.event === event);
  const argsToCompare = Object.keys(args).reduce(
    (acc, key) => ({ ...acc, [key]: log.args[key] }),
    {}
  );
  assert.deepStrictEqual(args, argsToCompare);
};

export const assertRejection = (promise) =>
  promise.then(
    () => {
      throw new Error('Should not resolve');
    },
    () => assert.ok(true)
  );
