import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  Config, loadConfig, NetworkInfo, SignerInfo,
} from './config.js';
import { Client } from './client.js';
import { LOCALTERRA_MNEMONICS } from './utils.js';
import { error } from './cli.js';

async function setupEnv(): Promise<Client> {
  const argv = await yargs(hideBin(process.argv))
    .option('config', {
      alias: 'c',
      describe: 'config file',
      default: './terrarium.json',
    })
    .option('network', {
      alias: 'n',
      describe: 'network to use',
      default: 'localterra',
      choices: ['localterra', 'testnet', 'mainnet'],
      type: 'string',
    })
    .option('signer', {
      alias: 's',
      describe: 'signer to use',
      default: 'test1',
    }).argv;

  const config: Config = loadConfig(argv.config);

  if (!config.networks[argv.network]) {
    error(`Network ${argv.network} not found in config`, { exit: 1 });
  }
  const network: NetworkInfo = config.networks[argv.network];
  // Load signer information, with localterra special cases.
  let { signer } = argv;
  if (
    argv.network === 'localterra'
    && Object.keys(LOCALTERRA_MNEMONICS).includes(argv.signer)
  ) {
    signer = LOCALTERRA_MNEMONICS[argv.signer];
  } else {
    if (!config.signers || !config.signers[argv.signer]) {
      error(`Signer ${argv.signer} not found in config`, { exit: 1 });
    }
    const signerInfo: SignerInfo = config.signers[argv.signer];
    if (signerInfo.network && signerInfo.network !== argv.network) {
      error(
        `Signer ${argv.signer} is for network ${signerInfo.network}, not ${argv.network}`,
        { exit: 1 },
      );
    }
    signer = signerInfo.mnemonic;
  }
  const client = new Client({
    ...network,
    clientConfig: config,
    mnemonic: signer,
    network: argv.network,
  });
  return client;
}

/* eslint-disable no-unused-vars */
export default async function task(fn: (client: Client) => Promise<any>): Promise<any> {
  const client = await setupEnv();
  return await fn(client);
}
