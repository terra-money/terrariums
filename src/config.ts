import * as fs from 'fs';
import { error } from './log.js';

export interface NetworkInfo {
  chainID: string;
  URL: string;
}

export interface SignerInfo {
  mnemonic: string;
  network?: string;
}

export interface Config {
  networks: {
    [network: string]: NetworkInfo;
  };
  refs: {
    base_path: string;
    copy_refs_to?: string[];
  };
  signers?: {
    [signer: string]: SignerInfo;
  };
  contracts: {
    [contract: string]: {
      src: string;
      deploy_script?: string;
      instantiate_msg?: string;
    };
  };
  workspace_optimizer?: boolean;
}

export function loadConfig(configPath: string): Config {
  if (!fs.existsSync(configPath)) {
    error(`Config file not found at ${configPath}`, { exit: 1 });
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config;
}

export function defaultNetworkInfo(network: string): NetworkInfo {
  switch (network) {
    case 'localterra':
      return {
        chainID: 'localterra',
        URL: 'http://localhost:1317',
      };
    case 'testnet':
      return {
        chainID: 'pisco-1',
        URL: 'https://pisco-lcd.terra.dev',
      };
    case 'mainnet':
      return {
        chainID: 'phoenix-1',
        URL: 'https://phoenix-lcd.terra.dev',
      };
    default:
      throw new Error(`Unknown network ${network}`);
  }
}
