pragma solidity ^0.4.25;

import "./ownership/ownable.sol";
import "./registry.sol";

contract Endorsements is Ownable {
  struct Endorsement {
    address endorser;
    uint amount;
  }

  Registry registry = Registry(0);
  uint serviceFeeRatioAsWei = 10000000000000000; // 0.01 after ether conversion so 1%
  mapping(bytes32 => Endorsement[]) private map;

  event EndorsementAdded(address indexed endorser, bytes32 indexed handle, bytes32 indexed hashedUuid);
  event EndorsementRemoved(address indexed endorser, bytes32 indexed handle, bytes32 indexed hashedUuid);

  constructor(address registryAddress) public {
    registry = Registry(registryAddress);
  }

  function setRegistry(address registryAddress)
    external
    onlyOwner
  {
    registry = Registry(registryAddress);
  }

  function getEndorsementCount(bytes32 handle, string uuid) public view returns (uint endorsementCount) {
    bytes32 key = keccak256(abi.encodePacked(handle, uuid));
    return map[key].length;
  }

  function getEndorsementEndorser(bytes32 handle, string uuid, uint index) public view returns (address endorser) {
    bytes32 key = keccak256(abi.encodePacked(handle, uuid));
    return map[key][index].endorser;
  }

  function getEndorsementAmount(bytes32 handle, string uuid, uint index) public view returns (uint amount) {
    bytes32 key = keccak256(abi.encodePacked(handle, uuid));
    return map[key][index].amount;
  }

  function endorse(bytes32 handle, string uuid) payable external {
    address endorser = msg.sender;
    address endorsee = registry.getHandleOwner(handle);

    require (endorsee != address(0));

    uint amount = msg.value;
    uint serviceFee = calculateServiceFee(amount);
    uint endorseeShare = amount - serviceFee;

    bytes32 key = keccak256(abi.encodePacked(handle, uuid));
    map[key].push(Endorsement(endorser, amount));

    endorsee.transfer(endorseeShare);
    emit EndorsementAdded(endorser, handle, keccak256(abi.encodePacked(uuid)));
  }

  function calculateServiceFee(uint256 totalAmount) public view returns(uint256 serviceFee) {
    return totalAmount * serviceFeeRatioAsWei / (1 ether);
  }

  // Make the contract killable
  function kill() onlyOwner {
    selfdestruct(msg.sender);
  }
}
