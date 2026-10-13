#!/usr/bin/env node
// The package's command line: `npx @pixodesk/svg-animator-web <command>` — the commands live in commands.mjs.
import { main } from './commands.mjs';

process.exitCode = main(process.argv.slice(2), { cwd: process.cwd(), out: (line) => console.log(line), err: (line) => console.error(line) });
