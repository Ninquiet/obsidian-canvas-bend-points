import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import builtins from "builtin-modules";

const production = process.argv[2] === "production";
const projectDirectory = dirname(fileURLToPath(import.meta.url));
const context = await esbuild.context({
  absWorkingDir: projectDirectory,
  entryPoints: [join(projectDirectory, "src", "main.ts")],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands", "@codemirror/language", "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view", "@lezer/common", "@lezer/highlight", "@lezer/lr", ...builtins, ...builtinModules],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: join(projectDirectory, "main.js")
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
