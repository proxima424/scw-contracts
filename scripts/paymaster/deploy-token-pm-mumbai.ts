import hre, { ethers } from "hardhat";
import {
  deployContract,
  encodeParam,
  DEPLOYMENT_SALTS,
  getDeployerInstance,
  isContract,
} from "../utils";
import { Deployer, Deployer__factory } from "../../typechain";

const provider = ethers.provider;
const DEPLOYER_CONTRACT_ADDRESS =
  process.env.DEPLOYER_CONTRACT_ADDRESS_DEV || "";

/*
 *  This function is added to support the flow with pre-deploying the deployer contract
 *  using the `deployer-contract.deploy.ts` script.
 */
async function getPredeployedDeployerContractInstance(): Promise<Deployer> {
  const code = await provider.getCode(DEPLOYER_CONTRACT_ADDRESS);
  const chainId = (await provider.getNetwork()).chainId;
  const [signer] = await ethers.getSigners();

  if (code === "0x") {
    console.log(
      `Deployer not deployed on chain ${chainId}, deploy it with deployer-contract.deploy.ts script before using this script.`
    );
    throw new Error("Deployer not deployed");
  } else {
    console.log(
      "Deploying with EOA %s through Deployer Contract %s",
      signer.address,
      DEPLOYER_CONTRACT_ADDRESS
    );
    return Deployer__factory.connect(DEPLOYER_CONTRACT_ADDRESS, signer);
  }
}

async function main() {
  let tx, receipt;
  const provider = ethers.provider;

  const owner = "0x7306aC7A32eb690232De81a9FFB44Bb346026faB";
  const verifyingSigner = "0x37ca4D86A0e33502F7CD93e0C88AFa2F172d39a1";
  const entryPoint =
    process.env.ENTRY_POINT_ADDRESS ||
    "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

  const deployerInstance = await getPredeployedDeployerContractInstance();

  const saltOA = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(DEPLOYMENT_SALTS.ORACLE_AGGREGATOR)
  );

  const saltPM = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(DEPLOYMENT_SALTS.TOKEN_PAYMASTER)
  );

  const OracleAggregator = await ethers.getContractFactory("OracleAggregator");

  const oracleAggregatorBytecode = `${OracleAggregator.bytecode}`;

  const oracleAggregatorComputedAddr = await deployerInstance.addressOf(saltOA);

  await deployContract(
    DEPLOYMENT_SALTS.ORACLE_AGGREGATOR,
    oracleAggregatorComputedAddr,
    saltOA,
    oracleAggregatorBytecode,
    deployerInstance
  );

  const BiconomyTokenPaymaster = await ethers.getContractFactory(
    "BiconomyTokenPaymaster"
  );
  const biconomyTokenPaymasterBytecode = `${
    BiconomyTokenPaymaster.bytecode
  }${encodeParam("address", owner).slice(2)}${encodeParam(
    "address",
    entryPoint
  ).slice(2)}${encodeParam("address", verifyingSigner).slice(2)}${encodeParam(
    "address",
    oracleAggregatorComputedAddr
  ).slice(2)}`;

  const biconomyTokenPaymasterComputedAddr = await deployerInstance.addressOf(
    saltPM
  );
  console.log(
    "biconomyTokenPaymaster Computed Address: ",
    biconomyTokenPaymasterComputedAddr
  );
  const isContractDeployed = await isContract(
    biconomyTokenPaymasterComputedAddr,
    provider
  );
  if (!isContractDeployed) {
    await deployContract(
      DEPLOYMENT_SALTS.SINGELTON_PAYMASTER,
      biconomyTokenPaymasterComputedAddr,
      saltPM,
      biconomyTokenPaymasterBytecode,
      deployerInstance
    );
  } else {
    console.log(
      "verifyingSingletonPaymaster is Already deployed with address ",
      biconomyTokenPaymasterComputedAddr
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
