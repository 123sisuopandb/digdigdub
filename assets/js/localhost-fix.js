/**
 * PKF Domain Lock Bypass v3
 * Patches ALL ways JS can read hostname/domain.
 * Must be first script to run on page.
 */
(function () {
    'use strict';

    var REAL_HOST = '';
    try { REAL_HOST = window.location.hostname; } catch(e){}

    var FAKE_HOST   = 'privatekeyfinder.io';
    var FAKE_ORIGIN = 'https://privatekeyfinder.io';

    function fakeHref(real) {
        if (!real || typeof real !== 'string') return real;
        try { return real.replace(REAL_HOST, FAKE_HOST); } catch(e){ return real; }
    }

    function isAbout(url) {
        if (!url || typeof url !== 'string') return false;
        var u = url.trim().toLowerCase();
        return u === 'about:blank' || u.indexOf('about:') === 0;
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

    var origHrefDesc = Object.getOwnPropertyDescriptor(LP, 'href') || {};
    var origHrefGet  = origHrefDesc.get;
    var origHrefSet  = origHrefDesc.set;

    // hostname / host / origin
    patch(LP, 'hostname', function(){ return FAKE_HOST; });
    patch(LP, 'host',     function(){ return FAKE_HOST; });
    patch(LP, 'origin',   function(){ return FAKE_ORIGIN; });
    patch(LP, 'protocol', function(){ return 'https:'; });

    // href getter → replace real host with fake host
    // href setter → block about:blank
    patch(LP, 'href',
        function()  { return fakeHref(origHrefGet ? origHrefGet.call(this) : ''); },
        function(v) { if (isAbout(v)) { console.warn('[PKF] Blocked href=',v); return; }
                      if (origHrefSet) origHrefSet.call(this, v); }
    );

    // assign / replace
    ['assign','replace'].forEach(function(m){
        try {
            var o = LP[m];
            LP[m] = function(url) {
                if (isAbout(url)) { console.warn('[PKF] Blocked location.'+m,url); return; }
                return o.call(this, url);
            };
        } catch(e){}
    });

    // ── 2. document.* ─────────────────────────────────────────────────────
    patch(document, 'domain',  function(){ return FAKE_HOST; }, function(){});
    patch(document, 'URL',     function(){ return fakeHref(document.location.href); });
    patch(document, 'baseURI', function(){ return fakeHref(document.location.href); });
    patch(document, 'referrer',function(){ return FAKE_ORIGIN; });

    // ── 3. window.origin ──────────────────────────────────────────────────
    patch(window, 'origin', function(){ return FAKE_ORIGIN; });

    // ── 4. window.open ────────────────────────────────────────────────────
    var _open = window.open;
    window.open = function(url){ if(isAbout(url)) return null; return _open.apply(this,arguments); };

    // ── 5. document.write/writeln ─────────────────────────────────────────
    var _dw = document.write;
    document.write = function(html){
        if(typeof html==='string' && (html.indexOf('about:blank')>=0 || html.trim()==='')) return;
        return _dw.apply(document, arguments);
    };
    var _dwl = document.writeln;
    document.writeln = function(html){
        if(typeof html==='string' && html.indexOf('about:blank')>=0) return;
        return _dwl.apply(document, arguments);
    };

    // ── 6. history.pushState / replaceState ───────────────────────────────
    ['pushState','replaceState'].forEach(function(m){
        try {
            var o = history[m];
            history[m] = function(s,t,url){
                if(url && isAbout(String(url))) return;
                return o.call(this,s,t,url);
            };
        } catch(e){}
    });

    // ── 7. MutationObserver → kill meta refresh + blank iframes ──────────
    new MutationObserver(function(ms){
        ms.forEach(function(m){
            (m.addedNodes||[]).forEach(function(n){
                if(!n || !n.nodeName) return;
                // meta refresh to about:
                if(n.nodeName==='META' && (n.httpEquiv||'').toLowerCase()==='refresh'){
                    if((n.content||'').toLowerCase().indexOf('about:')>=0) {
                        n.parentNode && n.parentNode.removeChild(n);
                    }
                }
                // iframe pointing to about:blank
                if(n.nodeName==='IFRAME' && isAbout(n.src)) {
                    n.removeAttribute('src');
                }
            });
        });
    }).observe(document.documentElement||document.body, {childList:true,subtree:true});

    // ── 8. Catch navigation to about: via pagehide/beforeunload ──────────
    window.addEventListener('beforeunload', function(e){
        try {
            if(document.hidden || isAbout(location.href)) {
                e.preventDefault(); e.returnValue='';
            }
        } catch(ex){}
    }, true);

    // ── 9. Service Worker registration ────────────────────────────────────
    if ('serviceWorker' in navigator) {
        // Try both root and subpath scope
        var swPath = (function(){
            var p = window.location.pathname.replace(/\/[^/]*$/, '/') || '/';
            return p + 'sw.js';
        })();
        navigator.serviceWorker.register(swPath)
            .then(function(r){ console.log('[PKF] SW registered', r.scope); })
            .catch(function(){ /* SW not available on this path */ });
    }

    console.log('[PKF v3] Bypass ACTIVE. Host spoofed to:', FAKE_HOST,
                '| Real was:', REAL_HOST);
})();
