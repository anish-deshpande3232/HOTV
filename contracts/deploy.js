const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ProvenanceTracker...\n");

  const [deployer] = await ethers.getSigners();
  console.log(`📍 Deploying with account: ${deployer.address}`);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.utils.formatEther(balance)} ETH\n`);

  const ProvenanceTracker = await ethers.getContractFactory("ProvenanceTracker");
  const contract = await ProvenanceTracker.deploy();

  await contract.deployed();

  const address = contract.address;
  console.log(`✅ ProvenanceTracker deployed to: ${address}`);

  const fs = require("fs");

  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  fs.writeFileSync(
    "./deployments/latest.json",
    JSON.stringify(
      {
        network: hre.network.name,
        contractAddress: address,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log("📄 Deployment info saved to deployments/latest.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
