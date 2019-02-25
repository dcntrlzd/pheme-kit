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

  function getEndorsementCountByContent(bytes32 handle, string uuid) public view returns (uint endorsementCount) {
    return endorsementsStorage.getRecordCountByContent(handle, uuid);
  }

  function getEndorsementCountByEndorser(address endorser) public view returns (uint endorsementCount) {
    return endorsementsStorage.getRecordCountByEndorser(endorser);
  }

  function getEndorsementCountByHandle(bytes32 handle) public view returns (uint endorsementCount) {
    return endorsementsStorage.getRecordCountByHandle(handle);
  }

  function getEndorsementEndorser(bytes32 handle, string uuid, uint index) public view returns (address endorser) {
    bytes32 recordId = endorsementsStorage.getRecordIdByContentAt(handle, uuid, index);
    return endorsementsStorage.getEndorser(recordId);
  }

  function getEndorsementAmount(bytes32 handle, string uuid, uint index) public view returns (uint amount) {
    bytes32 recordId = endorsementsStorage.getRecordIdByContentAt(handle, uuid, index);
    return endorsementsStorage.getUint(recordId, keccak256("amount"));
  }

  function checkEndorsement(bytes32 handle, string uuid, address endorser) private view returns (bool didEndorse) {
    bytes32 recordId = endorsementsStorage.calculateId(handle, uuid, endorser);
    return endorsementsStorage.getEndorser(recordId) == endorser;
  }

  function endorse(bytes32 handle, string uuid) external payable {
    address endorsee = registry.getHandleOwner(handle);
    require(endorsee != address(0), "Could not find the handle in the registry");

    address endorser = msg.sender;
    // TODO: figure if multiple endorsements are possible
    require(!checkEndorsement(handle, uuid, endorser), "You have already endorsed this content.");

    uint amount = msg.value;
    uint serviceFee = calculateServiceFee(amount);
    uint endorseeShare = amount - serviceFee;

    endorsementsStorage.addRecord(handle, uuid, endorser);
    bytes32 recordId = endorsementsStorage.calculateId(handle, uuid, endorser);

    endorsementsStorage.setUint(recordId, keccak256("amount"), amount);

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
