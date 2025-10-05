self.addEventListener('install',e=>{
  e.waitUntil(caches.open('sforzu-v8-1').then(c=>c.addAll(['./','./index.html','./app.js','./manifest.json','./assets/icon-192.png','./assets/icon-256.png','./assets/icon-384.png','./assets/icon-512.png'])));
});
self.addEventListener('fetch',e=>{ e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); });