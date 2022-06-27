import {
  Coins,
  CreateTxOptions,
  LCDClient,
  LCDClientConfig,
  MnemonicKey,
  MsgExecuteContract,
  MsgInstantiateContract,
  MsgMigrateCode,
  MsgStoreCode,
  SignerData,
  WaitTxBroadcastResult,
  Wallet,
} from '@terra-money/terra.js';
import * as path from 'path';
import * as fs from 'fs';
import * as Os from 'os';

import { parse as parseTOML } from 'toml';
import { execSync } from 'child_process';
import ora from 'ora';
import { waitForInclusionInBlock } from './utils.js';
import { loadRefs, Refs } from './refs.js';
import { Config } from './config.js';
import { error, info, waitKey } from './log.js';

export type LCDClientOptions = LCDClientConfig & {
  mnemonic: string;
  clientConfig: Config;
  network: string;
};

export type InstantiateContractOptions = {
  sequence?: number;
  admin?: string;
  coins?: Coins.Input;
  label?: string;
};

export type ExecuteContractOptions = {
  sequence?: number;
  coins?: Coins.Input;
  txOptions?: CreateTxOptions;
};

export class Client extends LCDClient {
  signer: Wallet;

  refs: Refs;

  network: string;

  clientConfig: Config;

  constructor(config: LCDClientOptions) {
    super(config);
    this.clientConfig = config.clientConfig;
    this.signer = this.wallet(new MnemonicKey({ mnemonic: config.mnemonic }));
    this.refs = loadRefs(this.clientConfig.refs.base_path);
    this.network = config.network;
  }

  buildContract(contract: string) {
    if (!this.clientConfig.contracts[contract]) {
      error(
        `Contract ${contract} build information not found in config file.`,
        { exit: 1 },
      );
    }
    const buildInfo = this.clientConfig.contracts[contract];
    const contractFolder = path.join(process.cwd(), buildInfo.src);
    const cwd = process.cwd();
    process.chdir(contractFolder);
    execSync('cargo wasm', { stdio: 'inherit' });
    process.chdir(cwd);
  }

  optimizeContract(contract: string) {
    if (!this.clientConfig.contracts[contract]) {
      error(
        `Contract ${contract} build information not found in config file.`,
        { exit: 1 },
      );
    }
    const buildInfo = this.clientConfig.contracts[contract];
    const contractFolder = path.join(process.cwd(), buildInfo.src);
    const cwd = process.cwd();
    process.chdir(contractFolder);
    const cargoFile = path.join(contractFolder, 'Cargo.toml');
    if (!fs.existsSync(cargoFile)) {
      error(`Cargo.toml file not found in ${contractFolder}`, {
        exit: 1,
      });
    }

    const { package: pkg } = parseTOML(fs.readFileSync(cargoFile, 'utf8'));
    if (pkg.metadata?.scripts?.optimize) {
      const { optimize } = pkg.metadata.scripts;
      // TODO: is this really a good idea?
      /* eslint-disable no-eval */
      const optimizeCmd = eval('`' + optimize + '`');
      execSync(optimizeCmd, { stdio: 'inherit' });
    } else {
      const arm64 = process.arch === 'arm64';
      const image = `cosmwasm/rust-optimizer${arm64 ? '-arm64' : ''}:0.12.5`;
      const dir = Os.platform() === 'win32' ? '%cd%' : '$(pwd)';
      execSync(
        `docker run --rm -v "${dir}":/code \
            --mount type=volume,source="${contract}_cache",target=/code/target \
            --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
            ${image}`,
        { stdio: 'inherit' },
      );
    }
    process.chdir(cwd);
  }

  async storeCode(contract: string, migrateCodeId?: number): Promise<string> {
    if (!this.clientConfig.contracts[contract]) {
      error(
        `Contract ${contract} build information not found in config file.`,
        { exit: 1 },
      );
    }
    const buildInfo = this.clientConfig.contracts[contract];
    const contractFolder = path.join(process.cwd(), buildInfo.src);
    const cwd = process.cwd();
    process.chdir(contractFolder);

    const arm64 = process.arch === 'arm64';
    let wasmByteCodeFilename = `${contract.replace(/-/g, '_')}`;
    if (arm64) {
      wasmByteCodeFilename += '-arm64';
    }
    wasmByteCodeFilename += '.wasm';

    const wasm = path.join(contractFolder, 'artifacts', wasmByteCodeFilename);
    if (!fs.existsSync(wasm)) {
      error(`WASM file not found in ${contractFolder}`, {
        exit: 1,
      });
    }
    const wasmByteCode = fs.readFileSync(wasm).toString('base64');
    const action = ora({
      text: `Storing wasm file for ${contract}`,
      spinner: 'dots',
    }).start();
    const storeCodeTx = await this.signer.createAndSignTx({
      msgs: [
        migrateCodeId
          ? new MsgMigrateCode(
            this.signer.key.accAddress,
            migrateCodeId,
            wasmByteCode,
          )
          : new MsgStoreCode(this.signer.key.accAddress, wasmByteCode),
      ],
    });

    const result = await this.tx.broadcastSync(storeCodeTx);
    if ('code' in result) {
      action.fail();
      error(`Error storing wasm file for ${contract}:\n${result.raw_log}`, {
        exit: 1,
      });
    }

    const res = await waitForInclusionInBlock(this, result.txhash);
    action.succeed();

    try {
      const savedCodeId = JSON.parse((res && res.raw_log) || '')[0]
        .events.find((msg: { type: string }) => msg.type === 'store_code')
        .attributes.find(
          (attr: { key: string }) => attr.key === 'code_id',
        ).value;

      info(`code is stored at code id: ${savedCodeId}`);
      process.chdir(cwd);

      this.refs.setCodeId(this.network, contract, savedCodeId);
      this.refs.saveRefs(
        this.clientConfig.refs.base_path,
        this.clientConfig.refs.copy_refs_to,
      );

      return savedCodeId;
    } catch (e) {
      if (e instanceof SyntaxError) {
        error(`Error storing wasm file for ${contract}:\n${res.raw_log}`, {
          exit: 1,
        });
      } else {
        error(`Unexpcted Error: ${e}`, {
          exit: 1,
        });
      }
    }
    return '';
  }

  async instantiate(
    contract: string,
    msg: Object,
    options?: InstantiateContractOptions,
  ): Promise<{ address: string; raw_log: string }> {
    const codeId = this.refs.getCodeId(this.network, contract);
    if (!codeId) {
      error(`Contract ${contract} code id not found in refs.`, {
        exit: 1,
      });
    }
    const action = ora({
      text: `Instantiating ${contract} with code id ${codeId}`,
      spinner: 'dots',
    }).start();
    // Allow manual account sequences.
    const manualSequence = options?.sequence || (await this.signer.sequence());

    // Create signerData and txOptions for fee estimation.
    const accountInfo = await this.auth.accountInfo(this.signer.key.accAddress);
    const signerData: [SignerData] = [
      {
        sequenceNumber: manualSequence,
        publicKey: accountInfo.getPublicKey(),
      },
    ];
    const txOptions: CreateTxOptions = {
      msgs: [
        new MsgInstantiateContract(
          this.signer.key.accAddress,
          options?.admin,
          parseInt(codeId, 10),
          msg,
          options?.coins,
          options?.label || 'Instantiate',
        ),
      ],
    };

    // Set default terraDenom and feeDenoms value if not specified.
    if (!txOptions.feeDenoms) {
      txOptions.feeDenoms = ['uluna'];
    }
    const terraDenom = 'LUNA';

    // Prompt user to accept gas fee for contract initialization if network is mainnet.
    if (this.network === 'mainnet') {
      const feeEstimate = await this.tx.estimateFee(signerData, txOptions);
      const gasFee = Number(feeEstimate.amount.get(txOptions.feeDenoms[0])!.amount)
        / 1000000;
      await waitKey(
        `The gas needed to deploy the '${contract}' contact is estimated to be ${gasFee} ${terraDenom}. Press any key to continue or "ctl+c" to exit`,
      );
    }

    const instantiateTx = await this.signer.createAndSignTx({
      sequence: manualSequence,
      ...txOptions,
    });

    const result = await this.tx.broadcastSync(instantiateTx);
    const res = await waitForInclusionInBlock(this, result.txhash);

    let log: any[] = [];
    try {
      log = JSON.parse(res!.raw_log);
    } catch (e) {
      action.fail();
      if (e instanceof SyntaxError && res) {
        error(`Error instantiating ${contract}:\n${res.raw_log}`, {
          exit: 1,
        });
      } else {
        error(`Unexpcted Error: ${e}`, {
          exit: 1,
        });
      }
    }
    action.succeed();
    const event = log[0].events.find(
      (event: { type: string }) => event.type === 'instantiate_contract',
    )
      ?? log[0].events.find(
        (event: { type: string }) => event.type === 'instantiate',
      );

    const contractAddress: string = event.attributes.find(
      (attr: { key: string }) => attr.key === '_contract_address',
    ).value;
    info(`Contract ${contract} instantiated at ${contractAddress}`);
    this.refs.setAddress(this.network, contract, contractAddress);
    this.refs.saveRefs(
      this.clientConfig.refs.base_path,
      this.clientConfig.refs.copy_refs_to,
    );
    return { address: contractAddress, raw_log: res!.raw_log };
  }

  async query(contract: string, msg: Object) {
    const contractAddress = contract.startsWith('terra1')
      ? contract
      : this.refs.getContract(this.network, contract).address;
    return this.wasm.contractQuery(contractAddress, msg);
  }

  async execute(
    contract: string,
    msg: Object,
    options?: ExecuteContractOptions,
  ): Promise<WaitTxBroadcastResult> {
    const contractAddress = contract.startsWith('terra1')
      ? contract
      : this.refs.getContract(this.network, contract).address;
    const manualSequence = options?.sequence || (await this.signer.sequence());
    const msgs = [
      new MsgExecuteContract(
        this.signer.key.accAddress,
        contractAddress,
        msg,
        options?.coins,
      ),
    ];
    const mergedOptions = options?.txOptions
      ? { ...options!.txOptions, msgs, sequence: manualSequence }
      : { msgs, sequence: manualSequence };
    const action = ora({
      text: `Executing contract ${contract}`,
      spinner: 'dots',
    }).start();
    const tx = await this.signer.createAndSignTx(mergedOptions);
    const logs = await this.tx.broadcast(tx);
    action.succeed();
    return logs;
  }
}
