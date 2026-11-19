"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const apps_1 = require("./apps");
const auth_1 = require("./auth");
const install_1 = require("./install");
const sdk_pin_1 = require("./sdk-pin");
const test_answer_1 = require("./test-answer");
const ACCOUNT = ["login", "logout", "whoami"];
const APP = ["init", "keys", "sites"];
const HELP = `Gelatin for coding agents.

Usage: npx github:gelatinbookings/cli <command>

  install                   Add the Gelatin skill to this project for
                            Claude Code, Codex and Cursor, and install
                            the partner SDK.
  login                     Sign this computer in to your Gelatin
                            account in the browser.
  whoami                    Show the account this computer is signed
                            in as.
  logout                    Sign this computer out.
  init                      Create your Gelatin app and write a test
                            key into this project's env file.
  keys                      List the app's test keys.
  keys roll                 Replace this project's test key. The old
                            one works for 24 more hours.
  sites                     List, add or remove the sites a test
                            booking can send people back to.
  usage                     Your app's usage (coming soon).
  test answer <booking_id> <answer>
                            Make the test DJ on a booking accept,
                            pass, expire or counter --fee <dollars>.

Options for install:
  --dir <folder>    The project's folder. Defaults to the current one.
  --skip-sdk        Write the skill only. Leave the SDK alone.

Options for login:
  --device          Sign in with a code instead of opening a browser here,
                    for SSH sessions and containers.

Options for init:
  --name <name>     The app's name. Defaults to package.json's name.
  --slug <slug>     Its address in the API. Defaults to one made from the name.
  --site <address>  A site test bookings return to. Defaults to
                    http://localhost:3000.
  --dir <folder>    The project's folder. Defaults to the current one.

Options for keys and sites:
  --app <slug>      Which app, when the account has more than one.

  -h, --help        Show this.
  -v, --version     Show the version.

Docs: https://www.gelatinbookings.com/docs`;
function summary(result) {
    const changed = result.files.filter((f) => f.status !== "unchanged");
    const lines = [];
    if (changed.length === 0) {
        lines.push("The Gelatin skill is already up to date:");
    }
    else {
        const created = changed.filter((f) => f.status === "created").length;
        const updated = changed.length - created;
        lines.push(`The Gelatin skill is ${created > 0 && updated === 0 ? "added" : "updated"} (${result.files.length} files):`);
    }
    lines.push("  .claude/skills/gelatin/    Claude Code", "  .codex/skills/gelatin/     Codex", "  .cursor/rules/gelatin.mdc  Cursor");
    if (result.sdk.status === "installed")
        lines.push("", `Partner SDK ${sdk_pin_1.SDK_RELEASE} installed (${result.sdk.command}).`);
    else if (result.sdk.status === "skipped" && result.sdk.reason === "already_installed")
        lines.push("", `Partner SDK ${sdk_pin_1.SDK_RELEASE} is already installed.`);
    else if (result.sdk.status === "skipped" && result.sdk.reason === "no_package_json") {
        lines.push("", `No package.json here, so the partner SDK (${sdk_pin_1.SDK_RELEASE}) was not installed. The skill tells your agent how to install it where it is needed.`);
    }
    else if (result.sdk.status === "skipped")
        lines.push("", "The partner SDK was left alone, as asked.");
    lines.push("", "Next: `npx github:gelatinbookings/cli login`, then `npx github:gelatinbookings/cli init` to create your app and write a test key into this project's env file.", 'Then ask your coding agent, for example "Add DJ booking to the event page."');
    return lines;
}
async function run(argv, io) {
    const [command, ...rest] = argv;
    if (!command || command === "-h" || command === "--help" || command === "help") {
        io.write(HELP);
        return 0;
    }
    if (command === "-v" || command === "--version") {
        io.write(io.version ?? "0.0.0");
        return 0;
    }
    if (command === "usage")
        return (0, apps_1.usage)(io);
    if (command === "test") {
        if (!io.auth) {
            io.error("`test` can't run here.");
            return 1;
        }
        return (0, test_answer_1.testCommand)(rest, io, io.auth, io.cwd ?? process.cwd());
    }
    if (APP.includes(command)) {
        if (!io.auth) {
            io.error(`\`${command}\` can't run here.`);
            return 1;
        }
        const cwd = io.cwd ?? process.cwd();
        if (command === "init")
            return (0, apps_1.init)(rest, io, io.auth, cwd);
        if (command === "keys")
            return (0, apps_1.keys)(rest, io, io.auth, cwd);
        return (0, apps_1.sites)(rest, io, io.auth, cwd);
    }
    if (ACCOUNT.includes(command)) {
        if (!io.auth) {
            io.error(`\`${command}\` can't run here.`);
            return 1;
        }
        if (command === "login")
            return (0, auth_1.login)(rest, io, io.auth);
        if (command === "whoami")
            return (0, auth_1.whoami)(io, io.auth);
        return (0, auth_1.logout)(io, io.auth);
    }
    if (command !== "install") {
        io.error(`Unknown command: ${command}`);
        io.error("Run `npx github:gelatinbookings/cli --help` to see what there is.");
        return 1;
    }
    let dir = io.cwd ?? process.cwd();
    let skipSdk = false;
    for (let i = 0; i < rest.length; i += 1) {
        const arg = rest[i];
        if (arg === "--skip-sdk")
            skipSdk = true;
        else if (arg === "--dir") {
            const value = rest[i + 1];
            if (!value) {
                io.error("--dir needs a folder.");
                return 1;
            }
            dir = value;
            i += 1;
        }
        else if (arg === "-h" || arg === "--help") {
            io.write(HELP);
            return 0;
        }
        else {
            io.error(`Unknown option for install: ${arg}`);
            return 1;
        }
    }
    let result;
    try {
        if (!io.runner)
            throw new Error("`install` can't run here.");
        result = (0, install_1.install)({ dir, runner: io.runner, skipSdk });
    }
    catch (error) {
        io.error(error.message);
        return 1;
    }
    for (const line of summary(result))
        io.write(line);
    if (result.sdk.status === "failed") {
        io.error("");
        io.error(`The skill is in place, but the partner SDK could not be installed: ${result.sdk.message}`);
        io.error(`Run it yourself when you can: ${result.sdk.command}`);
        return 1;
    }
    return 0;
}
