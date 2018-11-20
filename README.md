# Pheme Protocol

Pheme Protocol allows decentralized publishing of content feeds using IPFS and Ethereum. This repository contains the Ethereum smart contracts and the javascript reference implementation.

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Getting Started](#getting-started)
- [Setting Up The Development Environment](#setting-up-the-development-environment)
- [Contributing](#contributing)
- [Current State](#current-state)
- [Next Steps](#next-steps)

## Overview

Pheme Protocol uses Ethereum as a registry layer and IPFS (for now) as the storage layer to provide decentralized content feeds grouped under handles. Therefore enabling censorship resistant content feeds.

The storage layer is abstracted so i can support multiple storage layers even inside a single feed although IPFS is the sole storage layer implementation as of today.

## How It Works

Pheme feeds are linked lists where the address of the storage
Pheme feeds are consisted of small json objects living in the storage layer containing the address of the content they are representing, the metadata of the content and the address of the previous ring/block. Simply they are linked lists of content stored in a storage layer where the address of the head node is stored in Ethereum smart contracts.

## Getting Started

First of all you'll need to pick a registry to start working on a feed. You can start by using the public registry (it lives in `@dcntrlzd/pheme-contracts/contracts/registry.sol`). And then you can start using Pheme.

```js
import Pheme from '@dcntrlzd/pheme-protocol';
import PhemeRegistry from '@dcntrlzd/pheme/src/registry';
import PhemeStorageIpfs from '@dcntrlzd/pheme-storage-ipfs/src';

// You'll need an ethers.js contract to intialize the registry (more at https://docs.ethers.io/ethers.js/html/)
const registry = new PhemeRegistry(contract);

const pheme = new Pheme(registry, {
  ipfs: new PhemeStorageIpfs(IPFS_RPC_URL, IPFS_GATEWAY_URL)
});
```

`pheme` object initialized above will let you to read and write feeds. Please check the registry implementation for more details.


## Setting Up The Development Environment

You'll need NodeJS 10 and [yarn](https://yarnpkg.com/en/) for the working on th project. After cloning the repo you have to run:

* `yarn` to install the dependencies
* `yarn bootstrap` to bootstrap the packages

After that you'll be able to work on it and then you can use `yarn test` to run all the tests.

## Contributing

1. Fork the repo on GitHub
2. Clone the project to your own machine
3. Commit changes to your own branch
4. Push your work back up to your fork (Be sure you have tests and all tests are green).
5. Submit a Pull request so that we can review your changes

NOTE: Be sure to merge the latest from "upstream" before making a pull request!


## Current State
* Allows creation and management of content chains under handles.
* Handles can have profiles.
* Runs with an Ethereum smart contract as a registry and IPFS as the storage layer.

## Next Steps
* Rename handle to feed
* Simplification of the API
  * Constructor should receive the contract not the registry
    * Registry should be created inside the constructor
  * Rename tasks to transactions
  * Modify transactions to be similar to ethers.Transaction
  * Splitting the setters and getters
  * Getters should not work with transactions
  * Only setters should work with transactions
  * Consistent naming of functions
* API Documentation
* Add a getter for the owner of a handle (getHandleByOwner)
* Add a handle iterator (by using getHandleCount and getHandleAt)
* More verbose chain output
  * Should include addresses of the pointers as well
* Build Endorsements as a reference extension
* Improving tests
* Adding one more storage engine
* Linking for IPFS storage
* ENS resolved
* ERC-721 implementation for handles
* Custom registration methods
 * controlled by a single account
 * ENS
