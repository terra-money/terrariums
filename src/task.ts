import { Config, loadConfig, NetworkInfo, SignerInfo } from "./config.js";
import { Client } from "./client.js";
import { cliOptions, LOCALTERRA_MNEMONICS } from "./utils.js";
import { error } from "./log.js";

export async function setupEnv(argv: any): Promise<Client> {
  const config: Config = loadConfig(argv.config);

  if (!config.networks[argv.network]) {
    error(`Network ${argv.network} not found in config`, { exit: 1 });
  }
  const network: NetworkInfo = config.networks[argv.network];
  // Load signer information, with localterra special cases.
  let { signer } = argv;
  if (
    argv.network === "localterra" &&
    Object.keys(LOCALTERRA_MNEMONICS).includes(argv.signer)
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
        { exit: 1 }
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
export default async function task(
  fn: (client: Client) => Promise<any> | any,
  exit: boolean = true
): Promise<any> {
  const client = await setupEnv(await cliOptions.argv);
  return fn(client).then((result) => {
    if (exit) {
      process.exit(0);
    }
    return result;
  });
}
