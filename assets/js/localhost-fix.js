/**
 * PKF Localhost Domain Lock Bypass v2
 * Patches Location.prototype (NOT window.location instance)
 * This is the correct level to intercept obfuscated domain checks.
 */
(function () {
    'use strict';

    var FAKE_HOST = 'privatekeyfinder.io';
    var FAKE_ORIGIN = 'https://privatekeyfinder.io';

    // ── 1. Override Location.prototype properties ─────────────────────
    // These override WILL work because Location.prototype properties are configurable
    var locProto = window.Location ? window.Location.prototype : Object.getPrototypeOf(window.location);

    function safePatch(proto, prop, getter, setter) {
        try {
            var existing = Object.getOwnPropertyDescriptor(proto, prop);
            var def = { configurable: true, enumerable: true };
            if (getter) def.get = getter;
            else if (existing && existing.get) def.get = existing.get;
            if (setter) def.set = setter;
            else if (existing && existing.set) def.set = existing.set;
            Object.defineProperty(proto, prop, def);
            return true;
        } catch (e) {
            return false;
        }
    }

    // Fake hostname
    safePatch(locProto, 'hostname', function () { return FAKE_HOST; });
    safePatch(locProto, 'host',     function () { return FAKE_HOST; });
    safePatch(locProto, 'origin',   function () { return FAKE_ORIGIN; });

    // Block href setter if it points to about:blank
    var realHrefDesc = Object.getOwnPropertyDescriptor(locProto, 'href');
    var realHrefSet = realHrefDesc && realHrefDesc.set;
    safePatch(locProto, 'href',
        realHrefDesc && realHrefDesc.get,
        function (val) {
            if (typeof val === 'string' && val.indexOf('about:') === 0) {
                console.warn('[PKF-FIX] Blocked href:', val);
                return;
            }
            if (realHrefSet) realHrefSet.call(this, val);
        }
    );

    // ── 2. Patch replace() and assign() on prototype ──────────────────
    try {
        var _replace = locProto.replace;
        locProto.replace = function (url) {
            if (typeof url === 'string' && url.indexOf('about:') === 0) {
                console.warn('[PKF-FIX] Blocked replace:', url);
                return;
            }
            return _replace.call(this, url);
        };
    } catch (e) {}

    try {
        var _assign = locProto.assign;
        locProto.assign = function (url) {
            if (typeof url === 'string' && url.indexOf('about:') === 0) {
                console.warn('[PKF-FIX] Blocked assign:', url);
                return;
            }
            return _assign.call(this, url);
        };
    } catch (e) {}

    // ── 3. Override document.domain ───────────────────────────────────
    try {
        Object.defineProperty(document, 'domain', {
            get: function () { return FAKE_HOST; },
            configurable: true
        });
    } catch (e) {}

    // ── 4. Also intercept via window setter (window = 'about:blank') ──
    // Some obfuscators do: top.location = 'about:blank'
    // Intercept via beforeunload
    window.addEventListener('beforeunload', function (e) {
        // Check if we're about to navigate to about:blank
        if (document.URL === 'about:blank') {
            e.preventDefault();
            e.returnValue = '';
        }
    }, true);

    // ── 5. MutationObserver - catch any DOM wipes ─────────────────────
    // If obfuscated code does document.write('') or clears body
    var bodyCheckDone = false;
    var obs = new MutationObserver(function (mutations) {
        if (bodyCheckDone) return;
        for (var i = 0; i < mutations.length; i++) {
            if (mutations[i].removedNodes.length > 0) {
                var cur = window.location.href;
                if (cur.indexOf('about:') === 0) {
                    console.warn('[PKF-FIX] Navigation to about: detected - stopping');
                    history.back();
                }
            }
        }
    });
    if (document.documentElement) {
        obs.observe(document.documentElement, { childList: true, subtree: false });
    }

    console.log('[PKF-FIX v2] Active — hostname:', window.location.hostname, '→ spoofed to', FAKE_HOST);
})();
