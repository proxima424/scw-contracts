/* eslint-disable no-unused-expressions */
/* eslint-disable node/no-missing-import */
/* eslint-disable camelcase */
import { Create2Factory } from "../../../src/Create2Factory";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  SmartAccount,
  SmartAccount__factory,
  EntryPoint,
  SmartAccountFactory,
  SmartAccountFactory__factory,
  EntryPoint__factory,
  StackupVerifyingPaymaster,
  StackupVerifyingPaymaster__factory,
  TestToken,
  MockToken,
} from "../../../typechain";
import { AddressZero } from "../../smart-wallet/testutils";
import { simulationResultCatch } from "../../aa-core/testutils";
import { fillAndSign, fillUserOp } from "../../utils/userOp";
import { arrayify, hexConcat, parseEther } from "ethers/lib/utils";
import { BigNumber, BigNumberish, Contract, Signer } from "ethers";

const MOCK_VALID_UNTIL = "0x00000000deadbeef";
const MOCK_VALID_AFTER = "0x0000000000001234";
const MOCK_SIG = "0x1234";
const MOCK_ERC20_ADDR = "0x" + "01".repeat(20);
// Assume TOKEN decimals is 18, then 1 ETH = 1000 TOKENS
// const MOCK_FX = ethers.constants.WeiPerEther.mul(1000);

const MOCK_FX = "977100"; // matic to usdc approx
console.log("MOCK FX ", MOCK_FX); // 1000000000000000000000

export async function deployEntryPoint(
  provider = ethers.provider
): Promise<EntryPoint> {
  const epf = await (await ethers.getContractFactory("EntryPoint")).deploy();
  return EntryPoint__factory.connect(epf.address, provider.getSigner());
}

export const encodePaymasterData = (
  token = ethers.constants.AddressZero,
  fx = ethers.constants.Zero
) => {
  return ethers.utils.defaultAbiCoder.encode(
    ["uint48", "uint48", "address", "uint256"],
    [MOCK_VALID_UNTIL, MOCK_VALID_AFTER, token, fx]
  );
};

const getUserOpEvent = async (ep: EntryPoint) => {
  const [log] = await ep.queryFilter(
    ep.filters.UserOperationEvent(),
    await ethers.provider.getBlockNumber()
  );
  return log;
};

export const encodeERC20Approval = (
  account: SmartAccount,
  token: TestToken,
  spender: string,
  amount: BigNumber
) => {
  return account.interface.encodeFunctionData("executeCall", [
    token.address,
    0,
    token.interface.encodeFunctionData("approve", [spender, amount]),
  ]);
};

describe("EntryPoint with AdvancedVerifyingPaymaster (stackup) : Paying in ERC20", function () {
  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let depositorSigner: Signer;
  let walletOwner: Signer;
  let token: MockToken;
  let proxyPaymaster: Contract;
  let walletAddress: string, paymasterAddress: string;
  let ethersSigner;

  let offchainSigner: Signer, deployer: Signer;

  // let verifyingSingletonPaymaster: VerifyingSingletonPaymaster;
  let sampleTokenPaymaster: StackupVerifyingPaymaster;
  let smartWalletImp: SmartAccount;
  let walletFactory: SmartAccountFactory;
  const abi = ethers.utils.defaultAbiCoder;

  beforeEach(async function () {
    ethersSigner = await ethers.getSigners();
    entryPoint = await deployEntryPoint();
    entryPointStatic = entryPoint.connect(AddressZero);

    deployer = ethersSigner[0];
    offchainSigner = ethersSigner[1];
    depositorSigner = ethersSigner[2];
    walletOwner = deployer; // ethersSigner[3];

    // const offchainSignerAddress = await deployer.getAddress();
    const walletOwnerAddress = await walletOwner.getAddress();

    sampleTokenPaymaster = await new StackupVerifyingPaymaster__factory(
      deployer
    ).deploy(entryPoint.address, await offchainSigner.getAddress());

    const MockToken = await ethers.getContractFactory("MockToken");
    token = await MockToken.deploy();
    await token.deployed();
    console.log("Test token deployed at: ", token.address);

    smartWalletImp = await new SmartAccount__factory(deployer).deploy(
      entryPoint.address
    );

    walletFactory = await new SmartAccountFactory__factory(deployer).deploy(
      smartWalletImp.address
    );

    await walletFactory.deployCounterFactualAccount(walletOwnerAddress, 0);
    const expected = await walletFactory.getAddressForCounterFactualAccount(
      walletOwnerAddress,
      0
    );

    console.log("mint tokens to owner address..");
    await token.mint(walletOwnerAddress, ethers.utils.parseEther("1000000"));

    walletAddress = expected;
    console.log(" wallet address ", walletAddress);

    paymasterAddress = sampleTokenPaymaster.address;
    console.log("Paymaster address is ", paymasterAddress);

    /* await sampleTokenPaymaster
      .connect(deployer)
      .addStake(0, { value: parseEther("2") });
    console.log("paymaster staked"); */

    await entryPoint.depositTo(paymasterAddress, { value: parseEther("1") });

    // const resultSet = await entryPoint.getDepositInfo(paymasterAddress);
    // console.log("deposited state ", resultSet);
  });

  describe("#validatePaymasterUserOp", () => {
    it("succeed with valid signature (token address random 0x11111111....)", async () => {
      const userOp1 = await fillAndSign(
        {
          sender: walletAddress,
          verificationGasLimit: 200000,
          paymasterAndData: ethers.utils.hexConcat([
            paymasterAddress,
            encodePaymasterData(MOCK_ERC20_ADDR, MOCK_FX),
            "0x" + "00".repeat(65),
          ]),
        },
        walletOwner,
        entryPoint,
        "nonce"
      );

      const hash = await sampleTokenPaymaster.getHash(
        userOp1,
        MOCK_VALID_UNTIL,
        MOCK_VALID_AFTER,
        MOCK_ERC20_ADDR,
        MOCK_FX
      );
      const sig = await offchainSigner.signMessage(arrayify(hash));
      const userOp = await fillAndSign(
        {
          ...userOp1,
          paymasterAndData: ethers.utils.hexConcat([
            paymasterAddress,
            encodePaymasterData(MOCK_ERC20_ADDR, MOCK_FX),
            sig,
          ]),
        },
        walletOwner,
        entryPoint,
        "nonce"
      );
      const res = await entryPoint.callStatic
        .simulateValidation(userOp)
        .catch(simulationResultCatch);
      expect(res.returnInfo.sigFailed).to.be.false;
      expect(res.returnInfo.validAfter).to.equal(
        ethers.BigNumber.from(MOCK_VALID_AFTER)
      );
      expect(res.returnInfo.validUntil).to.equal(
        ethers.BigNumber.from(MOCK_VALID_UNTIL)
      );
      expect(res.returnInfo.paymasterContext).to.not.equal("0x");

      console.log("userOp is");
      console.log(userOp);

      await entryPoint.handleOps([userOp], await offchainSigner.getAddress());
      await expect(
        entryPoint.handleOps([userOp], await offchainSigner.getAddress())
      ).to.be.reverted;
    });

    it("succeed with valid signature and valid erc20 approval", async () => {
      await token
        .connect(deployer)
        .transfer(walletAddress, ethers.utils.parseEther("100"));

      const userSCW: any = await ethers.getContractAt(
        "contracts/smart-contract-wallet/SmartAccount.sol:SmartAccount",
        walletAddress
      );

      const userOp1 = await fillAndSign(
        {
          sender: walletAddress,
          verificationGasLimit: 200000,
          paymasterAndData: ethers.utils.hexConcat([
            paymasterAddress,
            encodePaymasterData(token.address, MOCK_FX),
            "0x" + "00".repeat(65),
          ]),
          callData: encodeERC20Approval(
            userSCW,
            token,
            paymasterAddress,
            ethers.constants.MaxUint256
          ),
        },
        walletOwner,
        entryPoint,
        "nonce"
      );

      const hash = await sampleTokenPaymaster.getHash(
        userOp1,
        MOCK_VALID_UNTIL,
        MOCK_VALID_AFTER,
        token.address,
        MOCK_FX
      );
      const sig = await offchainSigner.signMessage(arrayify(hash));
      const userOp = await fillAndSign(
        {
          ...userOp1,
          paymasterAndData: ethers.utils.hexConcat([
            paymasterAddress,
            encodePaymasterData(token.address, MOCK_FX),
            sig,
          ]),
        },
        walletOwner,
        entryPoint,
        "nonce"
      );

      const requiredPrefund = ethers.BigNumber.from(userOp.callGasLimit)
        .add(ethers.BigNumber.from(userOp.verificationGasLimit).mul(3))
        .add(userOp.preVerificationGas)
        .mul(userOp.maxFeePerGas);

      console.log("required prefund ", requiredPrefund.toString());

      const initBalance = await token.balanceOf(
        await offchainSigner.getAddress()
      );
      console.log("fee receiver token balance before ", initBalance.toString());

      const preTokenBalanceForAccount = await token.balanceOf(walletAddress);
      console.log(
        "smart account erc20 balance before",
        preTokenBalanceForAccount.toString()
      );

      const tx = await entryPoint.handleOps(
        [userOp],
        await offchainSigner.getAddress()
      );
      const receipt = await tx.wait();
      console.log(
        "fees paid in native ",
        receipt.effectiveGasPrice.mul(receipt.gasUsed).toString()
      );

      console.log("gas used ");
      console.log(receipt.gasUsed.toNumber());

      const postBalance = await token.balanceOf(
        await offchainSigner.getAddress()
      );
      console.log("fee receiver token balance after ", postBalance.toString());

      const postTokenBalanceForAccount = await token.balanceOf(walletAddress);
      console.log(
        "smart account erc20 balance after",
        postTokenBalanceForAccount.toString()
      );

      console.log(
        "required prefund in token terms ",
        requiredPrefund
          .mul(MOCK_FX)
          .div(ethers.constants.WeiPerEther)
          .toString()
      );

      const ev = await getUserOpEvent(entryPoint);
      expect(ev.args.success).to.be.true;

      /* expect(postBalance.sub(initBalance)).to.be.greaterThan(
        ethers.constants.Zero
      );
      expect(postBalance.sub(initBalance)).to.be.lessThanOrEqual(
        requiredPrefund.mul(MOCK_FX).div(ethers.constants.WeiPerEther)
      ); */

      await expect(
        entryPoint.handleOps([userOp], await offchainSigner.getAddress())
      ).to.be.reverted;
    });
  });
});
