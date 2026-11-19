"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDK_SPEC = exports.SDK_PACKAGE = void 0;
exports.sdkInstallCommand = sdkInstallCommand;
exports.install = install;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const sdk_pin_1 = require("./sdk-pin");
const skill_files_1 = require("./skill-files");
exports.SDK_PACKAGE = "@gelatinbookings/partner-sdk";
exports.SDK_SPEC = `github:gelatinbookings/gelatin-partner-sdk#${sdk_pin_1.SDK_RELEASE}`;
function sdkInstallCommand(dir) {
    if ((0, node_fs_1.existsSync)(node_path_1.default.join(dir, "pnpm-lock.yaml")))
        return { command: "pnpm", args: ["add", exports.SDK_SPEC] };
    if ((0, node_fs_1.existsSync)(node_path_1.default.join(dir, "yarn.lock")))
        return { command: "yarn", args: ["add", exports.SDK_SPEC] };
    if ((0, node_fs_1.existsSync)(node_path_1.default.join(dir, "bun.lock")) || (0, node_fs_1.existsSync)(node_path_1.default.join(dir, "bun.lockb")))
        return { command: "bun", args: ["add", exports.SDK_SPEC] };
    return { command: "npm", args: ["install", exports.SDK_SPEC] };
}
function sdkAlreadyPinned(dir) {
    try {
        const pkg = JSON.parse((0, node_fs_1.readFileSync)(node_path_1.default.join(dir, "package.json"), "utf8"));
        return [pkg.dependencies, pkg.devDependencies].some((deps) => deps?.[exports.SDK_PACKAGE] === exports.SDK_SPEC);
    }
    catch {
        return false;
    }
}
function writeSkillFile(dir, file) {
    const target = node_path_1.default.resolve(dir, file.path);
    if (!target.startsWith(node_path_1.default.resolve(dir) + node_path_1.default.sep))
        throw new Error(`${file.path} would be written outside the project`);
    let existing = null;
    try {
        existing = (0, node_fs_1.readFileSync)(target, "utf8");
    }
    catch {
        existing = null;
    }
    if (existing === file.content)
        return { path: file.path, status: "unchanged" };
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(target), { recursive: true });
    (0, node_fs_1.writeFileSync)(target, file.content);
    return { path: file.path, status: existing === null ? "created" : "updated" };
}
function install(input) {
    const dir = node_path_1.default.resolve(input.dir);
    let isDir = false;
    try {
        isDir = (0, node_fs_1.statSync)(dir).isDirectory();
    }
    catch {
        isDir = false;
    }
    if (!isDir)
        throw new Error(`${dir} isn't a folder. Run install from your project's folder, or pass --dir.`);
    const files = (input.files ?? (0, skill_files_1.skillFiles)()).map((file) => writeSkillFile(dir, file));
    let sdk;
    if (input.skipSdk)
        sdk = { status: "skipped", reason: "asked" };
    else if (!(0, node_fs_1.existsSync)(node_path_1.default.join(dir, "package.json")))
        sdk = { status: "skipped", reason: "no_package_json" };
    else if (sdkAlreadyPinned(dir))
        sdk = { status: "skipped", reason: "already_installed" };
    else {
        const { command, args } = sdkInstallCommand(dir);
        const line = `${command} ${args.join(" ")}`;
        const ran = input.runner(command, args, dir);
        sdk = ran.ok ? { status: "installed", command: line } : { status: "failed", command: line, message: ran.message };
    }
    return { dir, files, sdk };
}
