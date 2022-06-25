import * as fs from 'fs';
import { error, warn } from './cli.js';

export interface ContractInfo {
  codeId: string;
  address: string;
}

export interface refs {
  [network: string]: {
    [contract: string]: ContractInfo;
  };
}

export class Refs {
  refs: refs;

  constructor(refInfo: refs) {
    this.refs = refInfo;
  }

  getContract(network: string, contract: string): ContractInfo {
    if (!this.refs[network]) {
      error(`Network ${network} not found in refs`, { exit: 1 });
    }
    if (!this.refs[network][contract]) {
      error(`Contract ${contract} not found for network ${network}`, {
        exit: 1,
      });
    }
    return this.refs[network][contract];
  }

  getCodeId(network: string, contract: string): string {
    if (!this.refs[network]) {
      error(`Network ${network} not found in refs`, { exit: 1 });
    }
    if (!this.refs[network][contract]) {
      error(`Contract ${contract} not found for network ${network}`, {
        exit: 1,
      });
    }
    return this.getContract(network, contract).codeId;
  }

  setCodeId(network: string, contract: string, codeId: string) {
    if (!this.refs[network]) {
      error(`Network ${network} not found in refs`, { exit: 1 });
    }
    if (!this.refs[network][contract]) {
      error(`Contract ${contract} not found for network ${network}`, {
        exit: 1,
      });
    }
    this.refs[network][contract].codeId = codeId;
  }

  getAddress(network: string, contract: string): string {
    if (!this.refs[network]) {
      error(`Network ${network} not found in refs`, { exit: 1 });
    }
    if (!this.refs[network][contract]) {
      error(`Contract ${contract} not found for network ${network}`, {
        exit: 1,
      });
    }
    return this.getContract(network, contract).address;
  }

  setAddress(network: string, contract: string, address: string) {
    if (!this.refs[network]) {
      error(`Network ${network} not found in refs`, { exit: 1 });
    }
    if (!this.refs[network][contract]) {
      error(`Contract ${contract} not found for network ${network}`, {
        exit: 1,
      });
    }
    this.refs[network][contract].address = address;
  }

  saveRefs(path: string, copyTo?: string[]) {
    fs.writeFileSync(path, JSON.stringify(this.refs, null, 2));
    (copyTo || []).forEach((dest) => {
      fs.copyFileSync(path, dest);
    });
  }
}

export function loadRefs(basePath: string): Refs {
  if (!fs.existsSync(basePath)) {
    warn(`Refs file not found at ${basePath}, creating new one`);
    fs.writeFileSync(basePath, JSON.stringify({}, null, 2));
    return new Refs({});
  }
  const refs = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  return new Refs(refs);
}
