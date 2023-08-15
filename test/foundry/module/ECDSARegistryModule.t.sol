// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

// forge utils
import {Test} from "@forge/src/Test.sol";

// AA utils
import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {SmartAccountFactory} from "contracts/smart-account/factory/SmartAccountFactory.sol";
import {SmartAccount} from "contracts/smart-account/SmartAccount.sol";

import {EcdsaOwnershipRegistryModule} from "contracts/smart-account/modules/EcdsaOwnershipRegistryModule.sol";
import {MockToken} from "contracts/smart-account/test/mocks/MockToken.sol";

contract ECDSARegistryModuleTest is Test {

    address public deployer;
    address public smartAccountOwner;
    address public proxima424;
    address public bob;
    address public charlie;
    address public entryPointAdr;
    address public userSA;

    EntryPoint public entryPoint;
    SmartAccount public smartAccountImplementation;
    SmartAccountFactory public smartAccountFactory;
    EcdsaOwnershipRegistryModule public ecdsaOwnershipRegistryModule;
    MockToken public mockToken;

    uint256 smartAccountDeploymentIndex = 0;
    uint256 SIG_VALIDATION_SUCCESS = 0;
    uint256  SIG_VALIDATION_FAILED = 1;

    bytes32 EIP1271_INVALID_SIGNATURE = "0xffffffff";
    bytes32 EIP1271_MAGIC_VALUE = "0x1626ba7e";

    function setUp() public {
        // addresses
        deployer = makeAddr("deployer");
        smartAccountOwner = makeAddr("smartAccountOwner");
        proxima424 = makeAddr("proxima424");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");

        // AA deployments
        entryPoint = new EntryPoint();
        entryPointAdr = payable(address(entryPoint));

        smartAccountImplementation = new SmartAccount(IEntryPoint(entryPointAdr));
        smartAccountFactory = new SmartAccountFactory(address(smartAccountImplementation),address(this));
        ecdsaOwnershipRegistryModule = new EcdsaOwnershipRegistryModule();
        mockToken = new MockToken();
        bytes memory ecdsaSetupData = abi.encodeWithSignature("initForSmartAccount(address)", smartAccountOwner);
        userSA = smartAccountFactory.deployCounterFactualAccount(address(ecdsaOwnershipRegistryModule), ecdsaSetupData, smartAccountDeploymentIndex);

        // Fund contracts Ether
        vm.deal(deployer,5000);
        vm.deal(smartAccountOwner,5000);
        vm.deal(bob,5000);
        vm.deal(charlie,5000);
        vm.deal(userSA,5000);
        vm.deal(entryPointAdr,5000);

        // Fund contracts ERC20
        mockToken.mint(userSA,5*10**18);
        mockToken.mint(proxima424,5*10**18);
    }

    function test1_initForSmartAccount() public {}
    function test2_initForSmartAccount() public {}

    function test1_transferOwnership() public {}
    function test2_transferOwnership() public {}
    function test3_transferOwnership() public {}

    function test1_renounceOwnership() public {}

    function test1_validateuserOp() public {}
    function test2_validateuserOp() public {}
    function test3_validateuserOp() public {}
    function test4_validateuserOp() public {}
    function test5_validateuserOp() public {}
    function test6_validateuserOp() public {}
    
    function test1_isValidSignatureForAddress() public {}
    function test2_isValidSignatureForAddress() public {}
    function test3_isValidSignatureForAddress() public {}
    function test4_isValidSignatureForAddress() public {}

}