pragma solidity ^0.4.25;

import "../ownership/ownable.sol";
import "./storage.sol";

contract RegistryV1 is Ownable {
  RegistryStorage handleStorage = RegistryStorage(0);

  event RecordUpdated(bytes32 indexed handle, string key);
  event RecordAdded(bytes32 indexed handle);
  event RecordRemoved(bytes32 indexed handle);

  constructor(address handleStorageAddress) public {
    handleStorage = RegistryStorage(handleStorageAddress);
  }

  modifier guardByHandle(bytes32 handle) {
    require(handleStorage.getAddress(handle, keccak256("owner")) == msg.sender, "Unauthorized Access");
    _;
  }

  function isHandleRegistered(bytes32 handle)
    public
    view
    returns(bool recordExists)
  {
    if (getHandleCount() == 0) {
      return false;
    }

    return handleStorage.getAddress(handle, keccak256("owner")) != address(0);
  }

  function isOwnerRegistered(address owner)
    public
    view
    returns(bool recordExists)
  {
    return getHandleByOwner(owner) != "";
  }

  function getHandleByOwner(address owner)
    public
    view
    returns(bytes32 handle)
  {
    if (getHandleCount() == 0) {
      return "";
    }

    bytes32 ownerKey = keccak256("owner");
    for (uint i = 0; i < getHandleCount(); i++) {
      if (handleStorage.getAddress(getHandleAt(i), ownerKey) == owner) {
        return getHandleAt(i);
      }
    }

    return "";
  }


  function registerHandle(bytes32 handle)
    external
  {
    address owner = msg.sender;

    require(!isHandleRegistered(handle), "Handle unavailable");
    require(!isOwnerRegistered(owner), "You already have a handle");

    handleStorage.addHandle(handle);
    handleStorage.setAddress(handle, keccak256("owner"), owner);

    emit RecordAdded(handle);
  }

  function deregisterHandle(bytes32 handle)
    external
    guardByHandle(handle)
  {

    handleStorage.removeHandle(handle);

    emit RecordRemoved(handle);
  }

  function getHandlePointer(bytes32 handle)
    external
    view
    returns(string pointer)
  {
    require(isHandleRegistered(handle), "Handle does not exist");
    return handleStorage.getString(handle, keccak256("pointer"));
  }

  function setHandlePointer(bytes32 handle, string pointer)
    external
    guardByHandle(handle)
  {
    handleStorage.setString(handle, keccak256("pointer"), pointer);

    emit RecordUpdated(handle, "pointer");
  }

  function getHandleProfile(bytes32 handle)
    external
    view
    returns(string profile)
  {
    require(isHandleRegistered(handle), "Handle does not exist");
    return handleStorage.getString(handle, keccak256("profile"));
  }

  function setHandleProfile(bytes32 handle, string profile)
    external
    guardByHandle(handle)
  {
    handleStorage.setString(handle, keccak256("profile"), profile);

    emit RecordUpdated(handle, "profile");
  }

  function getHandleOwner(bytes32 handle)
    external
    view
    returns(address value)
  {
    require(isHandleRegistered(handle), "Handle does not exist");
    return handleStorage.getAddress(handle, keccak256("owner"));
  }

  function setHandleOwner(bytes32 handle, address value)
    external
    guardByHandle(handle)
  {
    handleStorage.setAddress(handle, keccak256("owner"), value);
    emit RecordUpdated(handle, "owner");
  }

  function getHandleCount()
    public
    view
    returns(uint count)
  {
    return handleStorage.getHandleCount();
  }

  function getHandleAt(uint index)
    public
    view
    returns(bytes32 handle)
  {
    return handleStorage.handleList(index);
  }

  // Make the contract killable
  function kill() public onlyOwner {
    selfdestruct(msg.sender);
  }
}
