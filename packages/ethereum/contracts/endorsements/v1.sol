pragma solidity ^0.4.25;

import "../ownership/ownable.sol";
import "./storage.sol";
import "../registry.sol";

contract EndorsementsV1 is Ownable {
  EndorsementsStorage endorsementsStorage = EndorsementsStorage(0);
  Registry registry = Registry(0);

  struct Endorsement {
    address endorser;
    uint amount;
  }

  uint serviceFeeRatioAsWei = 10000000000000000; // 0.01 after ether conversion so 1%

  event EndorsementAdded(address indexed endorser, bytes32 indexed handle, bytes32 indexed hashedUuid);
  event EndorsementRemoved(address indexed endorser, bytes32 indexed handle, bytes32 indexed hashedUuid);

  constructor(address endorsementsStorageAddress, address registryAddress) public {
    registry = Registry(registryAddress);
    endorsementsStorage = EndorsementsStorage(endorsementsStorageAddress);
  }

  function setRegistry(address registryAddress)
    external
    onlyOwner
  {
    registry = Registry(registryAddress);
  }

  function storagePrimaryKeyFor(bytes32 handle, string uuid) private pure returns (bytes32 primaryKey) {
    return keccak256(abi.encodePacked(handle, uuid));
  }

  function getEndorsementCount(bytes32 handle, string uuid) public view returns (uint endorsementCount) {
    return endorsementsStorage.getRecordCountFor(storagePrimaryKeyFor(handle, uuid));
  }

  function getEndorsementEndorser(bytes32 handle, string uuid, uint index) public view returns (address endorser) {
    bytes32 primaryKey = storagePrimaryKeyFor(handle, uuid);
    return endorsementsStorage.getAddress(primaryKey, index, keccak256("endorser"));
  }

  function getEndorsementAmount(bytes32 handle, string uuid, uint index) public view returns (uint amount) {
    bytes32 primaryKey = storagePrimaryKeyFor(handle, uuid);
    return endorsementsStorage.getUint(primaryKey, index, keccak256("amount"));
  }

  function endorse(bytes32 handle, string uuid) payable external {
    address endorser = msg.sender;
    address endorsee = registry.getHandleOwner(handle);

    require(endorsee != address(0));

    uint amount = msg.value;
    uint serviceFee = calculateServiceFee(amount);
    uint endorseeShare = amount - serviceFee;

    bytes32 primaryKey = storagePrimaryKeyFor(handle, uuid);
    bytes32 secondaryKey = keccak256(abi.encodePacked(endorser));

    endorsementsStorage.addRecord(primaryKey, secondaryKey);
    uint index = endorsementsStorage.getSecondaryKeyIndex(primaryKey, secondaryKey);

    endorsementsStorage.setAddress(primaryKey, index, keccak256("endorser"), endorser);
    endorsementsStorage.setUint(primaryKey, index, keccak256("amount"), amount);

    endorsee.transfer(endorseeShare);
    emit EndorsementAdded(endorser, handle, keccak256(abi.encodePacked(uuid)));
  }

  function calculateServiceFee(uint256 totalAmount) public view returns(uint256 serviceFee) {
    return totalAmount * serviceFeeRatioAsWei / (1 ether);
  }

  // Make the contract killable
  function kill() onlyOwner public {
    selfdestruct(msg.sender);
  }
}
