"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configDirFor = configDirFor;
exports.apiBase = apiBase;
exports.readAuth = readAuth;
exports.login = login;
exports.whoami = whoami;
exports.logout = logout;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_http_1 = __importDefault(require("node:http"));
const node_path_1 = __importDefault(require("node:path"));
const DEFAULT_API = "https://www.gelatinbookings.com";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const LOGIN_AGAIN = "Run `npx github:gelatinbookings/cli login` to sign in again.";
function configDirFor(input) {
    if (input.env.GELATIN_CONFIG_DIR)
        return input.env.GELATIN_CONFIG_DIR;
    if (input.platform === "win32")
        return node_path_1.default.join(input.env.APPDATA || node_path_1.default.join(input.home, "AppData", "Roaming"), "gelatinbookings");
    return node_path_1.default.join(input.env.XDG_CONFIG_HOME || node_path_1.default.join(input.home, ".config"), "gelatinbookings");
}
function apiBase(env) {
    const raw = env.GELATIN_API_URL?.trim();
    if (!raw)
        return DEFAULT_API;
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local))
        throw new Error("GELATIN_API_URL must be https, or http on localhost.");
    return url.origin;
}
const authFile = (configDir) => node_path_1.default.join(configDir, "auth.json");
function readAuth(configDir) {
    try {
        const data = JSON.parse((0, node_fs_1.readFileSync)(authFile(configDir), "utf8"));
        if (typeof data.apiUrl !== "string" || typeof data.token !== "string" || !data.token.startsWith("gelcli_") || typeof data.email !== "string" || typeof data.expiresAt !== "string")
            return null;
        return { apiUrl: data.apiUrl, token: data.token, email: data.email, expiresAt: data.expiresAt };
    }
    catch {
        return null;
    }
}
function writeAuth(configDir, auth) {
    (0, node_fs_1.mkdirSync)(configDir, { recursive: true, mode: 0o700 });
    const file = authFile(configDir);
    (0, node_fs_1.writeFileSync)(file, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
    (0, node_fs_1.chmodSync)(file, 0o600);
}
function clearAuth(configDir) {
    if ((0, node_fs_1.existsSync)(authFile(configDir)))
        (0, node_fs_1.rmSync)(authFile(configDir), { force: true });
}
function day(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
async function postJson(deps, url, body, token) {
    const res = await deps.fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({})));
    return { status: res.status, data };
}
function asToken(data) {
    const account = data.account;
    if (typeof data.access_token !== "string" || typeof data.expires_at !== "string" || !account || typeof account.email !== "string")
        return null;
    return { access_token: data.access_token, expires_at: data.expires_at, account };
}
function saveAndSay(screen, deps, base, token) {
    writeAuth(deps.configDir, { apiUrl: base, token: token.access_token, email: token.account.email, expiresAt: token.expires_at });
    screen.write(`Signed in as ${token.account.email}.`);
    screen.write(`This sign-in lasts until ${day(token.expires_at)}. End it with \`npx github:gelatinbookings/cli logout\`, or from Settings on gelatinbookings.com.`);
    return 0;
}
const pkcePair = () => {
    const verifier = (0, node_crypto_1.randomBytes)(32).toString("base64url");
    return { verifier, challenge: (0, node_crypto_1.createHash)("sha256").update(verifier).digest("base64url") };
};
async function browserLogin(screen, deps, base) {
    const { verifier, challenge } = pkcePair();
    const state = (0, node_crypto_1.randomBytes)(24).toString("base64url");
    let settle = () => { };
    const outcome = new Promise((resolve) => (settle = resolve));
    let redirectUri = "";
    const server = node_http_1.default.createServer((req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        const done = (result, then) => {
            res.writeHead(302, { location: `${base}/cli/done?result=${result}`, "cache-control": "no-store", connection: "close" });
            res.end(() => settle(then));
        };
        if (req.method !== "GET" || url.pathname !== "/callback" || url.searchParams.get("state") !== state) {
            res.writeHead(404, { "content-type": "text/plain" });
            res.end("Not found.");
            return;
        }
        if (url.searchParams.get("error")) {
            done("refused", { kind: "refused" });
            return;
        }
        const code = url.searchParams.get("code");
        if (!code) {
            done("failed", { kind: "failed", message: "Gelatin sent no sign-in code back." });
            return;
        }
        postJson(deps, `${base}/api/cli/token`, { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri })
            .then(({ status, data }) => {
            const token = status === 200 ? asToken(data) : null;
            done(token ? "signed_in" : "failed", token ? { kind: "token", token } : { kind: "failed", message: typeof data.error_description === "string" ? data.error_description : "Gelatin refused the sign-in code." });
        })
            .catch((error) => {
            done("failed", { kind: "failed", message: `Couldn't reach Gelatin: ${error.message}` });
        });
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => resolve());
    });
    redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
    const timer = setTimeout(() => settle({ kind: "timeout" }), deps.timeoutMs ?? 5 * 60 * 1000);
    const page = new URL("/cli/login", base);
    page.search = new URLSearchParams({ code_challenge: challenge, code_challenge_method: "S256", redirect_uri: redirectUri, state, label: deps.hostname }).toString();
    const opened = deps.openBrowser(page.toString());
    screen.write(opened ? "Opening your browser to sign in to Gelatin." : "Open this address in your browser to sign in to Gelatin:");
    screen.write(opened ? `If it didn't open, go to:\n  ${page.toString()}` : `  ${page.toString()}`);
    screen.write("Waiting for you to allow the sign-in…");
    const result = await outcome;
    clearTimeout(timer);
    await new Promise((resolve) => server.close(() => resolve()));
    server.closeAllConnections?.();
    if (result.kind === "token")
        return saveAndSay(screen, deps, base, result.token);
    if (result.kind === "refused")
        screen.error("Sign-in cancelled in the browser. Nothing was saved.");
    else if (result.kind === "timeout")
        screen.error(`The sign-in took too long, so it stopped. ${LOGIN_AGAIN}`);
    else
        screen.error(`${result.message} ${LOGIN_AGAIN}`);
    return 1;
}
async function deviceLogin(screen, deps, base) {
    const started = await postJson(deps, `${base}/api/cli/device`, { label: deps.hostname });
    const { device_code: deviceCode, user_code: userCode, verification_uri: uri, verification_uri_complete: complete } = started.data;
    if (started.status !== 200 || !deviceCode || !userCode || !uri) {
        screen.error(`Gelatin couldn't start a sign-in (HTTP ${started.status}). Try again in a minute.`);
        return 1;
    }
    let interval = Number(started.data.interval) > 0 ? Number(started.data.interval) : 5;
    const deadline = Number(started.data.expires_in) > 0 ? Number(started.data.expires_in) : 600;
    screen.write(`To sign in, open ${uri} and type this code:`);
    screen.write("");
    screen.write(`    ${userCode}`);
    screen.write("");
    if (complete)
        screen.write(`Or open ${complete}`);
    screen.write("Waiting for you to allow the sign-in…");
    let waited = 0;
    while (waited < deadline) {
        await deps.sleep(interval * 1000);
        waited += interval;
        const { status, data } = await postJson(deps, `${base}/api/cli/token`, { grant_type: DEVICE_GRANT, device_code: deviceCode });
        const token = status === 200 ? asToken(data) : null;
        if (token)
            return saveAndSay(screen, deps, base, token);
        if (data.error === "authorization_pending")
            continue;
        if (data.error === "slow_down") {
            interval += 5;
            continue;
        }
        if (data.error === "access_denied") {
            screen.error("Sign-in cancelled in the browser. Nothing was saved.");
            return 1;
        }
        screen.error(`${data.error === "expired_token" ? "The code expired." : "The sign-in didn't finish."} ${LOGIN_AGAIN}`);
        return 1;
    }
    screen.error(`The code expired. ${LOGIN_AGAIN}`);
    return 1;
}
async function login(args, screen, deps) {
    for (const arg of args) {
        if (arg !== "--device") {
            screen.error(`Unknown option for login: ${arg}`);
            return 1;
        }
    }
    let base;
    try {
        base = apiBase(deps.env);
    }
    catch (error) {
        screen.error(error.message);
        return 1;
    }
    const device = args.includes("--device") || !deps.canOpenBrowser;
    if (!args.includes("--device") && !deps.canOpenBrowser)
        screen.write("No browser here, so signing in with a code instead.");
    try {
        return device ? await deviceLogin(screen, deps, base) : await browserLogin(screen, deps, base);
    }
    catch (error) {
        screen.error(`Couldn't reach Gelatin: ${error.message}`);
        return 1;
    }
}
async function whoami(screen, deps) {
    const auth = readAuth(deps.configDir);
    if (!auth) {
        screen.error("Not signed in. Run `npx github:gelatinbookings/cli login`.");
        return 1;
    }
    let res;
    try {
        res = await deps.fetch(`${auth.apiUrl}/api/cli/whoami`, { headers: { authorization: `Bearer ${auth.token}`, accept: "application/json" } });
    }
    catch (error) {
        screen.error(`Couldn't reach Gelatin: ${error.message}`);
        return 1;
    }
    if (res.status === 401) {
        clearAuth(deps.configDir);
        screen.error(`The sign-in on this computer has ended: it expired or was signed out. ${LOGIN_AGAIN}`);
        return 1;
    }
    const data = (await res.json().catch(() => ({})));
    if (!res.ok || !data.email) {
        screen.error(`Gelatin couldn't answer (HTTP ${res.status}). Try again in a minute.`);
        return 1;
    }
    screen.write(`Signed in as ${data.email}${data.display_name ? ` (${data.display_name})` : ""}.`);
    if (data.sign_in?.expires_at)
        screen.write(`This computer${data.sign_in.label ? `, ${data.sign_in.label},` : ""} stays signed in until ${day(data.sign_in.expires_at)}.`);
    return 0;
}
async function logout(screen, deps) {
    const auth = readAuth(deps.configDir);
    if (!auth) {
        clearAuth(deps.configDir);
        screen.write("Not signed in on this computer.");
        return 0;
    }
    let endedOnGelatin = false;
    try {
        const { status } = await postJson(deps, `${auth.apiUrl}/api/cli/logout`, {}, auth.token);
        endedOnGelatin = status === 200 || status === 401;
    }
    catch {
        endedOnGelatin = false;
    }
    clearAuth(deps.configDir);
    screen.write("Signed out of Gelatin on this computer.");
    if (!endedOnGelatin)
        screen.error("Gelatin couldn't be reached to end the sign-in there too. It ends on its own when it expires, or end it now from Settings on gelatinbookings.com.");
    return 0;
}
