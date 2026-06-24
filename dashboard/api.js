// Lockstep dashboard ↔ API client. Auto-targets the local Worker when served
// from localhost (using the dev PAT seeded into the local D1), and the live API
// otherwise (cookie session, once OAuth is wired). No production secret is baked
// in — the dev token only works against the local seed database.
(function () {
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var API = isLocal ? "http://127.0.0.1:8787" : "https://api.lockstepcloud.com";
  // Locally we auto-auth with the seeded dev PAT for convenience. Visit
  // http://localhost:8788/?oauth to disable it and test the real OAuth flow
  // (clears with localStorage.removeItem('ls_oauth')).
  if (isLocal && location.search.indexOf("oauth") !== -1) localStorage.setItem("ls_oauth", "1");
  var forceOAuth = isLocal && localStorage.getItem("ls_oauth") === "1";
  var DEV_TOKEN = isLocal && !forceOAuth ? "lsk_dev_local_0001" : null;

  function headers(extra) {
    var h = extra || {};
    if (DEV_TOKEN) h["Authorization"] = "Bearer " + DEV_TOKEN;
    return h;
  }
  function req(method, path, body) {
    var opts = {
      method: method,
      headers: headers(body ? { "Content-Type": "application/json" } : {}),
      credentials: isLocal ? "omit" : "include",
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(API + path, opts).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + " " + t); });
      return r.status === 204 ? null : r.json();
    });
  }

  function timeAgo(unixSec) {
    if (!unixSec) return "never";
    var s = Math.max(1, Math.floor(Date.now() / 1000 - unixSec));
    if (s < 90) return "just now";
    var m = Math.floor(s / 60); if (m < 60) return m + "m ago";
    var hh = Math.floor(m / 60); if (hh < 24) return hh + "h ago";
    return Math.floor(hh / 24) + "d ago";
  }
  function dateFmt(unixSec) {
    try { return new Date((unixSec || 0) * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
    catch (e) { return "—"; }
  }
  var ROLE = { owner: "Owner", admin: "Admin", member: "Member" };

  function mapRepo(r) {
    return { name: r.slug, slug: r.slug, sizeGB: 0, blobs: 0, locks: 0, activity: timeAgo(r.created_at), branch: "main", lockList: [] };
  }
  function mapToken(t) {
    return {
      name: t.name,
      last4: (t.id || "").replace(/[^a-z0-9]/gi, "").slice(-4) || "0000",
      scopes: (t.scopes || "").split(",").filter(Boolean),
      created: dateFmt(t.created_at),
      used: t.last_used_at ? timeAgo(t.last_used_at) : "never",
    };
  }
  function mapStorage(s) {
    if (!s) return { connected: false, provider: "r2", endpoint: "", region: "auto", bucket: "", accessKeyId: "", secret: "", prefix: "", storedGB: 0, blobs: 0 };
    return { connected: true, provider: s.provider || "r2", endpoint: s.endpoint || "", region: s.region || "auto", bucket: s.bucket || "", accessKeyId: s.accessKeyId || "", secret: "••••••••", prefix: s.prefix || "", storedGB: 0, blobs: 0 };
  }
  function mapOrg(o, repos, tokens, storage, user) {
    return {
      id: o.id, name: o.name, slug: o.slug,
      role: ROLE[o.role] || "Member",
      plan: o.plan === "free" ? "Indie" : (o.plan || "Studio"),
      seatPrice: 12, seatsTotal: o.seats || 1,
      storage: mapStorage(storage),
      members: [{ name: (user && user.name) || "You", email: (user && user.email) || "you@local.dev", role: ROLE[o.role] || "Owner", you: true }],
      invites: [],
      repos: repos.map(mapRepo),
      tokens: tokens.map(mapToken),
      invoices: [],
      activity: [],
      ttl: 15, lockPolicy: "hard",
    };
  }

  window.LSAPI = {
    isLocal: isLocal,
    api: API,

    // Determine auth via /auth/me, then replace the prototype's mock orgs with
    // real data. No session (prod) -> show the sign-in screen.
    bootstrap: function (comp) {
      req("GET", "/auth/me").then(function (meRes) {
        var user = (meRes && meRes.user) || null;
        return req("GET", "/orgs").then(function (res) {
          var list = (res && res.orgs) || [];
          if (!list.length) { comp.setState({ route: "createorg", user: user }); return; }
          return req("GET", "/tokens").catch(function () { return { tokens: [] }; }).then(function (tk) {
            var tokens = (tk && tk.tokens) || [];
            return Promise.all(list.map(function (o) {
              return Promise.all([
                req("GET", "/orgs/" + o.id + "/repos").catch(function () { return { repos: [] }; }),
                req("GET", "/orgs/" + o.id + "/storage").catch(function () { return { storage: null }; }),
              ]).then(function (rs) {
                return mapOrg(o, (rs[0] && rs[0].repos) || [], tokens, rs[1] && rs[1].storage, user);
              });
            }));
          }).then(function (orgsArr) {
            var orgs = {};
            orgsArr.forEach(function (o) { orgs[o.id] = o; });
            comp.setState({ orgs: orgs, orgId: orgsArr[0].id, route: "app", user: user });
            console.log("[LSAPI] signed in as " + (user && (user.email || user.name) || "?") + " · " + orgsArr.length + " org(s)");
          });
        });
      }).catch(function (e) {
        console.warn("[LSAPI] not authenticated → sign in (" + (e && e.message) + ")");
        comp.setState({ route: "signin" });
      });
    },

    // Start an OAuth login (top-level navigation to the API).
    authStart: function (provider) { window.location.href = API + "/auth/" + provider; },
    me: function () { return req("GET", "/auth/me"); },
    logout: function () { return req("POST", "/auth/logout").catch(function () {}); },

    saveStorage: function (orgId, d) {
      return req("PUT", "/orgs/" + orgId + "/storage", {
        provider: d.provider, endpoint: d.endpoint, region: d.region, bucket: d.bucket,
        accessKeyId: d.accessKeyId, secretAccessKey: d.secret, prefix: d.prefix || null,
      });
    },
    createRepo: function (orgId, name) { return req("POST", "/orgs/" + orgId + "/repos", { name: name }); },
    createToken: function (name, scopes) { return req("POST", "/tokens", { name: name, scopes: (scopes || []).join(",") }); },
  };
})();
