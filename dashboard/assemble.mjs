// Builds the runnable dashboard from the Claude Design export, then patches the
// prototype to talk to the real API (via api.js): load live data on mount and
// persist the connect-storage / create-repo / create-token mutations.
//
// First run (from a fresh DesignSync export):
//   node assemble.mjs <dcHtml.json> <support.json> <dsBundle.json>
// Re-run after editing patches (reuses source.dc.html on disk):
//   node assemble.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const [, , dcPath, supPath, bundlePath] = process.argv;
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8")).content;
const write = (rel, content) => {
  const f = path.join(dir, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  return content.length;
};
const srcFile = path.join(dir, "source.dc.html");

// On a fresh export, persist the raw sources; otherwise reuse what's on disk.
if (dcPath) fs.writeFileSync(srcFile, readJson(dcPath));
if (supPath) write("support.js", readJson(supPath));
if (bundlePath) write("ds-bundle.js", readJson(bundlePath));

let dc = fs.readFileSync(srcFile, "utf8");

// Flatten the deep _ds bundle path to the local file.
dc = dc.replace(
  "_ds/lockstep-design-system-e35539b8-9fcc-4b48-8dc4-699e6afb024a/_ds_bundle.js",
  "ds-bundle.js",
);

// Wiring patches. Each must hit exactly one known anchor in the design source;
// a missed anchor throws so we never ship a silently-unwired build.
const patches = [
  // load api.js before the runtime boots
  [
    '<script src="./support.js"></script>',
    '<script src="api.js"></script>\n<script src="./support.js"></script>',
  ],
  // once the design system is ready, replace mock orgs with live data
  [
    "if (ns && ns.Button && window.lucide) { this.D = ns; this.setState({ ready: true }); }",
    "if (ns && ns.Button && window.lucide) { this.D = ns; this.setState({ ready: true }); (function(self){var b=function(){if(window.LSAPI){window.LSAPI.bootstrap(self);}else{setTimeout(b,150);}};b();})(this); }",
  ],
  // (storage connect is wired directly inside saveStorage() in the source)
  // create repo -> POST /orgs/:id/repos
  [
    "this.flash('Repository ' + name.trim() + ' created', 'mine');",
    "this.flash('Repository ' + name.trim() + ' created', 'mine'); if (window.LSAPI) window.LSAPI.createRepo(this.state.orgId, name.trim()).catch(e => this.flash('Create failed: ' + e.message, 'conflict'));",
  ],
  // generate token -> POST /tokens
  [
    "this.flash('Token saved to ' + this.org().name, 'synced');",
    "this.flash('Token saved to ' + this.org().name, 'synced'); if (window.LSAPI) window.LSAPI.createToken(m.name.trim(), scopes).catch(e => this.flash('Token save failed: ' + e.message, 'conflict'));",
  ],
];
for (const [find, repl] of patches) {
  if (!dc.includes(find)) throw new Error("patch anchor not found: " + find.slice(0, 64));
  dc = dc.replace(find, repl);
}

const n = write("index.html", dc);
console.log(`index.html ${n}B · patches applied: ${patches.length}`);
