pragma solidity ^0.4.25;

import "../ownership/ownable.sol";
import "../registry/v1.sol";

import "./storage.sol";

contract EndorsementsV1 is Ownable {
  EndorsementsStorage endorsementsStorage = EndorsementsStorage(0);
  RegistryV1 registry = RegistryV1(0);

  struct Endorsement {
    address endorser;
    uint amount;
  }

  uint serviceFeeRatioAsWei = 10000000000000000; // 0.01 after ether conversion so 1%

  event EndorsementAdded(address indexed endorser, bytes32 indexed handle, bytes32 indexed hashedUuid);
  event EndorsementRemoved(address indexed endorser, bytes32 indexed handle, bytes32 indexed hashedUuid);

  constructor(address endorsementsStorageAddress, address registryAddress) public {
    registry = RegistryV1(registryAddress);
    endorsementsStorage = EndorsementsStorage(endorsementsStorageAddress);
  }

  function setRegistry(address registryAddress)
    external
    onlyOwner
  {
    registry = RegistryV1(registryAddress);
  }

  function getEndorsementCountByContent(bytes32 handle, string uuid)
    public
    view
    returns (uint endorsementCount)
  {
    return endorsementsStorage.getRecordCountByContent(handle, uuid);
  }

  function getEndorsementCountByEndorser(address endorser)
    public
    view
    returns (uint endorsementCount)
  {
    return endorsementsStorage.getRecordCountByEndorser(endorser);
  }

  function getEndorsementCountByHandle(bytes32 handle)
    public
    view
    returns (uint endorsementCount)
  {
    return endorsementsStorage.getRecordCountByHandle(handle);
  }

  function getEndorsementEndorser(bytes32 recordId)
    public
    view
    returns (address endorser)
  {
    return endorsementsStorage.getEndorser(recordId);
  }

  function getEndorsementHandle(bytes32 recordId)
    public
    view
    returns (bytes32 handle)
  {
    return endorsementsStorage.getHandle(recordId);
  }

  function getEndorsementUuid(bytes32 recordId)
    public
    view
    returns (string uuid)
  {
    return endorsementsStorage.getUuid(recordId);
  }

  function getEndorsementAmount(bytes32 recordId)
    public
    view
    returns (uint recordAmount)
  {
    return endorsementsStorage.getUint(recordId, keccak256("amount"));
  }

  function getEndorsementCreatedAt(bytes32 recordId)
    public
    view
    returns (uint createdAt)
  {
    return endorsementsStorage.getUint(recordId, keccak256("createdAt"));
  }

  function getRecordIdByHandleAt(bytes32 handle, uint index)
    public
    view
    returns (bytes32 endorsementId)
  {
    return endorsementsStorage.getRecordIdByHandleAt(handle, index);
  }

  function getRecordIdByContentAt(bytes32 handle, string uuid, uint index)
    public
    view
    returns (bytes32 endorsementId)
  {
    return endorsementsStorage.getRecordIdByContentAt(handle, uuid, index);
  }

  function getRecordIdByEndorserAt(address endorser, uint index)
    public
    view
    returns (bytes32 endorsementId)
  {
    return endorsementsStorage.getRecordIdByEndorserAt(endorser, index);
  }

  function getEndorsementId(bytes32 handle, string uuid, address endorser)
    public
    view
    returns (bytes32 endorsementId)
  {
    return endorsementsStorage.calculateId(handle, uuid, endorser);
  }

  function endorse(bytes32 handle, string uuid) external payable {
    address endorsee = registry.getHandleOwner(handle);
    require(endorsee != address(0), "Could not find the handle in the registry");

    address endorser = msg.sender;

    uint amount = msg.value;
    uint serviceFee = calculateServiceFee(amount);
    uint endorseeShare = amount - serviceFee;

    bytes32 endorsementId = getEndorsementId(handle, uuid, endorser);

    if (endorsementsStorage.getEndorser(endorsementId) != endorser) {
      // endorsement does not exist so we create a new one
      endorsementsStorage.addRecord(handle, uuid, endorser);
      endorsementsStorage.setUint(endorsementId, keccak256("amount"), amount);
      endorsementsStorage.setUint(endorsementId, keccak256("createdAt"), block.timestamp);
    } else {
      // endorsement already exist so we modify the old one
      uint previousAmount = endorsementsStorage.getUint(endorsementId, keccak256("amount"));
      endorsementsStorage.setUint(endorsementId, keccak256("amount"), previousAmount + amount);
    }

    endorsee.transfer(endorseeShare);
    emit EndorsementAdded(endorser, handle, keccak256(abi.encodePacked(uuid)));
  }

  function revokeEndorsement(bytes32 handle, string uuid) external {
    address endorser = msg.sender;
    address endorsee = registry.getHandleOwner(handle);

    require(endorsee != address(0), "Could not find the handle in the registry");

    endorsementsStorage.removeRecord(handle, uuid, endorser);
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
