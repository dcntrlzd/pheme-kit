# Pheme Protocol

Pheme Protocol allows decentralized publishing of content feeds using IPFS and Ethereum. This repository contains the Ethereum smart contracts and the javascript implementation.

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Getting Started](#getting-started)
- [Current State](#current-state)

## Overview

## How It Works

## Getting Started

## Current State
* Allows creation and management of content chains under handles.
* Handles can have profiles.
* Runs with an Ethereum smart contract as a registry and IPFS as the storage layer.

## Next Steps
* Simplifying the API
  * Constructor should receive the contract not the registry
    * Registry should be created inside the constructor
  * Rename tasks to transactions
  * Modify transactions to be similar to ethers.Transaction
  * Splitting the setters and getters
  * Getters should not work with transactions
  * Only setters should work with transactions
  * Consistent naming of functions
* Add a getter for the owner of a handle (getHandleByOwner)
* Add a handle iterator (by using getHandleCount and getHandleAt)
* More verbose chain output
  * Should include addresses of the pointers as well
* Endorsements
* Improving tests
* Adding one more storage engine
* Linking for IPFS storage
