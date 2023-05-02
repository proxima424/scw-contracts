// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "hardhat/console.sol";

contract OracleAggregator is Ownable {
    struct TokenInfo {
        /* Number of decimals represents the precision of the price returned by the feed. For example, 
     a price of $100.50 might be represented as 100500000000 in the contract, with 9 decimal places 
     of precision */
        uint8 decimals;
        // uint8 tokenDecimals;
        bool dataSigned;
        address callAddress;
        bytes callData;
    }

    mapping(address => TokenInfo) internal tokensInfo;

    function setTokenOracle(
        address token,
        address callAddress,
        uint8 decimals,
        bytes calldata callData,
        bool signed
    ) external onlyOwner {
        require(
            callAddress != address(0),
            "OracleAggregator:: call address can not be zero"
        );
        require(
            token != address(0),
            "OracleAggregator:: token address can not be zero"
        );
        tokensInfo[token].callAddress = callAddress;
        tokensInfo[token].decimals = decimals;
        tokensInfo[token].callData = callData;
        tokensInfo[token].dataSigned = signed;
    }

    function getTokenOracleDecimals(
        address token
    ) external view returns (uint8 _tokenOracleDecimals) {
        _tokenOracleDecimals = tokensInfo[token].decimals;
    }

    function getTokenPrice(
        address token
    ) external view returns (uint256 tokenPrice) {
        // token / eth
        tokenPrice = _getTokenPrice(token);
    }

    // exchangeRate basically
    function getTokenValueOfOneEth(
        address token
    ) external view virtual returns (uint256 exchangeRate) {
        // we'd actually want eth / token
        console.log("here");
        uint256 tokenPriceUnadjusted = _getTokenPrice(token);
        uint8 _tokenOracleDecimals = tokensInfo[token].decimals;
        exchangeRate =
            ((10 ** _tokenOracleDecimals) *
                (10 ** IERC20Metadata(token).decimals())) /
            tokenPriceUnadjusted;
    }

    function _getTokenPrice(
        address token
    ) internal view returns (uint256 tokenPriceUnadjusted) {
        (bool success, bytes memory ret) = tokensInfo[token]
            .callAddress
            .staticcall(tokensInfo[token].callData);
        if (tokensInfo[token].dataSigned) {
            tokenPriceUnadjusted = uint256(abi.decode(ret, (int256)));
        } else {
            tokenPriceUnadjusted = abi.decode(ret, (uint256));
        }
    }
}
