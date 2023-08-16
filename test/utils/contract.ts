// Build ethers.Contract instances from ABI JSON files generated by truffle.
//
// adapted this utility from the handy work by the counterfactual team at:
// https://github.com/counterfactual/monorepo/blob/d9be8524a691c45b6aac1b5e1cf2ff81059203df/packages/contracts/utils/contract.ts

import * as ethers from "ethers";

interface NetworkMapping {
  [networkId: number]: { address: string };
}

interface BuildArtifact {
  readonly contractName: string;
  readonly abi: any[];
  readonly bytecode: string;
  readonly networks: NetworkMapping;
}

/**
 * Convenience class for an undeployed contract i.e. only the ABI and bytecode.
 */
export class AbstractContract {
  /**
   * Load build artifact by name into an abstract contract
   * @example
   *  const CountingApp = AbstractContract.fromArtifactName("CountingApp", { StaticCall })
   * @param artifactName The name of the artifact to load
   * @param links Optional AbstractContract libraries to link.
   * @returns Truffle artifact wrapped in an AbstractContract.
   */
  public static async fromArtifactName(
    artifactName: string,
    links?: { [name: string]: Promise<AbstractContract> }
  ): Promise<AbstractContract> {
    // these ABI JSON files are generated by truffle
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    const contract: BuildArtifact = await import(
      `../../build/contracts/${artifactName}.json`
    );
    return AbstractContract.fromBuildArtifact(contract, links, artifactName);
  }

  /**
   * Wrap build artifact in abstract contract
   * @param buildArtifact Truffle contract to wrap
   * @param links Optional AbstractContract libraries to link.
   * @returns Truffle artifact wrapped in an AbstractContract.
   */
  public static async fromBuildArtifact(
    buildArtifact: BuildArtifact,
    links?: { [name: string]: Promise<AbstractContract> },
    artifactName = "UntitledContract"
  ): Promise<AbstractContract> {
    return new AbstractContract(
      buildArtifact.abi,
      buildArtifact.bytecode,
      buildArtifact.networks,
      links,
      artifactName
    );
  }

  public static async getNetworkID(wallet: ethers.Wallet): Promise<number> {
    return (await wallet.provider.getNetwork()).chainId;
  }

  /**
   * @param abi ABI of the abstract contract
   * @param bytecode Binary of the abstract contract
   * @param networks Network mapping of deployed addresses
   * @param links
   * @param contractName
   */
  constructor(
    readonly abi: string[] | string,
    readonly bytecode: string,
    readonly networks: NetworkMapping,
    readonly links?: { [contractName: string]: Promise<AbstractContract> },
    readonly contractName?: string
  ) {}

  /**
   * Get the deployed singleton instance of this abstract contract, if it exists
   * @param Signer (with provider) to use for contract calls
   * @throws Error if AbstractContract has no deployed address
   */
  public async getDeployed(wallet: ethers.Wallet): Promise<ethers.Contract> {
    if (!wallet.provider) {
      throw new Error("Signer requires provider");
    }
    const networkId = (await wallet.provider.getNetwork()).chainId;
    const address = this.getDeployedAddress(networkId);
    return new ethers.Contract(address, this.abi, wallet);
  }

  /**
   * Deploy new instance of contract
   * @param wallet Wallet (with provider) to use for contract calls
   * @param args Optional arguments to pass to contract constructor
   * @returns New contract instance
   */
  public async deploy(
    wallet: ethers.Wallet,
    args?: any[]
  ): Promise<ethers.Contract> {
    if (!wallet.provider) {
      throw new Error("Signer requires provider");
    }

    const networkId = (await wallet.provider.getNetwork()).chainId;
    const bytecode = (await this.links)
      ? await this.generateLinkedBytecode(networkId)
      : this.bytecode;
    const contractFactory = new ethers.ContractFactory(
      this.abi,
      bytecode,
      wallet
    );
    return contractFactory.deploy(...(args || []));
  }

  /**
   * Connect to a deployed instance of this abstract contract
   * @param signer Signer (with provider) to use for contract calls
   * @param address Address of deployed instance to connect to
   * @returns Contract instance
   */
  public async connect(
    signer: ethers.Signer,
    address: string
  ): Promise<ethers.Contract> {
    return new ethers.Contract(address, this.abi, signer);
  }

  public getDeployedAddress(networkId: number): string {
    const info = this.networks[networkId];
    if (!info) {
      throw new Error(
        `Abstract contract ${this.contractName} not deployed on network ${networkId}`
      );
    }
    return info.address;
  }

  public async generateLinkedBytecode(networkId: number): Promise<string> {
    if (this.links === undefined) {
      throw new Error("Nothing to link");
    }
    let bytecode = this.bytecode;
    for (const name of Object.keys(this.links)) {
      const library = this.links[name];
      const regex = new RegExp(`__${name}_+`, "g");
      const address = (await library).getDeployedAddress(networkId);
      const addressHex = address.replace("0x", "");
      bytecode = bytecode.replace(regex, addressHex);
    }
    return bytecode;
  }
}
