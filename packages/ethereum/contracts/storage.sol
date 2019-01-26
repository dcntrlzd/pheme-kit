pragma solidity ^0.4.22;

import "./multi-ownable.sol";

contract Storage is MultiOwnable{

  struct Record {
    mapping(bytes32 => uint) uintMap;
    mapping(bytes32 => string) stringMap;
    mapping(bytes32 => address) addressMap;
    mapping(bytes32 => int) intMap;
    mapping(bytes32 => bytes) bytesMap;
    mapping(bytes32 => bool) boolMap;
  }

  mapping(bytes32 => Record) private recordMap;

  bytes32[] public handleList;
  mapping(bytes32 => uint) public handleMap;

  function addHandle(bytes32 handleToAdd) 
    external
    onlyOwner
  {
    handleList.push(handleToAdd);
    handleMap[handleToAdd] = handleList.length - 1;
    recordMap[handleToAdd] = Record();
  }

  function removeHandle(bytes32 handleToRemove)
    external
    onlyOwner
  {
    uint handleIndex = handleMap[handleToRemove];
    bytes32 handleToMove = handleList[handleList.length - 1];

    // remove the handle list
    delete handleMap[handleToRemove];

    // cleanup and defrag the handle list
    handleList[handleIndex] = handleToMove;
    handleList.length--;

    // delete the handle record
    delete recordMap[handleToRemove];
  }

  function getHandleCount()
    external
    view
    returns(uint count)
  {
    return handleList.length;
  }

  function setUint(bytes32 handle, bytes32 key, uint value)
    external
    onlyOwner
  {
    recordMap[handle].uintMap[key] = value;
  }

  function getUint(bytes32 handle, bytes32 key) 
    external
    view
    returns(uint value)
  {
    return recordMap[handle].uintMap[key];
  }

  function setString(bytes32 handle, bytes32 key, string value)
    external
    onlyOwner
  {
    recordMap[handle].stringMap[key] = value;
  }

  function getString(bytes32 handle, bytes32 key) 
    external
    view
    returns(string value)
  {
    return recordMap[handle].stringMap[key];
  }

  function setAddress(bytes32 handle, bytes32 key, address value)
    external
    onlyOwner
  {
    recordMap[handle].addressMap[key] = value;
  }

  function getAddress(bytes32 handle, bytes32 key) 
    external
    view
    returns(address value)
  {
    return recordMap[handle].addressMap[key];
  }

  function setInt(bytes32 handle, bytes32 key, int value)
    external
    onlyOwner
  {
    recordMap[handle].intMap[key] = value;
  }

  function getInt(bytes32 handle, bytes32 key) 
    external
    view
    returns(int value)
  {
    return recordMap[handle].intMap[key];
  }

  function setBytes(bytes32 handle, bytes32 key, bytes value)
    external
    onlyOwner
  {
    recordMap[handle].bytesMap[key] = value;
  }

  function getBytes(bytes32 handle, bytes32 key) 
    external
    view
    returns(bytes value)
  {
    return recordMap[handle].bytesMap[key];
  }

  function setBool(bytes32 handle, bytes32 key, bool value)
    external
    onlyOwner
  {
    recordMap[handle].boolMap[key] = value;
  }

  function getBool(bytes32 handle, bytes32 key) 
    external
    view
    returns(bool value)
  {
    return recordMap[handle].boolMap[key];
  }
}

