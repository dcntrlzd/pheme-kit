# Pheme Kit

[![CircleCI](https://img.shields.io/circleci/project/github/dcntrlzd/pheme-kit/master.svg)](https://circleci.com/gh/dcntrlzd/pheme-kit/tree/master)

Pheme Kit allows decentralized publishing of content feeds using IPFS and Ethereum. This repository contains the Ethereum smart contracts and javascript libraries which allows you to build and deploy your decentralized content feeds.

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Getting Started](#getting-started)
- [Setting Up The Development Environment](#setting-up-the-development-environment)
- [Contributing](#contributing)
- [Current State](#current-state)
- [Next Steps](#next-steps)

## Overview

Pheme Kit uses Ethereum as a registry layer and IPFS (for now) as the storage layer to provide decentralized content feed or feeds. Therefore enabling censorship resistant content distribution.

The storage layer is abstracted so it can support multiple storage layers even inside a single feed although IPFS is the sole storage layer implementation as of today.

## How It Works

Pheme feeds are linked lists where the address of the storage
Pheme feeds are consisted of small json objects living in the storage layer containing the address of the content they are representing, the metadata of the content and the address of the previous ring/block. Simply they are linked lists of content stored in a storage layer where the address of the head node is stored in Ethereum smart contracts.

## Getting Started

First of all you'll need to pick a registry to start working on a feed. You can start by using the public registry (it lives in `@pheme-kit/ethereum/registry.sol`). And then you can start using Pheme.

```js
import Pheme from '@pheme-kit/core';

// Create a Pheme instance
const pheme = Pheme.create({
  providerOrSigner: ethersProvider.getSigner(),
  contractAddress: CONTRACT_ADDRESS,
  ipfsApiUrl: IPFS_API_URL,
  ipfsGatewayURL: IPFS_GATEWAY_URL
);

async function example() {
  // Register a handle
  await pheme.registerHandle(HANDLE).execute();
  
  // Update handle profile
  await pheme.updateHandleProfile(HANDLE, {
    description: 'Hello I am handle!'
  }).execute();

  // Publish a simple content
  await pheme.pushToHandle(
    HANDLE,
    // content file
    { path: 'content.txt', content: Buffer.from('This is my first post') },
    // content meta
    { title: 'First content' }
  ).execute();

  // Publish a content with additional files
  await pheme.pushToHandle(
    HANDLE,
    // content file
    { path: 'content.txt', content: Buffer.from('This is my second post') },
    // content meta
    { title: 'Second Post' },
    // additional files
    { 'image.svg': 'QmfQkD8pBSBCBxWEwFSu4XaDVSWK6bjnNuaWZjMyQbyDub/static/media/ipfs-logo-text.4831bd1a.svg' }
  ).execute();
}

example();
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
3. Apply your changes
4. Run `yarn lint`
5. Commit changes to your own branch
6. Push your work back up to your fork (Be sure you have tests and all checks & tests are green).
7. Submit a Pull request so that we can review your changes

NOTE: Be sure to merge the latest from "upstream" before making a pull request!

## Current State
* Allows creation and management of content chains under handles.
* Handles can have profiles.
* Runs with an Ethereum smart contract as a registry and IPFS as the storage layer.

## TODO
* API Documentation
* Conceptual Documentation
* Simplification of the API
  * Constructor should receive the contract not the registry
    * Registry should be created inside the constructor
  * Rename tasks to transactions
  * Rename handle to feed
  * Modify transactions to be similar to ethers.Transaction
  * Splitting the setters and getters
  * Getters should not work with transactions
  * Only setters should work with transactions
  * Consistent naming of functions
  * Use hash only IPFS calls for estimation
* More verbose chain output
  * Should include addresses of the pointers as well
* Build Endorsements as a reference extension
* Improving tests
* Adding one more storage engine
* ENS resolver for registry
* ERC-721 implementation for handles
* More Registry implementations
  * Multi Owner (multiple owners can write to whatever handle they want).
  * Multi Authority (multiple owners can assign whichever handle they want to anyone).
