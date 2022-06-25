import chalk from 'chalk';

export function info(message: string) {
  console.log(message);
}

export function error(message: string, options?: { exit?: number }): never {
  console.error(chalk.red(message));
  if (options && options.exit) {
    process.exit(options.exit);
  } else {
    process.exit(1);
  }
}

export function warn(message: string) {
  console.warn(chalk.yellow(message));
}

export function waitKey(message: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    info(message);
    process.stdin.once('data', (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}
