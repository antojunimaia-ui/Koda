import chalk from "chalk";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

let currentLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

export const logger = {
  debug(...args: unknown[]) {
    if (currentLevel <= LogLevel.DEBUG) {
      console.log(chalk.dim("  [debug]"), ...args);
    }
  },

  info(...args: unknown[]) {
    if (currentLevel <= LogLevel.INFO) {
      console.log(chalk.blue("  ℹ"), ...args);
    }
  },

  success(...args: unknown[]) {
    if (currentLevel <= LogLevel.INFO) {
      console.log(chalk.green("  ✔"), ...args);
    }
  },

  warn(...args: unknown[]) {
    if (currentLevel <= LogLevel.WARN) {
      console.log(chalk.yellow("  ⚠"), ...args);
    }
  },

  error(...args: unknown[]) {
    if (currentLevel <= LogLevel.ERROR) {
      console.error(chalk.red("  ✖"), ...args);
    }
  },

  tool(name: string, ...args: unknown[]) {
    if (currentLevel <= LogLevel.INFO) {
      console.log(chalk.magenta(`  ⚡ [${name}]`), ...args);
    }
  },
};
