import {
  Key, LCDClient, MnemonicKey, Wallet,
} from '@terra-money/terra.js';
import { Config, SignerInfo } from './config.js';
import { LOCALTERRA_MNEMONICS } from './utils.js';

export type SignerOptions = {
  lcd: LCDClient;
  network?: string;
  name?: string;
  config?: Config;
  key?: Key;
}
/**
 * Utility class to load mnemonic keys from various sources.
 */
export class Signer extends Wallet {
  constructor(options: SignerOptions) {
    const key = Signer.loadKey(options);
    super(options.lcd, key);
  }

  private static loadKey(options: SignerOptions): Key {
    /**
     * Priority for finding a valid key:
     * 1. Key provided in options
     * 2. Mnemonic in environment variable
     * 3. Localterra mnemonics, if network is localterra
     * 4. Key provided in config file
     */
    if (options.key) {
      return options.key;
    }
    /* eslint-disable no-useless-escape */
    const regex = new RegExp(`^mnemonic(\.${options.network}$|$)`, 'i');
    const envMnemonic = Object.keys(process.env).find((key) => regex.test(key));
    if (envMnemonic) {
      return new MnemonicKey({ mnemonic: envMnemonic });
    }

    if (!options.name) {
      throw new Error('Signer name is required');
    }

    if (
      options.network === 'localterra'
      && Object.keys(LOCALTERRA_MNEMONICS).includes(options.name)
    ) {
      return new MnemonicKey({ mnemonic: LOCALTERRA_MNEMONICS[options.name] });
    }

    if (!options.config) {
      throw new Error(
        'Config is required if non-localterra signer and key not provided through environment variable',
      );
    }

    if (!options.config.signers || !options.config.signers[options.name]) {
      throw new Error(`Signer ${options.name} not found in config`);
    }
    const signerInfo: SignerInfo = options.config.signers[options.name];
    if (signerInfo.network && signerInfo.network !== options.network) {
      throw new Error(
        `Signer ${options.name} is for network ${signerInfo.network}, not ${options.network}`,
      );
    }
    return new MnemonicKey({ mnemonic: signerInfo.mnemonic });
  }
}
