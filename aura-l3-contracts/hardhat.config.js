require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    // sepolia: {
    //   url: "YOUR_ALCHEMY_API_URL",
    //   accounts: ["YOUR_PRIVATE_KEY"]
    // }
  }
};
