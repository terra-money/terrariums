# terrarium.js

A simple set of utilities for writing deployment and test scripts for Terra projects.

Terrarium provides an object for easily interacting with smart contracts within a project, allowing for easy deployment workflows with inter-contract dependencies and even easy end-to-end testing. In your scripts, you can reference contracts by name and Terrarium will automatically fill in addresses and source code paths from the configuration file and from a synced `refs.json` file, which contains information about each contract by network.

## Setup

1. Add the `terrarium.js` package to your project using the package manager of your choice.
2. Create a `terrarium.json` configuration file in your project root. See below for a template.

## Examples

We can use terrarium.js to deploy a smart contract with dynamic arguments:

```ts
import { task, Client } from "terrarium.js";

task(async (client: Client) => {
  let contract1Address = client.refs.getContract(
    client.network,
    "contract1Address"
  );

  client.buildContract("contract2");
  client.optimizeContract("contract2");

  client.storeCode("contract2");
  client.instantiate("contract2", { addr_for_contract1: contract1Address });
});
```

This can be run by adding the script to your `package.json`:

```json
"scripts": {
    "deploy": "ts-node scripts/deploy.ts", // We can also just use node, but we lose type annotations
    ...
}
```

And then running `yarn` or `npm`:

```sh
yarn run deploy --network testnet --signer test2
```

## Client API

### `buildContract(contract: string)`

Runs `cargo wasm` for the given contract. The build directory for the contract is specified in your `terrarium.json` file.

### `optimizeContract(contract: string)`

Runs the `cosmwasm/rust-optimizer` tool for the given contract. If the contract's `Cargo.toml` has an entry like below, it will run that instead:

```toml
[package.metadata.scripts]
optimize = "..."
```

### `storeCode(contract: string): Promise<string>`

Stores the contract's WASM bytecode in the to the network specified by the `--network` or `-n` flag, using the signer specified by the `--signer` or `-s` flag. Returns the resulting code ID, and updates the `refs` file specified by your `terrarium.json` config.

### `instantiate(contract: string, msg: Object, ...): Promise<string>`

Instantiates the contract with the given `InstantiateMsg`. The message is JSON-encoded and sent to the network specified by the `--network` or `-n` flag, using the signer specified by the `--signer` or `-s` flag. Additional arguments can be passed to the `InstantiateMsg`. Returns the resulting contract address, and updates the `refs` file specified by your `terrarium.json` config.

### `execute(contract: string, msg: Object, ...): Promise<WaitTxBroadcastResult>`

Executes the contract with the given `ExecuteMsg`. The message is JSON-encoded and sent to the network specified by the `--network` or `-n` flag, using the signer specified by the `--signer` or `-s` flag. Additional arguments can be passed to the `ExecuteMsg`. Returns the resulting tx object.

### `query(contract: string, msg: Object): Promise<Object>`

Queries the contract with the given `QueryMsg`. The message is JSON-encoded and sent to the network specified by the `--network` or `-n` flag. Returns the query result.

## Configuration

Here is a template for the `terrarium.json` configuration file:

```json
{
  "networks": {
    "mainnet": {
      "chainID": "phoenix-1",
      "URL": "https://lcd.terra.dev"
    },
    "testnet": {
      "chainID": "pisco-1",
      "URL": "https://pisco-lcd.terra.dev"
    },
    "localterra": {
      "chainID": "localterra",
      "URL": "http://localhost:1317"
    }
  },
  "refs": {
    "base_path": "./refs.json",
    "copy_refs_to": []
  },
  "contracts": {
    "example_contract": {
      "src": "./contracts/example_contract/"
    }
  }
}
```
