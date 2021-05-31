#!/usr/bin/env node

import yargs from "yargs/yargs";

import collectFs from ".";

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
  });

const { source, target } = args.argv;

collectFs(source as string[], target);
