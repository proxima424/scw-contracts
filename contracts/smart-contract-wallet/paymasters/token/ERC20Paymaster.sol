// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/* solhint-disable reason-string */
/* solhint-disable no-inline-assembly */
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {UserOperation, UserOperationLib} from "@account-abstraction/contracts/interfaces/UserOperation.sol";
import {BasePaymaster, IEntryPoint} from "../BasePaymaster.sol";
import {PaymasterHelpers, PaymasterData, PaymasterContext} from "../PaymasterHelpers.sol";

/**
 * @title
 * @dev
 * @notice
 */
// BasePaymaster,
contract ERC20Paymaster is ReentrancyGuard {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;
    using PaymasterHelpers for UserOperation;
    using PaymasterHelpers for bytes;
    using PaymasterHelpers for PaymasterData;
}
