/**
 * PKF Service Worker - Domain Lock Interceptor
 * Intercepts all .obf.js requests and prepends domain bypass code
 * so it runs in the SAME EXECUTION CONTEXT as the obfuscated code.
 */

const BYPASS_CODE = `
;(function(){
var _R=typeof Location!=='undefined'?Location.prototype:Object.getPrototypeOf(location);
var _H=location.hostname;
var _F='privatekeyfinder.io';
function _p(o,k,g,s){try{var d={configurable:true,enumerable:false};if(g)d.get=g;if(s)d.set=s;Object.defineProperty(o,k,d);}catch(e){}}
function _b(u){return u&&typeof u==='string'&&(u.trim().toLowerCase().indexOf('about:')===0);}
function _fh(h){try{return h?h.replace(_H,_F):h;}catch(e){return h;}}
var _hd=Object.getOwnPropertyDescriptor(_R,'href')||{};
var _hg=_hd.get,_hs=_hd.set;
_p(_R,'hostname',function(){return _F;});
_p(_R,'host',function(){return _F;});
_p(_R,'origin',function(){return 'https://'+_F;});
_p(_R,'href',
  function(){return _fh(_hg?_hg.call(this):'');},
  function(v){if(!_b(v)&&_hs)_hs.call(this,v);}
);
['assign','replace'].forEach(function(m){try{var o=_R[m];_R[m]=function(u){if(!_b(u))return o.call(this,u);};}catch(e){}});
_p(document,'domain',function(){return _F;},function(){});
_p(document,'URL',function(){return _fh(location.href);});
_p(document,'baseURI',function(){return _fh(location.href);});
try{_p(window,'origin',function(){return 'https://'+_F;});}catch(e){}
var _wo=window.open;window.open=function(u){if(_b(u))return null;return _wo.apply(this,arguments);};
var _dw=document.write;document.write=function(h){if(h&&h.indexOf('about:blank')>=0)return;return _dw.apply(document,arguments);};
})();
`;

self.addEventListener('install', function(event) {
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(event) {
    var url = event.request.url;
    
    // Intercept .obf.js files and prepend our bypass code
    if (url.indexOf('.obf.js') !== -1 || url.indexOf('app.js') !== -1) {
        event.respondWith(
            fetch(event.request).then(function(response) {
                return response.text().then(function(body) {
                    var modified = BYPASS_CODE + '\n' + body;
                    return new Response(modified, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: {
                            'Content-Type': 'application/javascript',
                            'Cache-Control': 'no-cache'
                        }
                    });
                });
            }).catch(function() {
                return fetch(event.request);
            })
        );
        return;
    }
    
    // For all other requests, pass through normally
    event.respondWith(fetch(event.request));
});
