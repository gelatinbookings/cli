"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCommand = testCommand;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const apps_1 = require("./apps");
const ANSWERS = {
    accept: "accept", decline: "decline", pass: "decline", counter: "counter", expire: "expire",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USAGE = "Usage: npx github:gelatinbookings/cli test answer <booking_id> accept | pass | expire | counter --fee <dollars> [--note <text>]";
async function testCommand(args, screen, deps, cwd) {
    const [sub, ...rest] = args;
    if (sub !== "answer") {
        screen.error(USAGE);
        return 1;
    }
    let dir = cwd;
    let fee = null;
    let note = null;
    const positional = [];
    for (let i = 0; i < rest.length; i += 1) {
        const arg = rest[i];
        if (arg === "--fee" || arg === "--note" || arg === "--dir") {
            const value = rest[i + 1];
            if (value === undefined) {
                screen.error(`${arg} needs a value.`);
                return 1;
            }
            if (arg === "--fee")
                fee = value;
            else if (arg === "--note")
                note = value;
            else
                dir = value;
            i += 1;
        }
        else if (arg.startsWith("--")) {
            screen.error(`Unknown option: ${arg}`);
            return 1;
        }
        else
            positional.push(arg);
    }
    const [bookingId, word] = positional;
    const answer = word ? ANSWERS[word] : undefined;
    if (!bookingId || !UUID.test(bookingId) || !answer || positional.length > 2) {
        screen.error(USAGE);
        return 1;
    }
    const body = { answer };
    if (answer === "counter") {
        const cents = fee !== null && /^\d+(\.\d{1,2})?$/.test(fee) ? Math.round(Number(fee) * 100) : NaN;
        if (!Number.isInteger(cents) || cents < 100) {
            screen.error("A counter needs the DJ's new fee in dollars, at least 1: --fee 150");
            return 1;
        }
        body.fee_cents = cents;
        if (note)
            body.note = note;
    }
    const file = node_path_1.default.join(dir, (0, apps_1.envFileFor)(dir));
    const content = (0, node_fs_1.existsSync)(file) ? (0, node_fs_1.readFileSync)(file, "utf8") : "";
    const base = (0, apps_1.readEnvValue)(content, "GELATIN_API_BASE");
    const key = (0, apps_1.readEnvValue)(content, "GELATIN_API_KEY");
    if (!base || !key) {
        screen.error("This project has no Gelatin test key yet. Run `npx github:gelatinbookings/cli init` first.");
        return 1;
    }
    if (!key.startsWith("gel_test_")) {
        screen.error("`test answer` only works with a test key, and this project's key isn't one. Nothing was sent.");
        return 1;
    }
    let res;
    try {
        res = await deps.fetch(`${base}/test/bookings/${bookingId}/answer`, {
            method: "POST",
            headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${key}` },
            body: JSON.stringify(body),
        });
    }
    catch (error) {
        screen.error(`Couldn't reach Gelatin: ${error.message}`);
        return 1;
    }
    const data = (await res.json().catch(() => ({})));
    if (!res.ok) {
        screen.error(data.error?.message ?? `Gelatin couldn't answer (HTTP ${res.status}). Try again in a minute.`);
        return 1;
    }
    screen.write(said(answer, data));
    return 0;
}
function said(answer, data) {
    if (answer === "accept")
        return "The test DJ accepted. Stripe captures the test hold next, and the booking reads `confirmed` once it lands, usually within a minute.";
    if (answer === "decline")
        return "The test DJ passed. The booking is cancelled and the test hold is released.";
    if (answer === "expire")
        return "The offer expired, as if the DJ never answered. Any test hold is released.";
    const total = typeof data.total_cents === "number" ? ` The organizer's new total is $${(data.total_cents / 100).toFixed(2)}.` : "";
    return `The test DJ came back with a new price.${total} It's the organizer's turn: accept it, decline or counter in the portal.`;
}
