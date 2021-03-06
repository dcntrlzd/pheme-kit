pragma solidity ^0.4.25;

/**
 * @title MultiOwnable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract MultiOwnable {
  mapping(address => bool) owners;

  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  constructor() public {
    owners[msg.sender] = true;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(owners[msg.sender], "Unauthorized Access");
    _;
  }

  /**
   * @dev Allows the current owner to add a new owner to the owners group.
   * @param owner The address to add to the owners group.
   */
  function addOwner(address owner) public onlyOwner {
    require(owner != address(0), "Invalid address");

    owners[owner] = true;
  }

  /**
   * @dev Allows the current owner to remove an owner from the owners group.
   * @param owner The address to remove from the owners group.
   */
  function removeOwner(address owner) public onlyOwner {
    require(owner != address(0), "Invalid address");
    require(owner != msg.sender, "You can not remove yourself");

    owners[owner] = false;
  }
}
