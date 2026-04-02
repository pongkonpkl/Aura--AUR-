const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AuraL3Factory & GuardianOracle", function () {
  let factory, oracle, owner, user;
  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("GuardianOracle");
    oracle = await Oracle.deploy();
    const Factory = await ethers.getContractFactory("AuraL3Factory");
    factory = await Factory.deploy(oracle.address);
  });

  it("should emit RequestL3Deploy and allow oracle to approve", async () => {
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("testconfig"));
    await expect(factory.connect(user).requestL3Deploy(hash, 42))
      .to.emit(factory, "RequestL3Deploy").withArgs(user.address, hash, 42);

    // Simulate approve
    const testBytecode = "0x60006000"; // dummy/minimal
    await expect(factory.connect(owner).approveAndDeploy(hash, 42, testBytecode))
      .to.emit(factory, "L3Deployed");
  });
});
