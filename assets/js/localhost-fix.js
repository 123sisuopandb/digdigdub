/**
 * PKF Domain Lock Bypass v4
 * - Patches all hostname/domain properties
 * - Registers Service Worker that intercepts .obf.js files
 * - On SW activation, auto-reloads page (once) so SW can intercept JS
 */
(function () {
    'use strict';

    // Save real hostname BEFORE any patches
    var REAL_HOST = '';
    try { REAL_HOST = window.location.hostname; } catch(e){}
    window.__PKF_REAL_HOST__ = REAL_HOST;

    var FAKE_HOST   = 'privatekeyfinder.io';
    var FAKE_ORIGIN = 'https://' + FAKE_HOST;

    function fakeHref(real) {
        if (!real || typeof real !== 'string') return real;
        return REAL_HOST ? real.replace(REAL_HOST, FAKE_HOST) : real;
    }
    function isAbout(url) {
        if (!url || typeof url !== 'string') return false;
        return url.trim().toLowerCase().indexOf('about:') === 0;
    }
    function patch(obj, prop, get, set) {
        try {
            var d = { configurable: true, enumerable: false };
            if (get !== undefined) d.get = get;
            if (set !== undefined) d.set = set;
            Object.defineProperty(obj, prop, d);
        } catch(e) {}
    }

    // ── 1. Location.prototype ─────────────────────────────────────────────
    var LP = (typeof Location !== 'undefined') ? Location.prototype
                : Object.getPrototypeOf(window.location);
    var hd = Object.getOwnPropertyDescriptor(LP, 'href') || {};
    var hg = hd.get, hs = hd.set;

    patch(LP, 'hostname', function(){ return FAKE_HOST; });
    patch(LP, 'host',     function(){ return FAKE_HOST; });
    patch(LP, 'origin',   function(){ return FAKE_ORIGIN; });
    patch(LP, 'protocol', function(){ return 'https:'; });
    patch(LP, 'href',
        function()  { return fakeHref(hg ? hg.call(this) : ''); },
        function(v) { if (!isAbout(v)) { if (hs) hs.call(this, v); }
                      else { console.warn('[PKF] Blocked href=', v); } }
    );
    ['assign','replace'].forEach(function(m) {
        try { var o = LP[m]; LP[m] = function(u) { if (!isAbout(u)) return o.call(this,u); }; } catch(e){}
    });

    // ── 2. document.* ─────────────────────────────────────────────────────
    patch(document, 'domain',   function(){ return FAKE_HOST; }, function(){});
    patch(document, 'URL',      function(){ return fakeHref(document.location.href); });
    patch(document, 'baseURI',  function(){ return fakeHref(document.location.href); });
    patch(document, 'referrer', function(){ return FAKE_ORIGIN + '/'; });

    // ── 3. window.origin ──────────────────────────────────────────────────
    try { patch(window, 'origin', function(){ return FAKE_ORIGIN; }); } catch(e){}

    // ── 4. window.open / document.write ───────────────────────────────────
    var _open = window.open;
    window.open = function(u){ if (isAbout(u)) return null; return _open.apply(this,arguments); };
    var _dw = document.write;
    document.write = function(h){ if (h && h.indexOf('about:blank') >= 0) return; return _dw.apply(document,arguments); };

    // ── 5. history ────────────────────────────────────────────────────────
    ['pushState','replaceState'].forEach(function(m){
        try { var o = history[m]; history[m] = function(s,t,u){ if (!u || !isAbout(String(u))) return o.call(this,s,t,u); }; } catch(e){}
    });

    // ── 6. MutationObserver ───────────────────────────────────────────────
    new MutationObserver(function(ms){
        ms.forEach(function(m){
            (m.addedNodes||[]).forEach(function(n){
                if (n && n.nodeName==='META' && (n.httpEquiv||'').toLowerCase()==='refresh'
                    && (n.content||'').toLowerCase().indexOf('about:')>=0) {
                    try { n.parentNode.removeChild(n); } catch(e){}
                }
            });
        });
    }).observe(document.documentElement, {childList:true, subtree:true});

    // ── 7. Service Worker + Auto-Reload ───────────────────────────────────
    if ('serviceWorker' in navigator) {
        // Determine SW path (must be in same scope as pages)
        var swUrl = (function(){
            var path = window.location.pathname;
            // For /digdigdub/ the SW should be at /digdigdub/sw.js
            var base = path.match(/^(\/[^/]+\/)/);
            return (base ? base[1] : '/') + 'sw.js';
        })();

        // Listen for SW message to reload
        navigator.serviceWorker.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'PKF_SW_RELOAD') {
                // Only reload ONCE to avoid loops
                var key = 'pkf-sw-reloaded';
                if (!sessionStorage.getItem(key)) {
                    sessionStorage.setItem(key, '1');
                    console.log('[PKF] SW active — reloading page for interception...');
                    window.location.reload();
                } else {
                    console.log('[PKF] SW already applied — no reload needed');
                }
            }
        });

        // If page is already SW-controlled, no need to reload
        if (navigator.serviceWorker.controller) {
            console.log('[PKF] Page already under SW control — bypass in effect');
        }

        navigator.serviceWorker.register(swUrl)
            .then(function(reg) {
                console.log('[PKF] SW registered at scope:', reg.scope);
            })
            .catch(function(err) {
                console.warn('[PKF] SW registration failed:', err);
            });
    }

    console.log('[PKF v4] Active — hostname spoofed:', FAKE_HOST, '(was:', REAL_HOST + ')');
})();
