"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.envFileFor = envFileFor;
exports.readEnvValue = readEnvValue;
exports.setEnvValues = setEnvValues;
exports.gitignoreCovers = gitignoreCovers;
exports.init = init;
exports.keys = keys;
exports.sites = sites;
exports.usage = usage;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const auth_1 = require("./auth");
const LOGIN_FIRST = "Not signed in. Run `npx github:gelatinbookings/cli login` first.";
const ENDED = "The sign-in on this computer has ended: it expired or was signed out. Run `npx github:gelatinbookings/cli login` to sign in again.";
const DEFAULT_SITE = "http://localhost:3000";
class Stop extends Error {
    code;
    constructor(message, code = 1) {
        super(message);
        this.code = code;
    }
}
async function api(deps, method, route, body) {
    const auth = (0, auth_1.readAuth)(deps.configDir);
    if (!auth)
        throw new Stop(LOGIN_FIRST);
    let res;
    try {
        res = await deps.fetch(`${auth.apiUrl}${route}`, {
            method,
            headers: { accept: "application/json", authorization: `Bearer ${auth.token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    }
    catch (error) {
        throw new Stop(`Couldn't reach Gelatin: ${error.message}`);
    }
    const data = (await res.json().catch(() => ({})));
    if (res.status === 401)
        throw new Stop(ENDED);
    if (!res.ok) {
        const said = typeof data.error_description === "string" ? data.error_description : `Gelatin couldn't answer (HTTP ${res.status}). Try again in a minute.`;
        throw new Stop(said);
    }
    return data;
}
function envFileFor(dir) {
    for (const name of [".env.local", ".env"])
        if ((0, node_fs_1.existsSync)(node_path_1.default.join(dir, name)))
            return name;
    return ".env.local";
}
const line = (key) => new RegExp(`^(?:export\\s+)?${key}\\s*=`);
function readEnvValue(content, key) {
    for (const row of content.split(/\r?\n/)) {
        if (line(key).test(row))
            return row.slice(row.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    }
    return null;
}
function setEnvValues(content, values) {
    const rows = content.length ? content.replace(/\r?\n$/, "").split(/\r?\n/) : [];
    const missing = new Set(Object.keys(values));
    const next = rows.map((row) => {
        for (const key of Object.keys(values)) {
            if (line(key).test(row)) {
                missing.delete(key);
                return `${key}=${values[key]}`;
            }
        }
        return row;
    });
    if (missing.size) {
        if (next.length && next[next.length - 1] !== "")
            next.push("");
        next.push("# Gelatin test app (npx github:gelatinbookings/cli init)");
        for (const key of missing)
            next.push(`${key}=${values[key]}`);
    }
    return `${next.join("\n")}\n`;
}
function gitignoreCovers(content, file) {
    const patterns = content.split(/\r?\n/).map((row) => row.trim()).filter((row) => row && !row.startsWith("#") && !row.startsWith("!"));
    const escape = (value) => value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    return patterns.some((raw) => {
        const pattern = raw.replace(/^\//, "").replace(/\/$/, "");
        if (pattern.includes("/"))
            return false;
        return new RegExp(`^${escape(pattern).replace(/\*/g, ".*").replace(/\?/g, ".")}$`).test(file);
    });
}
function ensureIgnored(dir, file) {
    const ignore = node_path_1.default.join(dir, ".gitignore");
    const content = (0, node_fs_1.existsSync)(ignore) ? (0, node_fs_1.readFileSync)(ignore, "utf8") : "";
    if (gitignoreCovers(content, file))
        return false;
    const prefix = content.length && !content.endsWith("\n") ? "\n" : "";
    (0, node_fs_1.writeFileSync)(ignore, `${content}${prefix}${file}\n`);
    return true;
}
function projectApp(dir) {
    const file = node_path_1.default.join(dir, envFileFor(dir));
    if (!(0, node_fs_1.existsSync)(file))
        return null;
    const base = readEnvValue((0, node_fs_1.readFileSync)(file, "utf8"), "GELATIN_API_BASE");
    return base?.match(/\/v1\/partners\/([a-z0-9-]+)$/)?.[1] ?? null;
}
function defaultName(dir) {
    try {
        const pkg = JSON.parse((0, node_fs_1.readFileSync)(node_path_1.default.join(dir, "package.json"), "utf8"));
        if (typeof pkg.name === "string" && pkg.name.trim())
            return pkg.name.replace(/^@[^/]+\//, "");
    }
    catch {
    }
    return node_path_1.default.basename(node_path_1.default.resolve(dir));
}
function parseFlags(args, allowed) {
    const flags = {};
    const positional = [];
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (!arg.startsWith("--")) {
            positional.push(arg);
            continue;
        }
        const name = arg.slice(2);
        if (!allowed.includes(name))
            throw new Stop(`Unknown option: ${arg}`);
        const value = args[i + 1];
        if (value === undefined || value.startsWith("--"))
            throw new Stop(`${arg} needs a value.`);
        flags[name] = value;
        i += 1;
    }
    return { flags, positional };
}
async function whichApp(deps, dir, flags) {
    if (typeof flags.app === "string")
        return flags.app;
    const fromEnv = projectApp(dir);
    if (fromEnv)
        return fromEnv;
    const { apps } = await api(deps, "GET", "/api/cli/apps");
    if (apps.length === 1)
        return apps[0].slug;
    if (apps.length === 0)
        throw new Stop("No Gelatin app on this account yet. Run `npx github:gelatinbookings/cli init`.");
    throw new Stop(`This account has ${apps.length} apps (${apps.map((a) => a.slug).join(", ")}). Name one with --app <slug>.`);
}
function day(iso) {
    if (!iso)
        return "never";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
async function guarded(screen, work) {
    try {
        return await work();
    }
    catch (error) {
        if (error instanceof Stop) {
            screen.error(error.message);
            return error.code;
        }
        throw error;
    }
}
function init(args, screen, deps, cwd) {
    return guarded(screen, async () => {
        const { flags } = parseFlags(args, ["name", "slug", "site", "dir"]);
        const dir = typeof flags.dir === "string" ? flags.dir : cwd;
        if (!(0, auth_1.readAuth)(deps.configDir))
            throw new Stop(LOGIN_FIRST);
        const envFile = envFileFor(dir);
        const envPath = node_path_1.default.join(dir, envFile);
        const existing = (0, node_fs_1.existsSync)(envPath) ? (0, node_fs_1.readFileSync)(envPath, "utf8") : "";
        if (readEnvValue(existing, "GELATIN_API_KEY")) {
            screen.write(`This project already has a Gelatin test key in ${envFile}.`);
            screen.write("To replace it, run `npx github:gelatinbookings/cli keys roll`. To see your apps, run `npx github:gelatinbookings/cli keys`.");
            return 0;
        }
        const name = typeof flags.name === "string" ? flags.name : defaultName(dir);
        const created = await api(deps, "POST", "/api/cli/apps", {
            name,
            ...(typeof flags.slug === "string" ? { slug: flags.slug } : {}),
        });
        (0, node_fs_1.writeFileSync)(envPath, setEnvValues(existing, { GELATIN_API_BASE: created.app.api_base, GELATIN_API_KEY: created.key.token }), { mode: 0o600 });
        const ignored = ensureIgnored(dir, envFile);
        screen.write(`Created ${created.app.name} (${created.app.slug}) on Gelatin, with a test key.`);
        screen.write(`Wrote GELATIN_API_BASE and GELATIN_API_KEY to ${envFile}${ignored ? `, and added ${envFile} to .gitignore` : ""}.`);
        const site = typeof flags.site === "string" ? flags.site : DEFAULT_SITE;
        try {
            await api(deps, "POST", `/api/cli/apps/${created.app.slug}/sites`, { origin: site });
            screen.write(`Test bookings can send people back to ${site}. Add another site with \`npx github:gelatinbookings/cli sites add <address>\`.`);
        }
        catch (error) {
            screen.error(`The app is ready, but ${site} wasn't added as a site: ${error.message}`);
        }
        screen.write("");
        screen.write("Test keys work against Gelatin's test server, with fake money.");
        screen.write('Next: ask your coding agent, for example "Add DJ booking to the event page."');
        return 0;
    });
}
function keys(args, screen, deps, cwd) {
    return guarded(screen, async () => {
        const { flags, positional } = parseFlags(args, ["app", "dir"]);
        const dir = typeof flags.dir === "string" ? flags.dir : cwd;
        const slug = await whichApp(deps, dir, flags);
        const { keys: list } = await api(deps, "GET", `/api/cli/apps/${slug}/keys`);
        if (positional[0] === "roll") {
            const envFile = envFileFor(dir);
            const envPath = node_path_1.default.join(dir, envFile);
            const content = (0, node_fs_1.existsSync)(envPath) ? (0, node_fs_1.readFileSync)(envPath, "utf8") : "";
            const current = readEnvValue(content, "GELATIN_API_KEY");
            const wanted = positional[1];
            const target = wanted
                ? list.find((k) => k.id === wanted || k.keySuffix === wanted)
                : list.find((k) => k.status === "active" && current?.endsWith(k.keySuffix));
            if (!target) {
                throw new Stop(wanted ? `No key ${wanted} on ${slug}. Run \`npx github:gelatinbookings/cli keys\` to see them.` : `This project's key isn't one of ${slug}'s. Name the key to roll: \`npx github:gelatinbookings/cli keys roll <last six characters>\`.`);
            }
            const { key } = await api(deps, "POST", `/api/cli/apps/${slug}/keys`, { action: "roll", key_id: target.id });
            (0, node_fs_1.writeFileSync)(envPath, setEnvValues(content, { GELATIN_API_KEY: key.token }), { mode: 0o600 });
            ensureIgnored(dir, envFile);
            screen.write(`Rolled the key ending ${target.keySuffix}. The new key, ending ${key.suffix}, is in ${envFile}.`);
            screen.write("The old key keeps working for 24 hours, so anything still using it has time to switch.");
            return 0;
        }
        if (positional.length)
            throw new Stop(`Unknown keys command: ${positional[0]}. Use \`keys\` or \`keys roll\`.`);
        screen.write(`Test keys for ${slug}:`);
        if (!list.length)
            screen.write("  None yet.");
        for (const key of list) {
            screen.write(`  …${key.keySuffix}  ${key.status.padEnd(7)}  ${key.label}  (created ${day(key.createdAt)}, last used ${day(key.lastUsedAt)})`);
        }
        screen.write("");
        screen.write("Roll this project's key with `npx github:gelatinbookings/cli keys roll`. Live keys are approved by Gelatin and shown once in your dashboard, never here.");
        return 0;
    });
}
function sites(args, screen, deps, cwd) {
    return guarded(screen, async () => {
        const { flags, positional } = parseFlags(args, ["app", "dir"]);
        const dir = typeof flags.dir === "string" ? flags.dir : cwd;
        const slug = await whichApp(deps, dir, flags);
        const [verb, value] = positional;
        if (verb === "add" || verb === "remove") {
            if (!value)
                throw new Stop(`Name the site: \`npx github:gelatinbookings/cli sites ${verb} https://book.example.com\`.`);
            if (verb === "add") {
                const { site } = await api(deps, "POST", `/api/cli/apps/${slug}/sites`, { origin: value });
                screen.write(`${site.origin} is a site for ${slug}.`);
                return 0;
            }
            const { sites: list } = await api(deps, "GET", `/api/cli/apps/${slug}/sites`);
            const site = list.find((s) => s.origin === value.replace(/\/$/, "").toLowerCase());
            if (!site)
                throw new Stop(`${value} isn't one of ${slug}'s sites.`);
            await api(deps, "PATCH", `/api/cli/apps/${slug}/sites`, { site_id: site.id, active: false });
            screen.write(`${site.origin} is switched off for ${slug}. Add it again any time.`);
            return 0;
        }
        if (verb)
            throw new Stop(`Unknown sites command: ${verb}. Use \`sites\`, \`sites add\` or \`sites remove\`.`);
        const { sites: list } = await api(deps, "GET", `/api/cli/apps/${slug}/sites`);
        screen.write(`Sites ${slug} can send people back to:`);
        if (!list.length)
            screen.write("  None yet.");
        for (const site of list)
            screen.write(`  ${site.origin}${site.active ? "" : "  (off)"}`);
        return 0;
    });
}
function usage(screen) {
    screen.write("Usage numbers are coming to the command line soon.");
    screen.write("Test keys run on Gelatin's test server and are never billed.");
    return 0;
}
