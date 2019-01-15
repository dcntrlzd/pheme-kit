const path = require('path');
const glob = require('glob');
const fs = require('fs');

const artifactsDirectory = path.resolve(__dirname, './artifacts');
fs.mkdirSync(artifactsDirectory, { recursive: true });

glob(path.resolve(__dirname, './build/contracts/*.json'), (err, files) => {
  files.forEach((file) => {
    const { contractName, abi, bytecode } = require(file);
    const baseName = path.join(artifactsDirectory, contractName);
    fs.writeFileSync(`${baseName}.abi.json`, JSON.stringify(abi));
    fs.writeFileSync(`${baseName}.bytecode.json`, JSON.stringify(bytecode));
  });
});


