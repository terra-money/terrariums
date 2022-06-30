# terrariums

A simple set of utilities for writing deployment and test scripts for Terra projects.

Terrariums provides an interface for easily interacting with smart contracts within a project, allowing for easy deployment workflows with inter-contract dependencies and even easy end-to-end testing. In your scripts, you can reference contracts by name and Terrarium will automatically fill in addresses and source code paths from the configuration file and from a synced `refs.json` file, which contains information about each contract by network.

## Setup

1. Add the `terrariums` package to your project using the package manager of your choice.
2. Create a `terrarium.json` configuration file in your project root. See below for a template.

## Examples

We can use terrariums to deploy a smart contract with dynamic arguments:

```ts
import task, { Deployer, Executor, Signer, Refs } from "terrariums";

task(async ({deployer, executor, signer, refs, network}) => {
  //Fetch information about "contract1" from the saved refs.json file:
  let contract1Info = refs.getContract(
    network, //The current network that was selected by the CLI options (--network testnet, for example)
    "contract1"
  );
  //Then we can deploy a contract, "contract2", which references the currently deployed :
  deployer.buildContract("contract2");
  deployer.optimizeContract("contract2");

  await deployer.storeCode("contract2");
  await deployer.instantiate("contract2", { addr_for_contract1: contract1Info.address });
  //Now we can execute "contract2":
  await executor.execute("contract2", { test_contract_call: { message: "Hello World" } });
});
```

It's possible add scripts as default deployment scripts for a specific contract by specifying it in the `terrarium.json` file.

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
      "src": "./contracts/example_contract/",
      "deploy_script": "./tasks/deploy_script_example.ts"
    }
  }
}
```
