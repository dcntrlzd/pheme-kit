pragma solidity ^0.4.25;

import "../ownership/multi-ownable.sol";

contract EndorsementsStorage is MultiOwnable {

  struct Record {
    mapping(bytes32 => uint) uintMap;
    mapping(bytes32 => string) stringMap;
    mapping(bytes32 => address) addressMap;
    mapping(bytes32 => int) intMap;
    mapping(bytes32 => bytes) bytesMap;
    mapping(bytes32 => bool) boolMap;
  }

  mapping(bytes32 => Record[]) private recordMap;
  mapping(bytes32 => uint) private secondaryKeyLUT;

  function addRecord(bytes32 primaryKey, bytes32 secondaryKey)
    external
    onlyOwner
  {
    bytes32 compositeKey = keccak256(abi.encodePacked(primaryKey, secondaryKey));

    secondaryKeyLUT[compositeKey] = recordMap[primaryKey].length;
    recordMap[primaryKey].push(Record());
  }

  function removeRecord(bytes32 primaryKey, bytes32 secondaryKey)
    public
  {
    bytes32 compositeKey = keccak256(abi.encodePacked(primaryKey, secondaryKey));

    uint secondaryKeyIndex = secondaryKeyLUT[compositeKey];

    delete recordMap[primaryKey][secondaryKeyIndex];
    recordMap[primaryKey].length--;

    delete secondaryKeyLUT[compositeKey];
  }

  function getRecordCountFor(bytes32 primaryKey)
    external
    view
    returns(uint count)
  {
    return recordMap[primaryKey].length;
  }

  function getSecondaryKeyIndex(bytes32 primaryKey, bytes32 secondaryKey)
    public
    view
    returns(uint secondaryKeyIndex)
  {
    bytes32 compositeKey = keccak256(abi.encodePacked(primaryKey, secondaryKey));
    return secondaryKeyLUT[compositeKey];
  }

  function getRecord(bytes32 primaryKey, uint index)
    private
    view
    returns(Record storage record)
  {
    require(recordMap[primaryKey].length > 0, "No record exists under primaryKey");
    return recordMap[primaryKey][index];
  }

  function setUint(bytes32 primaryKey, uint index, bytes32 key, uint value)
    external
    onlyOwner
  {
    getRecord(primaryKey, index).uintMap[key] = value;
  }

  function getUint(bytes32 primaryKey, uint index, bytes32 key)
    external
    view
    returns(uint value)
  {
    return getRecord(primaryKey, index).uintMap[key];
  }

  function setString(bytes32 primaryKey, uint index, bytes32 key, string value)
    external
    onlyOwner
  {
    getRecord(primaryKey, index).stringMap[key] = value;
  }

  function getString(bytes32 primaryKey, uint index, bytes32 key)
    external
    view
    returns(string value)
  {
    return getRecord(primaryKey, index).stringMap[key];
  }

  function setAddress(bytes32 primaryKey, uint index, bytes32 key, address value)
    external
    onlyOwner
  {
    getRecord(primaryKey, index).addressMap[key] = value;
  }

  function getAddress(bytes32 primaryKey, uint index, bytes32 key)
    external
    view
    returns(address value)
  {
    return getRecord(primaryKey, index).addressMap[key];
  }

  function setInt(bytes32 primaryKey, uint index, bytes32 key, int value)
    external
    onlyOwner
  {
    getRecord(primaryKey, index).intMap[key] = value;
  }

  function getInt(bytes32 primaryKey, uint index, bytes32 key)
    external
    view
    returns(int value)
  {
    return getRecord(primaryKey, index).intMap[key];
  }

  function setBytes(bytes32 primaryKey, uint index, bytes32 key, bytes value)
    external
    onlyOwner
  {
    getRecord(primaryKey, index).bytesMap[key] = value;
  }

  function getBytes(bytes32 primaryKey, uint index, bytes32 key)
    external
    view
    returns(bytes value)
  {
    return getRecord(primaryKey, index).bytesMap[key];
  }

  function setBool(bytes32 primaryKey, uint index, bytes32 key, bool value)
    external
    onlyOwner
  {
    getRecord(primaryKey, index).boolMap[key] = value;
  }

  function getBool(bytes32 primaryKey, uint index, bytes32 key)
    external
    view
    returns(bool value)
  {
    return getRecord(primaryKey, index).boolMap[key];
  }
}

