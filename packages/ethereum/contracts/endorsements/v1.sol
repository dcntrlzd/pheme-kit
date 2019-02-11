pragma solidity ^0.4.25;

import "../ownership/ownable.sol";
import "../registry/v0.sol";

import "./storage.sol";

contract EndorsementsV1 is Ownable {
  EndorsementsStorage endorsementsStorage = EndorsementsStorage(0);
  RegistryV0 registry = RegistryV0(0);

  struct Endorsement {
    address endorser;
    uint amount;
  }

  uint serviceFeeRatioAsWei = 10000000000000000; // 0.01 after ether conversion so 1%

  event EndorsementAdded(address indexed endorser, bytes32 indexed handle, bytes32 indexed hashedUuid);
  event EndorsementRemoved(address indexed endorser, bytes32 indexed handle, bytes32 indexed hashedUuid);

  constructor(address endorsementsStorageAddress, address registryAddress) public {
    registry = RegistryV0(registryAddress);
    endorsementsStorage = EndorsementsStorage(endorsementsStorageAddress);
  }

  function setRegistry(address registryAddress)
    external
    onlyOwner
  {
    registry = RegistryV0(registryAddress);
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

  function checkEndorsement(bytes32 primaryKey, bytes32 secondaryKey, address endorser) private view returns (bool didEndorse) {
    if (endorsementsStorage.getRecordCountFor(primaryKey) == 0) {
      return false;
    } else {
      uint index = endorsementsStorage.getSecondaryKeyIndex(primaryKey, secondaryKey);
      return endorsementsStorage.getAddress(primaryKey, index, keccak256("endorser")) == endorser;
    }
  }

  function endorse(bytes32 handle, string uuid) external payable {
    address endorsee = registry.getHandleOwner(handle);
    require(endorsee != address(0), "Could not find the handle in the registry");

    address endorser = msg.sender;
    bytes32 primaryKey = storagePrimaryKeyFor(handle, uuid);
    bytes32 secondaryKey = keccak256(abi.encodePacked(endorser));
    // TODO: figure if multiple endorsements are possible
    require(!checkEndorsement(primaryKey, secondaryKey, endorser), "You have already endorsed this content.");

    uint amount = msg.value;
    uint serviceFee = calculateServiceFee(amount);
    uint endorseeShare = amount - serviceFee;

    endorsementsStorage.addRecord(primaryKey, secondaryKey);
    uint index = endorsementsStorage.getSecondaryKeyIndex(primaryKey, secondaryKey);

    endorsementsStorage.setAddress(primaryKey, index, keccak256("endorser"), endorser);
    endorsementsStorage.setUint(primaryKey, index, keccak256("amount"), amount);

    endorsee.transfer(endorseeShare);
    emit EndorsementAdded(endorser, handle, keccak256(abi.encodePacked(uuid)));
  }

  function revokeEndorsement(bytes32 handle, string uuid) external {
    address endorser = msg.sender;
    address endorsee = registry.getHandleOwner(handle);

    require(endorsee != address(0), "Could not find the handle in the registry");

    bytes32 primaryKey = storagePrimaryKeyFor(handle, uuid);
    bytes32 secondaryKey = keccak256(abi.encodePacked(endorser));

    endorsementsStorage.removeRecord(primaryKey, secondaryKey);
  }

  function calculateServiceFee(uint256 totalAmount) public view returns(uint256 serviceFee) {
    return totalAmount * serviceFeeRatioAsWei / (1 ether);
  }

  function transfer(uint256 totalAmount, address recepient) public onlyOwner  {
    recepient.transfer(totalAmount);
  }

  // Make the contract killable
  function kill() public onlyOwner {
    selfdestruct(msg.sender);
  }
}
