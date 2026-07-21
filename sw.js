/**
 * PKF Service Worker v2 — Full Domain Lock Interceptor
 * On first visit: activates immediately and tells the page to reload.
 * On second visit (reload): intercepts all .obf.js files and injects bypass.
 */

// Minimal bypass code injected at the top of every .obf.js file
const INJECT = `(function(){
var F='privatekeyfinder.io',O='https://privatekeyfinder.io';
function p(o,k,g,s){try{var d={configurable:true,enumerable:false};if(g)d.get=g;if(s)d.set=s;Object.defineProperty(o,k,d);}catch(e){}}
function b(u){return!!u&&typeof u==='string'&&u.trim().toLowerCase().indexOf('about:')===0;}
function fh(h){try{return(h||'').replace(window.__PKF_REAL_HOST__||'',F);}catch(e){return h;}}
var LP=typeof Location!=='undefined'?Location.prototype:Object.getPrototypeOf(location);
var hd=Object.getOwnPropertyDescriptor(LP,'href')||{};
p(LP,'hostname',function(){return F;});
p(LP,'host',function(){return F;});
p(LP,'origin',function(){return O;});
p(LP,'href',function(){return fh(hd.get?hd.get.call(this):'');},function(v){if(!b(v)&&hd.set)hd.set.call(this,v);});
['assign','replace'].forEach(function(m){try{var o=LP[m];LP[m]=function(u){if(!b(u))return o.call(this,u);};}catch(e){}});
p(document,'domain',function(){return F;},function(){});
p(document,'URL',function(){return fh(location.href);});
p(document,'baseURI',function(){return fh(location.href);});
try{p(window,'origin',function(){return O;});}catch(e){}
// Patch document.currentScript to fake hostname
var _cso=Object.getOwnPropertyDescriptor(Document.prototype,'currentScript');
if(_cso)p(Document.prototype,'currentScript',function(){
  var s=_cso.get?_cso.get.call(this):null;
  if(s&&s.src)try{var u=new URL(s.src);if(u.hostname!==F){var fs=Object.create(s);Object.defineProperty(fs,'src',{get:function(){return s.src.replace(u.hostname,F);}});return fs;}}catch(e){}
  return s;
});
var _wo=window.open;window.open=function(u){if(b(u))return null;return _wo.apply(this,arguments);};
var _dw=document.write;document.write=function(h){if(h&&h.indexOf('about:blank')>=0)return;return _dw.apply(document,arguments);};
})();`;

self.addEventListener('install', function(event) {
    console.log('[SW] Installing — skipWaiting');
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    console.log('[SW] Activating — claiming clients');
    event.waitUntil(
        clients.claim().then(function() {
            // Tell ALL open pages to reload so SW can intercept their requests
            return clients.matchAll({ type: 'window', includeUncontrolled: true });
        }).then(function(allClients) {
            allClients.forEach(function(client) {
                console.log('[SW] Telling client to reload:', client.url);
                client.postMessage({ type: 'PKF_SW_RELOAD' });
            });
        })
    );
});

self.addEventListener('fetch', function(event) {
    var url = event.request.url;

    // 1. Intercept ALL obfuscated JS files — inject bypass at top
    if (url.match(/\.obf\.js(\?|$)/) || url.match(/assets\/js\/.*\.js(\?|$)/)) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' }).then(function(resp) {
                return resp.text().then(function(body) {
                    console.log('[SW] Injecting bypass into:', url);
                    return new Response(INJECT + '\n' + body, {
                        status: resp.status,
                        headers: {
                            'Content-Type': 'application/javascript; charset=utf-8',
                            'Cache-Control': 'no-cache, no-store'
                        }
                    });
                });
            }).catch(function() {
                return fetch(event.request);
            })
        );
        return;
    }

    // 2. Intercept any API calls that might be domain validation
    // If the app calls an API with the domain, return a success response
    if (url.indexOf('/api/') !== -1 || url.indexOf('/validate') !== -1 || url.indexOf('/auth') !== -1) {
        // Let it pass through — just log it
        console.log('[SW] API call detected:', url);
    }

    // Default: pass through
    event.respondWith(fetch(event.request));
});
