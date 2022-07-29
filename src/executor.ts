import {
  Coins,
  CreateTxOptions,
  MsgExecuteContract,
  WaitTxBroadcastResult,
  Wallet,
} from '@terra-money/terra.js';
import ora, { Ora } from 'ora';
import { Refs } from './refs.js';

export type ExecutorOptions = {
  network: string;
  signer: Wallet;
  refs: Refs;
};

export type ExecuteContractOptions = {
  sequence?: number;
  coins?: Coins.Input;
  txOptions?: Partial<CreateTxOptions>;
};

export class Executor {
  protected network: string;

  protected signer: Wallet;

  protected refs: Refs;

  constructor(options: ExecutorOptions) {
    this.network = options.network;
    this.signer = options.signer;
    this.refs = options.refs;
  }

  async query(contract: string, msg: Object) {
    const contractAddress = contract.startsWith('terra1')
      ? contract
      : this.refs.getContract(this.network, contract).address;
    return this.signer.lcd.wasm.contractQuery(contractAddress, msg);
  }

  async execute(
    contract: string,
    msg: Object,
    options?: ExecuteContractOptions,
    spinner: Ora | null = ora({ spinner: 'dots' }),
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

    spinner?.start(`Executing contract with message: ${JSON.stringify(msg)}`);
    const tx = await this.signer.createAndSignTx(mergedOptions);
    const logs = await this.signer.lcd.tx.broadcast(tx);
    spinner?.succeed(`Executed contract with message: ${JSON.stringify(msg)}`);
    return logs;
  }
}
