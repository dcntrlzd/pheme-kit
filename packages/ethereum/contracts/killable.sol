pragma solidity ^0.4.25;

import "./ownership/Ownable.sol";

contract Killable is Ownable {
  function kill() onlyOwner public {
    selfdestruct(owner);
  }
}
