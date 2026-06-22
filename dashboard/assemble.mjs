// Assembles the runnable dashboard prototype from DesignSync get_file exports.
// The big files (index.html, support.js, ds-bundle.js) are large and were
// persisted to tool-result JSON files; we read those and write them here so
// their contents never have to round-trip through the model context.
//
// Usage: node assemble.mjs <dcHtml.json> <support.json> <dsBundle.json>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const [, , dcPath, supPath, bundlePath] = process.argv;
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8")).content;
const out = (rel, content) => {
  const f = path.join(dir, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  return content.length;
};

// index.html = the design-canvas HTML, with the deep _ds bundle path flattened
// to a local ./ds-bundle.js. support.js self-boots React and renders the
// <x-dc> template + the data-dc-script Component (the dashboard logic).
let dc = read(dcPath);
dc = dc.replace(
  "_ds/lockstep-design-system-e35539b8-9fcc-4b48-8dc4-699e6afb024a/_ds_bundle.js",
  "ds-bundle.js",
);

const a = out("index.html", dc);
const b = out("support.js", read(supPath));
const c = out("ds-bundle.js", read(bundlePath));
console.log(`index.html ${a}B · support.js ${b}B · ds-bundle.js ${c}B`);
