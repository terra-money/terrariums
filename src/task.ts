import { LCDClient } from '@terra-money/terra.js';
import { Config, loadConfig, NetworkInfo } from './config.js';
import { cliOptions } from './utils.js';
import { error } from './log.js';
import { Deployer } from './deployer.js';
import { Executor } from './executor.js';
import { Signer } from './signers.js';
import { loadRefs, Refs } from './refs.js';

export type Env = {
  deployer: Deployer;
  executor: Executor;
  signer: Signer;
  refs: Refs;
  network: string;
};
export async function setupEnv(argv: any): Promise<Env> {
  const config: Config = loadConfig(argv.config);

  if (!config.networks[argv.network]) {
    error(`Network ${argv.network} not found in config`, { exit: 1 });
  }
  const network: NetworkInfo = config.networks[argv.network];

  const lcd = new LCDClient(network);
  const signer = new Signer({
    lcd,
    network: argv.network,
    config,
    name: argv.signer,
  });

  const refs = loadRefs(config);

  const deployer = new Deployer({
    network: argv.network,
    config,
    signer,
    refs,
  });
  const executor = new Executor({
    network: argv.network,
    signer,
    refs,
  });

  return {
    deployer,
    executor,
    signer,
    refs,
    network: argv.network,
  };
}

/* eslint-disable no-unused-vars */
export default async function task(
  fn: (env: Env) => Promise<any> | any,
  exit: boolean = true,
): Promise<any> {
  const env = await setupEnv(await cliOptions.argv);
  return fn(env)
    .then((result) => {
      if (exit) {
        process.exit(0);
      }
      return result;
    })
    .catch((err) => {
      error(err.message, { exit: 1 });
    });
}
