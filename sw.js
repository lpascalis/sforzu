const CACHE='sforzu-pwa-v6-6';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).then(resp=>{
    if(e.request.method==='GET'&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request, copy));}
    return resp;
  }).catch(()=>caches.match('./'))));
});