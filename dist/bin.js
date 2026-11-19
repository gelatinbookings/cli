#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const auth_1 = require("./auth");
const cli_1 = require("./cli");
function version() {
    try {
        return JSON.parse((0, node_fs_1.readFileSync)(node_path_1.default.resolve(__dirname, "..", "package.json"), "utf8")).version ?? "0.0.0";
    }
    catch {
        return "0.0.0";
    }
}
function canOpenBrowser() {
    const env = process.env;
    if (env.SSH_CONNECTION || env.SSH_TTY || env.CI)
        return false;
    if (process.platform === "linux" && !env.DISPLAY && !env.WAYLAND_DISPLAY)
        return false;
    return true;
}
function openBrowser(url) {
    try {
        const child = process.platform === "darwin"
            ? (0, node_child_process_1.spawn)("open", [url], { stdio: "ignore", detached: true })
            : process.platform === "win32"
                ? (0, node_child_process_1.spawn)("cmd", ["/c", "start", '""', url.replace(/&/g, "^&")], { stdio: "ignore", detached: true, windowsVerbatimArguments: true })
                : (0, node_child_process_1.spawn)("xdg-open", [url], { stdio: "ignore", detached: true });
        child.on("error", () => { });
        child.unref();
        return true;
    }
    catch {
        return false;
    }
}
(0, cli_1.run)(process.argv.slice(2), {
    write: (line) => process.stdout.write(`${line}\n`),
    error: (line) => process.stderr.write(`${line}\n`),
    version: version(),
    runner: (command, args, cwd) => {
        const out = (0, node_child_process_1.spawnSync)(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
        if (out.error)
            return { ok: false, message: out.error.message };
        return out.status === 0 ? { ok: true } : { ok: false, message: `${command} exited with code ${out.status ?? "unknown"}` };
    },
    auth: {
        fetch: globalThis.fetch,
        env: process.env,
        configDir: (0, auth_1.configDirFor)({ platform: process.platform, env: process.env, home: node_os_1.default.homedir() }),
        hostname: node_os_1.default.hostname(),
        openBrowser,
        canOpenBrowser: canOpenBrowser(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    },
}).then((code) => {
    process.exitCode = code;
}, (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
