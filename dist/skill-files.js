"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILL_DIR = void 0;
exports.skillSources = skillSources;
exports.skillFiles = skillFiles;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
exports.SKILL_DIR = node_path_1.default.resolve(__dirname, "..", "skill");
function skillSources(dir = exports.SKILL_DIR) {
    const references = (0, node_fs_1.readdirSync)(node_path_1.default.join(dir, "references"))
        .filter((name) => name.endsWith(".md"))
        .sort()
        .map((name) => ({ path: `references/${name}`, content: (0, node_fs_1.readFileSync)(node_path_1.default.join(dir, "references", name), "utf8") }));
    return [{ path: "SKILL.md", content: (0, node_fs_1.readFileSync)(node_path_1.default.join(dir, "SKILL.md"), "utf8") }, ...references];
}
function withoutFrontmatter(markdown) {
    return markdown.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}
function description(skill) {
    const match = /^---\n[\s\S]*?^description: (.+)$/m.exec(skill);
    if (!match?.[1])
        throw new Error("SKILL.md has no description");
    return match[1];
}
function skillFiles(sources = skillSources()) {
    const skill = sources.find((file) => file.path === "SKILL.md");
    if (!skill)
        throw new Error("No SKILL.md");
    const references = sources.filter((file) => file.path !== "SKILL.md");
    const rule = [
        "---",
        `description: ${description(skill.content)}`,
        "alwaysApply: false",
        "---",
        "",
        withoutFrontmatter(skill.content),
        ...references.map((file) => `\n\n<!-- ${file.path} -->\n\n${withoutFrontmatter(file.content)}`),
        "",
    ].join("\n");
    return [
        ...sources.map((file) => ({ path: `.claude/skills/gelatin/${file.path}`, content: file.content })),
        ...sources.map((file) => ({ path: `.codex/skills/gelatin/${file.path}`, content: file.content })),
        { path: ".cursor/rules/gelatin.mdc", content: rule },
    ];
}
