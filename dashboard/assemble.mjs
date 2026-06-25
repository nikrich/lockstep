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
import crypto from "node:crypto";

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
// Cache-bust local scripts by content hash so dashboard updates aren't served
// stale — critical: support.js pins which React/icon URLs the page loads, so a
// stale cached copy keeps pulling them from unpkg (the slow-load bug).
const ver = (file) =>
  "?v=" +
  crypto.createHash("md5").update(fs.readFileSync(path.join(dir, file))).digest("hex").slice(0, 8);

const patches = [
  // load api.js (content-hashed) before the runtime boots, and version support.js
  [
    '<script src="./support.js"></script>',
    `<script src="api.js${ver("api.js")}"></script>\n<script src="./support.js${ver("support.js")}"></script>`,
  ],
  // version the design-system bundle + icon lib as well
  ['<script src="ds-bundle.js"></script>', `<script src="ds-bundle.js${ver("ds-bundle.js")}"></script>`],
  ['<script src="./lucide.min.js"></script>', `<script src="./lucide.min.js${ver("lucide.min.js")}"></script>`],
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
  // (token creation is wired directly in the token dialog / commitToken)
  // onboarding: offer the prebuilt Unreal plugin download in the repo setup card
  [
    `codeBlock('Install + commit', 'git lfs install\\ngit add .lfsconfig && git commit -m "Use Lockstep for LFS"')),`,
    `codeBlock('Install + commit', 'git lfs install\\ngit add .lfsconfig && git commit -m "Use Lockstep for LFS"'),
        h(Button, { variant: 'secondary', size: 'sm', iconLeft: h(Icon, { n: 'download', s: 14 }), style: { marginTop: 12 }, onClick: () => window.open('https://github.com/nikrich/lockstep/releases/tag/ue-plugin-v0.2.0', '_blank') }, 'Download Unreal plugin'),
        h(Button, { variant: 'ghost', size: 'sm', iconLeft: h(Icon, { n: 'book-open', s: 14 }), style: { marginTop: 8 }, onClick: () => window.open('https://lockstepcloud.com/docs', '_blank') }, 'Full setup guide')),`,
  ],
  // point the Docs & support "Documentation" link at the hosted setup guide
  [
    "window.open('https://github.com/nikrich/lockstep#readme', '_blank')",
    "window.open('https://lockstepcloud.com/docs', '_blank')",
  ],
];
for (const [find, repl] of patches) {
  if (!dc.includes(find)) throw new Error("patch anchor not found: " + find.slice(0, 64));
  dc = dc.split(find).join(repl); // replace all occurrences (anchors are unique except shared URLs)
}

const n = write("index.html", dc);
console.log(`index.html ${n}B · patches applied: ${patches.length}`);
