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

  // Capture a session token handed back by the OAuth callback (URL fragment),
  // store it, and clean the URL. The SPA then authenticates with a Bearer header
  // instead of a cross-subdomain cookie (which browsers routinely drop).
  // Tokens handed back via URL fragment: a session (#s=) from the OAuth
  // callback, and/or an invite token (#invite=) from a shared invite link.
  var _hash = location.hash || "";
  var _sm = _hash.match(/[#&]s=([^&]+)/);
  if (_sm) localStorage.setItem("ls_session_token", decodeURIComponent(_sm[1]));
  var _im = _hash.match(/[#&]invite=([^&]+)/);
  // Persist the invite token: OAuth sign-in is a full-page redirect, so an
  // in-memory value would be lost before the user is authenticated. We consume
  // it from localStorage in bootstrap() once a session exists.
  if (_im) localStorage.setItem("ls_pending_invite", decodeURIComponent(_im[1]));
  if (_sm || _im) history.replaceState(null, "", location.pathname + location.search);
  var SESSION_TOKEN = localStorage.getItem("ls_session_token");

  function headers(extra) {
    var h = extra || {};
    if (DEV_TOKEN) h["Authorization"] = "Bearer " + DEV_TOKEN;
    else if (SESSION_TOKEN) h["Authorization"] = "Bearer " + SESSION_TOKEN;
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

  function mapRepo(r, stats) {
    stats = stats || {};
    return { name: r.slug, slug: r.slug, sizeGB: Math.round((stats.bytes || 0) / 1e9), blobs: stats.objects || 0, locks: 0, activity: timeAgo(r.created_at), branch: "main", lockList: [] };
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
  function mapStorage(s, usageData) {
    var u = usageData || {};
    var bytes = u.totalBytes || 0;
    var stats = { storedBytes: bytes, storedGB: Math.round((bytes / 1e9) * 100) / 100, blobs: u.objects || 0, byRepo: u.byRepo || [] };
    if (!s) return Object.assign({ connected: false, provider: "r2", endpoint: "", region: "auto", bucket: "", accessKeyId: "", secret: "", prefix: "" }, stats);
    return Object.assign({ connected: true, provider: s.provider || "r2", endpoint: s.endpoint || "", region: s.region || "auto", bucket: s.bucket || "", accessKeyId: s.accessKeyId || "", secret: "••••••••", prefix: s.prefix || "" }, stats);
  }
  var FREE_SEATS = 1; // included seats until a paid plan raises the limit
  function mapMembers(md, user) {
    var you = (md && md.you) || (user && user.id);
    var members = ((md && md.members) || []).map(function (m) {
      return { userId: m.user_id, name: m.name || (m.email || "").split("@")[0] || "Member", email: m.email || "", role: ROLE[m.role] || "Member", you: m.user_id === you, joined: timeAgo(m.created_at) };
    });
    var invites = ((md && md.invites) || []).map(function (iv) {
      return { id: iv.id, email: iv.email, role: ROLE[iv.role] || "Member", sent: timeAgo(iv.created_at) };
    });
    return { members: members, invites: invites };
  }
  function mapBilling(bd) {
    bd = bd || {};
    var active = bd.status === "active" || bd.status === "trialing";
    return {
      plan: bd.plan || "free", status: bd.status || "none", active: active,
      seatsPaid: bd.seatsPaid || 0, seatsUsed: bd.seatsUsed != null ? bd.seatsUsed : null,
      freeSeats: bd.freeSeats || 1, seatPrice: bd.seatPrice || 3.99,
      amountCents: bd.amountCents != null ? bd.amountCents : null, grossCents: bd.grossCents != null ? bd.grossCents : null,
      currency: bd.currency || null, discountLabel: bd.discountLabel || null,
      currentPeriodEnd: bd.currentPeriodEnd || null, renewLabel: bd.currentPeriodEnd ? dateFmt(bd.currentPeriodEnd) : null,
      configured: !!bd.configured, hasCustomer: !!bd.hasCustomer, canManage: !!bd.canManage,
    };
  }
  function mapActivity(activityData, user) {
    var ICON = { org: "building-2", storage: "database", repo: "box", token: "key-round", lock: "lock", unlock: "lock-open", force_unlock: "shield-alert", push: "git-commit-horizontal" };
    var TINT = { org: "var(--status-synced)", storage: "var(--amber-400)", repo: "var(--status-mine)", token: "var(--status-pending)", lock: "var(--status-locked)", unlock: "var(--status-synced)", force_unlock: "var(--status-locked)", push: "var(--status-synced)" };
    var fallbackWho = (user && user.name) || "You";
    return ((activityData && activityData.activity) || []).map(function (e) {
      return { who: e.who || fallbackWho, what: e.what, when: timeAgo(e.when), icon: ICON[e.kind] || "activity", tint: TINT[e.kind] || "var(--text-muted)" };
    });
  }
  function mapOrg(o, repos, tokens, storage, usageData, activityData, membersData, billingData, user) {
    var statsByRepo = {};
    ((usageData && usageData.byRepo) || []).forEach(function (br) { statsByRepo[br.repo] = br; });
    var mm = mapMembers(membersData, user);
    var mb = mapBilling(billingData);
    var members = mm.members.length ? mm.members
      : [{ userId: user && user.id, name: (user && user.name) || "You", email: (user && user.email) || "you@local.dev", role: ROLE[o.role] || "Owner", you: true }];
    return {
      id: o.id, name: o.name, slug: o.slug,
      role: ROLE[o.role] || "Member",
      plan: o.plan === "free" ? "Indie" : (o.plan || "Studio"),
      seatPrice: mb.seatPrice, seatsTotal: mb.active ? Math.max(mb.seatsPaid + mb.freeSeats, members.length) : Math.max(mb.freeSeats, members.length),
      storage: mapStorage(storage, usageData),
      members: members,
      invites: mm.invites,
      billing: mb,
      repos: repos.map(function (r) { return mapRepo(r, statsByRepo[r.slug]); }),
      tokens: tokens.map(mapToken),
      invoices: [],
      activity: mapActivity(activityData, user),
      ttl: 15, lockPolicy: "hard",
    };
  }

  // Merge a (lazily-fetched) usage response into an org's storage + repo sizes.
  function applyUsage(comp, orgId, usageData) {
    if (!usageData) return;
    var bytes = usageData.totalBytes || 0;
    var statsByRepo = {};
    (usageData.byRepo || []).forEach(function (br) { statsByRepo[br.repo] = br; });
    comp.setState(function (s) {
      var cur = s.orgs && s.orgs[orgId];
      if (!cur) return {};
      var orgs = Object.assign({}, s.orgs);
      orgs[orgId] = Object.assign({}, cur, {
        storage: Object.assign({}, cur.storage, {
          storedBytes: bytes, storedGB: Math.round((bytes / 1e9) * 100) / 100,
          blobs: usageData.objects || 0, byRepo: usageData.byRepo || [], statsReady: true,
        }),
        repos: cur.repos.map(function (r) {
          var st = statsByRepo[r.slug] || {};
          return Object.assign({}, r, { sizeGB: Math.round((st.bytes || 0) / 1e9), blobs: st.objects || 0 });
        }),
      });
      return { orgs: orgs };
    });
  }

  window.LSAPI = {
    isLocal: isLocal,
    api: API,

    // Determine auth via /auth/me, then replace the prototype's mock orgs with
    // real data. No session (prod) -> show the sign-in screen.
    bootstrap: function (comp) {
      return req("GET", "/auth/me").then(function (meRes) {
        var user = (meRes && meRes.user) || null;
        var pendingInvite = localStorage.getItem("ls_pending_invite");
        var joinedOrgId = null;
        var pre = Promise.resolve();
        if (user && pendingInvite) {
          pre = req("POST", "/orgs/accept-invite", { token: pendingInvite }).then(function (r) {
            localStorage.removeItem("ls_pending_invite");
            if (r && r.orgId) joinedOrgId = r.orgId;
            if (comp.flash) comp.flash("Invite accepted — welcome to the team", "mine");
          }).catch(function (e) {
            localStorage.removeItem("ls_pending_invite");
            if (comp.flash) comp.flash("Couldn't join via invite: " + ((e && e.message) || "expired or invalid"), "conflict");
          });
        }
        return pre.then(function () { return req("GET", "/orgs"); }).then(function (res) {
          var list = (res && res.orgs) || [];
          if (!list.length) { comp.setState({ route: "createorg", user: user }); return; }
          return req("GET", "/tokens").catch(function () { return { tokens: [] }; }).then(function (tk) {
            var tokens = (tk && tk.tokens) || [];
            return Promise.all(list.map(function (o) {
              return Promise.all([
                req("GET", "/orgs/" + o.id + "/repos").catch(function () { return { repos: [] }; }),
                req("GET", "/orgs/" + o.id + "/storage").catch(function () { return { storage: null }; }),
                req("GET", "/orgs/" + o.id + "/activity").catch(function () { return null; }),
                req("GET", "/orgs/" + o.id + "/members").catch(function () { return null; }),
                req("GET", "/orgs/" + o.id + "/billing").catch(function () { return null; }),
              ]).then(function (rs) {
                // usage = a full bucket listing (slow); loaded lazily after render
                return mapOrg(o, (rs[0] && rs[0].repos) || [], tokens, rs[1] && rs[1].storage, null, rs[2], rs[3], rs[4], user);
              });
            }));
          }).then(function (orgsArr) {
            var orgs = {};
            orgsArr.forEach(function (o) { orgs[o.id] = o; });
            comp.setState({ orgs: orgs, orgId: (joinedOrgId && orgs[joinedOrgId]) ? joinedOrgId : orgsArr[0].id, route: "app", user: user });
            console.log("[LSAPI] signed in as " + (user && (user.email || user.name) || "?") + " · " + orgsArr.length + " org(s)");
            // Fill in storage usage (slow bucket listing) without blocking render.
            orgsArr.forEach(function (o) {
              req("GET", "/orgs/" + o.id + "/storage/usage").then(function (u) { applyUsage(comp, o.id, u); }).catch(function () {});
            });
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
    logout: function () { localStorage.removeItem("ls_session_token"); return req("POST", "/auth/logout").catch(function () {}); },

    saveStorage: function (orgId, d) {
      return req("PUT", "/orgs/" + orgId + "/storage", {
        provider: d.provider, endpoint: d.endpoint, region: d.region, bucket: d.bucket,
        accessKeyId: d.accessKeyId, secretAccessKey: d.secret, prefix: d.prefix || null,
      });
    },
    createOrg: function (name) { return req("POST", "/orgs", { name: name }); },
    createRepo: function (orgId, name) { return req("POST", "/orgs/" + orgId + "/repos", { name: name }); },
    createToken: function (name, scopes) { return req("POST", "/tokens", { name: name, scopes: (scopes || []).join(",") }); },
    invite: function (orgId, email, role) { return req("POST", "/orgs/" + orgId + "/invites", { email: email, role: (role || "member").toLowerCase() }); },
    revokeInvite: function (orgId, inviteId) { return req("DELETE", "/orgs/" + orgId + "/invites/" + inviteId); },
    setRole: function (orgId, userId, role) { return req("POST", "/orgs/" + orgId + "/members/" + userId + "/role", { role: (role || "member").toLowerCase() }); },
    removeMember: function (orgId, userId) { return req("DELETE", "/orgs/" + orgId + "/members/" + userId); },
    acceptInvite: function (token) { return req("POST", "/orgs/accept-invite", { token: token }); },
    startCheckout: function (orgId, seats) { return req("POST", "/orgs/" + orgId + "/billing/checkout", { seats: seats || 1 }); },
    openPortal: function (orgId) { return req("POST", "/orgs/" + orgId + "/billing/portal", {}); },
  };
})();
