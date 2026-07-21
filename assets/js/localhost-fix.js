/**
 * PKF Domain Lock Bypass v5 — MINIMAL & SAFE
 * 
 * We've already patched ALL .obf.js files directly (let _0x...=!![] fix).
 * This script ONLY blocks about:blank redirects as a safety net.
 * 
 * We do NOT spoof hostname/href anymore — that was breaking navigation!
 * Direct .obf.js patches make spoofing unnecessary.
 */
(function () {
    'use strict';

    function isAbout(url) {
        if (!url || typeof url !== 'string') return false;
        return url.trim().toLowerCase().indexOf('about:') === 0;
    }

    // ── 1. Block Location.prototype href SETTER only (not getter!) ────────
    var LP = (typeof Location !== 'undefined') ? Location.prototype
                : Object.getPrototypeOf(window.location);
    var hd = Object.getOwnPropertyDescriptor(LP, 'href') || {};
    var hs = hd.set;
    if (hs) {
        Object.defineProperty(LP, 'href', {
            get: hd.get,  // original getter — returns REAL URL (for correct navigation)
            set: function(v) {
                if (isAbout(v)) { console.warn('[PKF] Blocked href =', v); return; }
                hs.call(this, v);
            },
            configurable: true
        });
    }

    // ── 2. Block location.assign / replace ───────────────────────────────
    ['assign', 'replace'].forEach(function(m) {
        try {
            var o = LP[m];
            LP[m] = function(url) {
                if (isAbout(url)) { console.warn('[PKF] Blocked location.' + m, url); return; }
                return o.call(this, url);
            };
        } catch(e) {}
    });

    // ── 3. Block document.location = 'about:blank' (MAIN redirect!) ──────
    try {
        var dld = Object.getOwnPropertyDescriptor(Document.prototype, 'location');
        if (dld && dld.set) {
            Object.defineProperty(Document.prototype, 'location', {
                get: dld.get,
                set: function(val) {
                    if (isAbout(val)) { console.warn('[PKF] Blocked document.location =', val); return; }
                    dld.set.call(this, val);
                },
                configurable: true
            });
        }
    } catch(e) {}

    // ── 4. Block window.open('about:blank') ──────────────────────────────
    var _open = window.open;
    window.open = function(u) {
        if (isAbout(u)) return null;
        return _open.apply(this, arguments);
    };

    // ── 5. Block document.write with about:blank ──────────────────────────
    var _dw = document.write;
    document.write = function(h) {
        if (h && h.indexOf('about:blank') >= 0) return;
        return _dw.apply(document, arguments);
    };

    // ── 6. Block history API ──────────────────────────────────────────────
    ['pushState', 'replaceState'].forEach(function(m) {
        try {
            var o = history[m];
            history[m] = function(s, t, u) {
                if (u && isAbout(String(u))) return;
                return o.call(this, s, t, u);
            };
        } catch(e) {}
    });

    // ── 7. MutationObserver — kill meta-refresh to about: ─────────────────
    new MutationObserver(function(ms) {
        ms.forEach(function(m) {
            (m.addedNodes || []).forEach(function(n) {
                if (n && n.nodeName === 'META'
                    && (n.httpEquiv || '').toLowerCase() === 'refresh'
                    && (n.content || '').toLowerCase().indexOf('about:') >= 0) {
                    try { n.parentNode.removeChild(n); } catch(e) {}
                }
            });
        });
    }).observe(document.documentElement, { childList: true, subtree: true });

    console.log('[PKF v5] Active — about:blank blocked, navigation intact');
})();
