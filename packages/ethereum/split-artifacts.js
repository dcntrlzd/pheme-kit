/* eslint-disable @typescript-eslint/no-var-requires, global-require, import/no-dynamic-require */
const path = require('path');
const glob = require('glob');
const fs = require('fs');

const artifactsDirectory = path.resolve(__dirname, './artifacts');
fs.mkdirSync(artifactsDirectory, { recursive: true });
fs.mkdirSync(path.join(artifactsDirectory, 'abi'));
fs.mkdirSync(path.join(artifactsDirectory, 'bytecode'));

glob(path.join(artifactsDirectory, 'full', '*.json'), (err, files) => {
  files.forEach((file) => {
    const { contractName, abi, bytecode } = require(file);

    const abiPath = path.join(artifactsDirectory, 'abi', contractName);
    const bytecodePath = path.join(artifactsDirectory, 'bytecode', contractName);

    fs.writeFileSync(`${abiPath}.json`, JSON.stringify(abi));
    fs.writeFileSync(`${bytecodePath}.json`, JSON.stringify(bytecode));
  });
});
