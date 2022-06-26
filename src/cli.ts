#!/usr/bin/env node

import { Config, loadConfig } from "./config.js";
import { error } from "./log.js";
import { cliOptions } from "./utils.js";

import { fork } from "child_process";
import * as fs from "fs";
import path from "path";
import task from "./task.js";
import { Client } from "./client.js";

let argv: any = await cliOptions
  .command("deploy <contract>", "Deploy a contract", (yargs) => {
    yargs.positional("contract", {
      describe: "Contract name",
      type: "string",
      required: true,
    });
  })
  .command("run <script>", "Run a script", (yargs) => {
    yargs.positional("script", {
      describe: "Path to script",
      type: "string",
      required: true,
    });
  })
  .demandCommand(1).argv;

if (argv._[0] === "deploy") {
  const config: Config = loadConfig(argv.config);

  if (!config.contracts[argv.contract]) {
    error(
      `Contract ${argv.contract} build information not found in config file.`,
      { exit: 1 }
    );
  }

  let buildInfo = config.contracts[argv.contract];

  if (buildInfo.deploy_script) {
    if (!fs.existsSync(path.join(process.cwd(), buildInfo.deploy_script))) {
      error(`Deploy script ${buildInfo.deploy_script} not found.`, { exit: 1 });
    }
    let child = fork(path.join(process.cwd(), buildInfo.deploy_script), {
      env: process.env,
      execArgv: buildInfo.deploy_script.endsWith(".js")
        ? []
        : ["--loader", "ts-node/esm"],
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        error(`Deploy script exited with code ${code}`, { exit: 1 });
      }
    });
  } else if (buildInfo.instantiate_msg) {
    task(async (client: Client) => {
      client.buildContract(argv.contract);
      client.optimizeContract(argv.contract);

      await client.storeCode(argv.contract);
      await client.instantiate(argv.contract, buildInfo.instantiate_msg);
    }).then(() => {
      process.exit(0);
    });
  } else {
    error(
      `Contract ${argv.contract} muyst have either a deploy script or instantiate message.`,
      { exit: 1 }
    );
  }
} else if (argv._[0] === "run") {
  if (!fs.existsSync(path.join(process.cwd(), argv.script))) {
    error(`Script ${argv.script} not found.`, { exit: 1 });
  }
  let child = fork(path.join(process.cwd(), argv.script), {
    env: process.env,
    execArgv: ["-r", "ts-node/register"],
  });
  child.on("exit", (code) => {
    if (code !== 0) {
      error(`Script exited with code ${code}`, { exit: 1 });
    }
  });
}
