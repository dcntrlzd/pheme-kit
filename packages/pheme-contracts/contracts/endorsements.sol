pragma solidity ^0.4.25;

import "./ownable.sol";
import "./storage.sol";

contract Endorsements is Ownable {
  struct Endorsement {
    address endorser;
    uint amount;
  }

  Storage handleStorage = Storage(0);
  uint serviceFeeRatioAsWei = 10000000000000000; // 0.01 after ether conversion so 1%
  mapping(bytes32 => Endorsement[]) private map;

  event EndorsementAdded(address indexed endorser, bytes32 indexed handle, bytes32 indexed hashedUuid);
  event EndorsementRemoved(address indexed endorser, bytes32 indexed handle, bytes32 indexed hashedUuid);

  constructor(address handleStorageAddress) public {
    handleStorage = Storage(handleStorageAddress);
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
    address endorsee = handleStorage.getAddress(handle, keccak256("owner"));
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
}
