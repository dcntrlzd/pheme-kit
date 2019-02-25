pragma solidity ^0.4.25;

import "../ownership/multi-ownable.sol";

contract EndorsementsStorage is MultiOwnable {

  struct Record {
    // Immutable fields of the record
    bytes32 handle;
    string uuid;
    address endorser;

    // Storage fields of the record
    mapping(bytes32 => uint) uintMap;
    mapping(bytes32 => string) stringMap;
    mapping(bytes32 => address) addressMap;
    mapping(bytes32 => int) intMap;
    mapping(bytes32 => bytes) bytesMap;
    mapping(bytes32 => bool) boolMap;
  }

  struct FieldIndex {
    // map keeps the list of ids with that value
    mapping(bytes32 => bytes32[]) map;
    // table field is necessary while removing an id from the index
    mapping(bytes32 => uint) table;
  }

  mapping(bytes32 => Record) private records;

  FieldIndex private handleIndex;
  FieldIndex private contentIndex;
  FieldIndex private endorserIndex;

  function addToIndex(FieldIndex storage fieldIndex, bytes32 id, bytes32 value) internal {
    fieldIndex.table[id] = fieldIndex.map[value].length;
    fieldIndex.map[value].push(id);
  }

  function removeFromIndex(FieldIndex storage fieldIndex, bytes32 id, bytes32 value) internal {
    delete fieldIndex.map[value][fieldIndex.table[id]];
    fieldIndex.map[value].length--;
  }

  function calculateContentId(bytes32 handle, string uuid)
    public
    pure
    returns(bytes32 contentId)
  {
    return keccak256(abi.encodePacked(handle, uuid));
  }

  function calculateId(bytes32 handle, string uuid, address endorser)
    public
    pure
    returns(bytes32 id)
  {
    bytes32 contentId = calculateContentId(handle, uuid);
    return keccak256(abi.encodePacked(handle, contentId, endorser));
  }

  function addRecord(bytes32 handle, string uuid, address endorser)
    external
    onlyOwner
    returns(bytes32 recordId)
  {
    bytes32 id = calculateId(handle, uuid, endorser);
    // Add the record
    records[id] = Record(handle, uuid, endorser);

    // Index the record
    addToIndex(handleIndex, id, handle);
    addToIndex(contentIndex, id, calculateContentId(handle, uuid));
    addToIndex(endorserIndex, id, keccak256(abi.encodePacked(endorser)));

    return id;
  }

  function removeRecord(bytes32 handle, string uuid, address endorser)
    public
  {
    bytes32 id = calculateId(handle, uuid, endorser);
    // Remove the record
    delete records[id];

    // Remove index entries
    removeFromIndex(handleIndex, id, handle);
    removeFromIndex(contentIndex, id, calculateContentId(handle, uuid));
    removeFromIndex(endorserIndex, id, keccak256(abi.encodePacked(endorser)));
  }

  function getRecordCountByHandle(bytes32 handle)
    external
    view
    returns(uint count)
  {
    return handleIndex.map[handle].length;
  }

  function getRecordIdByHandleAt(bytes32 handle, uint index) external view returns(bytes32 id) {
    return handleIndex.map[handle][index];
  }

  function getRecordCountByContent(bytes32 handle, string uuid)
    external
    view
    returns(uint count)
  {
    bytes32 contentId = calculateContentId(handle, uuid);
    return contentIndex.map[contentId].length;
  }

  function getRecordIdByContentAt(bytes32 handle, string uuid, uint index) external view returns(bytes32 id) {
    bytes32 contentId = calculateContentId(handle, uuid);
    return contentIndex.map[contentId][index];
  }

  function getRecordCountByEndorser(address endorser)
    external
    view
    returns(uint count)
  {
    return endorserIndex.map[keccak256(abi.encodePacked(endorser))].length;
  }

  function getRecordIdByEndorserAt(address endorser, uint index) external view returns(bytes32 id) {
    return endorserIndex.map[keccak256(abi.encodePacked(endorser))][index];
  }

  function getEndorser(bytes32 id)
    external
    view
    returns(address endorser)
  {
    return records[id].endorser;
  }

  function getUuid(bytes32 id)
    external
    view
    returns(string uuid)
  {
    return records[id].uuid;
  }

  function getHandle(bytes32 id)
    external
    view
    returns(bytes32 handle)
  {
    return records[id].handle;
  }

  function setUint(bytes32 id, bytes32 key, uint value)
    external
    onlyOwner
  {
    records[id].uintMap[key] = value;
  }

  function getUint(bytes32 id, bytes32 key)
    external
    view
    returns(uint value)
  {
    return records[id].uintMap[key];
  }

  function setString(bytes32 id, bytes32 key, string value)
    external
    onlyOwner
  {
    records[id].stringMap[key] = value;
  }

  function getString(bytes32 id, bytes32 key)
    external
    view
    returns(string value)
  {
    return records[id].stringMap[key];
  }

  function setAddress(bytes32 id, bytes32 key, address value)
    external
    onlyOwner
  {
    records[id].addressMap[key] = value;
  }

  function getAddress(bytes32 id, bytes32 key)
    external
    view
    returns(address value)
  {
    return records[id].addressMap[key];
  }

  function setInt(bytes32 id, bytes32 key, int value)
    external
    onlyOwner
  {
    records[id].intMap[key] = value;
  }

  function getInt(bytes32 id, bytes32 key)
    external
    view
    returns(int value)
  {
    return records[id].intMap[key];
  }

  function setBytes(bytes32 id, bytes32 key, bytes value)
    external
    onlyOwner
  {
    records[id].bytesMap[key] = value;
  }

  function getBytes(bytes32 id, bytes32 key)
    external
    view
    returns(bytes value)
  {
    return records[id].bytesMap[key];
  }

  function setBool(bytes32 id, bytes32 key, bool value)
    external
    onlyOwner
  {
    records[id].boolMap[key] = value;
  }

  function getBool(bytes32 id, bytes32 key)
    external
    view
    returns(bool value)
  {
    return records[id].boolMap[key];
  }
}

