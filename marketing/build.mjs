// Builds a static, dependency-light marketing page from the Claude Design
// "design canvas" export (source.dc.html). The canvas renders via React at
// runtime and hides its own markup — bad for a marketing site's SEO/first
// paint — so we flatten it to real static HTML and reimplement the one
// interactive piece (the cost calculator) + the FAQ accordion in vanilla JS.
//
// Usage:
//   node build.mjs                  # transforms ./source.dc.html -> ./index.html
//   node build.mjs <export.json>    # first extracts source.dc.html from a
//                                   # DesignSync get_file JSON, then builds
import fs from "node:fs";

const here = new URL("./", import.meta.url);
const srcPath = new URL("./source.dc.html", here);

// Optional: extract source.dc.html from a DesignSync get_file JSON export.
const jsonArg = process.argv[2];
if (jsonArg) {
  const obj = JSON.parse(fs.readFileSync(jsonArg, "utf8"));
  fs.writeFileSync(srcPath, obj.content);
  console.log("extracted source.dc.html:", obj.content.length, "bytes");
}

let src = fs.readFileSync(srcPath, "utf8");

// 1. <helmet> inner = fonts, lucide, base <style>. Goes into <head>.
const helmet = (src.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ""])[1].trim();

// 2. body = everything inside <x-dc>, minus the helmet block.
let body = (src.match(/<x-dc>([\s\S]*?)<\/x-dc>/) || [, ""])[1];
body = body.replace(/<helmet>[\s\S]*?<\/helmet>/, "").trim();

// 3. Sliders: bind to vanilla handlers.
body = body.replace(
  'value="{{ repoGB }}" onInput="{{ setRepo }}"',
  'id="ls-repo" value="100" oninput="LS.set(\'repoGB\', +this.value)"',
);
body = body.replace(
  'value="{{ devs }}" onInput="{{ setDevs }}"',
  'id="ls-devs" value="8" oninput="LS.set(\'devs\', +this.value)"',
);

// 4. The Lockstep cost bar width lives in a style attr — give it an id.
body = body.replace(
  '<div style="height:100%; width:{{ lockPct }}; min-width:5px;',
  '<div id="ls-lockbar" style="height:100%; width:25%; min-width:5px;',
);

// 5. Provider picker (<sc-for>) -> three concrete buttons.
const provBtns = [
  ["r2", "R2", true],
  ["b2", "B2", false],
  ["wasabi", "Wasabi", false],
]
  .map(
    ([id, label, on]) =>
      `<button id="ls-prov-${id}" onclick="LS.setProvider('${id}')" style="flex:1; padding:9px 8px; border-radius:6px; border:none; cursor:pointer; font:600 13px/1 'Spline Sans Mono',monospace; transition:all 140ms cubic-bezier(0.22,1,0.36,1); ${on ? "background:#ffb224; color:#1a1206;" : "background:transparent; color:#9aa7b6;"}">${label}</button>`,
  )
  .join("\n                ");
body = body.replace(/<sc-for list="\{\{ provs \}\}"[\s\S]*?<\/sc-for>/, provBtns);

// 6. FAQ (<sc-for>) -> concrete accordion items.
const faqData = [
  [`Does it work with normal git?`, `Yes — it is git. Lockstep is built on git plus the Git LFS protocol, so every git client and CI you already use keeps working. Code and tiny pointer files live in git; only the large binary bytes are redirected to your bucket.`],
  [`What storage can I use?`, `Any S3-compatible object store: Cloudflare R2, Backblaze B2, Wasabi, MinIO, or AWS S3. You configure one bucket path; we never copy your data elsewhere. R2 and B2 are the cheapest because they charge little-to-nothing for egress.`],
  [`Is my data safe? Who holds my keys?`, `You do. Bucket credentials are encrypted at rest, and clients only ever receive short-lived presigned URLs (typically a 15-minute TTL). Blob bytes travel client to bucket directly and never pass through the coordination server.`],
  [`Can I migrate from Perforce or Git LFS?`, `Yes. From Git LFS it is largely a remote swap — point LFS at your bucket and pull. From Perforce, import your latest depot state into a git repo and bring history forward as needed; locks map cleanly onto the Lockstep lock table.`],
  [`What does fair-source mean?`, `The source is public and readable. It is free for individuals and studios under $1M/year in revenue. Each release is licensed under BSL 1.1 and automatically converts to Apache 2.0 four years after it ships — so you can never be locked out of the tool you depend on.`],
  [`Do you support Unreal and Unity?`, `Unreal is the first-class target, with a native plugin for in-editor checkout, submit and lock (coming soon). Unity support follows via a package. The desktop app and CLI work with any engine or asset workflow today.`],
];
const faqHtml = faqData
  .map(
    ([q, a], i) =>
      `<div style="border:1px solid #232c36; border-radius:12px; background:#11161d; overflow:hidden;">\n` +
      `            <button onclick="LS.faq(${i})" style="width:100%; display:flex; align-items:center; gap:14px; padding:18px 20px; background:transparent; border:none; cursor:pointer; text-align:left;">\n` +
      `              <span style="flex:1; font:600 16px/1.4 'Sora',sans-serif; color:#eef2f6;">${q}</span>\n` +
      `              <span id="ls-faqrot-${i}" style="display:inline-flex; transition:transform 180ms; color:#7d8b9c;"><i data-lucide="chevron-down" style="width:18px;height:18px;"></i></span>\n` +
      `            </button>\n` +
      `            <p id="ls-faqbody-${i}" style="margin:0; padding:0 20px 20px; font:400 14px/1.65 'Sora',sans-serif; color:#9aa7b6; display:none;">${a}</p>\n` +
      `          </div>`,
  )
  .join("\n          ");
body = body.replace(/<sc-for list="\{\{ faqs \}\}"[\s\S]*?<\/sc-for>/, faqHtml);

// 7. Remaining {{ text }} placeholders -> class-tagged spans (class so a
//    placeholder used in several spots all update together).
const defaults = {
  repoLabel: "100 GB", devsLabel: "8 devs",
  githubTotal: "$290", githubStorage: "$10", githubEgress: "$280",
  providerName: "Cloudflare R2", lockTotal: "$74", lockStorage: "$1.50",
  lockSeats: "$72", seatPrice: "9", multiple: "3.9×",
  annualSaving: "$2,598", studioPrice: "9",
};
for (const [k, v] of Object.entries(defaults)) {
  body = body.split(`{{ ${k} }}`).join(`<span class="ls-${k}">${v}</span>`);
}

// Sanity: nothing dynamic should remain.
const leftover = [...new Set((body.match(/\{\{[^}]*\}\}|<sc-[^>]*>/g) || []))];

// 8. Vanilla calculator + FAQ + lucide boot. Mirrors the design's exact formula.
const script = `<script>
(function () {
  var state = { repoGB: 100, devs: 8, provider: 'r2' };
  var rates = { r2: 0.015, b2: 0.006, wasabi: 0.0068 };
  var names = { r2: 'Cloudflare R2', b2: 'Backblaze B2', wasabi: 'Wasabi' };
  var SEAT = 9;
  function money(n) {
    if (n >= 1000) return '$' + Math.round(n).toLocaleString();
    if (n >= 100) return '$' + Math.round(n);
    if (n >= 10) return '$' + n.toFixed(0);
    return '$' + n.toFixed(2);
  }
  function setC(c, v) { document.querySelectorAll('.ls-' + c).forEach(function (e) { e.textContent = v; }); }
  function recalc() {
    var g = state, repoGB = g.repoGB, devs = g.devs, provider = g.provider;
    var gStore = Math.max(Math.ceil(repoGB / 50), 1) * 5;
    var gEgr = devs * repoGB * 0.35;
    var gTot = gStore + gEgr;
    var lSeats = devs * SEAT;
    var lStore = Math.max(repoGB * rates[provider], 0.5);
    var lTot = lSeats + lStore;
    var mult = gTot / lTot;
    var multFmt = (mult >= 10 ? Math.round(mult) : mult.toFixed(1)) + '×';
    var lockPct = Math.max(lTot / gTot * 100, 1.4).toFixed(1) + '%';
    var annual = Math.round((gTot - lTot) * 12);
    var repoLabel = repoGB >= 1000 ? ((repoGB / 1000) % 1 === 0 ? (repoGB / 1000) + ' TB' : (repoGB / 1000).toFixed(1) + ' TB') : repoGB + ' GB';
    setC('repoLabel', repoLabel);
    setC('devsLabel', devs + (devs === 1 ? ' dev' : ' devs'));
    setC('githubTotal', money(gTot));
    setC('githubStorage', money(gStore));
    setC('githubEgress', money(gEgr));
    setC('providerName', names[provider]);
    setC('lockTotal', money(lTot));
    setC('lockStorage', money(lStore));
    setC('lockSeats', money(lSeats));
    setC('seatPrice', SEAT);
    setC('multiple', multFmt);
    setC('annualSaving', '$' + annual.toLocaleString());
    var bar = document.getElementById('ls-lockbar');
    if (bar) bar.style.width = lockPct;
  }
  window.LS = {
    set: function (k, v) { state[k] = v; recalc(); },
    setProvider: function (p) {
      state.provider = p;
      ['r2', 'b2', 'wasabi'].forEach(function (id) {
        var b = document.getElementById('ls-prov-' + id);
        if (b) { var on = id === p; b.style.background = on ? '#ffb224' : 'transparent'; b.style.color = on ? '#1a1206' : '#9aa7b6'; }
      });
      recalc();
    },
    faq: function (i) {
      var b = document.getElementById('ls-faqbody-' + i), r = document.getElementById('ls-faqrot-' + i);
      if (!b) return;
      var open = b.style.display !== 'none';
      b.style.display = open ? 'none' : 'block';
      if (r) r.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  };
  function boot() { recalc(); if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } }); }
  if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
</script>`;

// 9. Assemble (concatenation, so nothing in body/helmet is re-parsed).
const desc =
  "Cloud source control for Unreal & Unity game teams. Keep code in git, stream big binary assets to a bucket you own, and lock files like Perforce — with zero egress. Typically 10–40× cheaper than hosted Git LFS.";
const head =
  '<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  "<title>Lockstep — Cloud source control for game teams</title>\n" +
  '<meta name="description" content="' + desc + '">\n' +
  '<meta property="og:title" content="Lockstep — Own your bytes. Pennies, not hundreds.">\n' +
  '<meta property="og:description" content="' + desc + '">\n' +
  '<meta property="og:type" content="website">\n' +
  '<meta name="theme-color" content="#0a0d11">\n' +
  helmet;

const out =
  "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n" +
  head +
  "\n</head>\n<body>\n" +
  body +
  "\n" +
  script +
  "\n</body>\n</html>\n";

fs.writeFileSync(new URL("./index.html", here), out);
console.log("index.html:", out.length, "bytes · leftover dynamic tokens:", leftover.length ? leftover.join(", ") : "none");
