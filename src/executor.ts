import {
  Coins,
  CreateTxOptions,
  MsgExecuteContract,
  WaitTxBroadcastResult,
  Wallet,
} from '@terra-money/terra.js';
import { Ora } from 'ora';
import { Refs } from './refs.js';

export type ExecutorOptions = {
  network: string;
  signer: Wallet;
  refs: Refs;
};

export type ExecuteContractOptions = {
  sequence?: number;
  coins?: Coins.Input;
  txOptions?: CreateTxOptions;
};

export class Executor {
  private network: string;

  private signer: Wallet;

  private refs: Refs;

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
    spinner?: Ora,
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

    spinner?.start();
    const tx = await this.signer.createAndSignTx(mergedOptions);
    const logs = await this.signer.lcd.tx.broadcast(tx);
    spinner?.succeed();
    return logs;
  }
}
