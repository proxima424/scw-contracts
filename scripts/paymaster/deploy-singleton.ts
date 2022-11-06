import hre, { ethers } from "hardhat";
async function main() {
  const owner = "0x7306aC7A32eb690232De81a9FFB44Bb346026faB";
  const verifyingSigner = "0x416B03E2E5476B6a2d1dfa627B404Da1781e210d";
  const entryPoint = "0xa948dc08f217C96c687dC3bF2E6051FB906b872A";

  const VerifyingSingletonPaymaster = await ethers.getContractFactory(
    "VerifyingSingletonPaymaster"
  );
  const singletonPaymster = await VerifyingSingletonPaymaster.deploy(
    entryPoint,
    owner,
    verifyingSigner
  );
  await singletonPaymster.deployed();
  console.log("singletonPaymster deployed at: ", singletonPaymster.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
