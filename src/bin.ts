#!/usr/bin/env node

import yargs from "yargs/yargs";

import collectFs, { mergeDirectories } from ".";

const args = yargs(process.argv)
  .option("source", {
    array: true,
    demand: true,
    desc: "Space-separated list of directories to merge",
    alias: "s",
  })
  .option("target", {
    string: true,
    demand: true,
    desc: "Target directory",
    alias: "t",
  })
  .option("watch", {
    boolean: true,
    default: false,
    alias: "w",
  });

const { source, target, watch } = args.argv;

if (watch) {
  collectFs(source as string[], target);
} else {
  mergeDirectories(source as string[], target).then(() => {
    return process.exit(0);
  });
}
