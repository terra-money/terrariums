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
  },
  refs: {
    base_path: string;
    copy_refs_to?: string[];
  },
  signers?: {
    [signer: string]: SignerInfo;
  },
  contracts: {
    [contract: string]: {
        src: string;
        deploy_script?: string;
        instantiate_msg?: string;
    }
  }
}

export function loadConfig(configPath: string): Config {
  if (!fs.existsSync(configPath)) {
    error(`Config file not found at ${configPath}`, { exit: 1 });
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config;
}
