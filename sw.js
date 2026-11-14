const CACHE='zombie-colony-v08-3';
const ASSETS=['./','./index.html','./styles.css','./manifest.webmanifest','./icon.svg','./src/main.js','./src/geometry.js','./src/world.js','./src/render.js','./src/camera.js','./src/simulation.js','./src/agent.js','./src/construction.js','./src/planning.js','./src/resale.js','./src/rentals.js','./src/property.js','./src/placement-interaction.js','./src/colony.js','./src/social.js','./src/persistence.js','./src/event-scenes.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('zombie-colony-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));}return response;}).catch(()=>caches.match('./index.html')));
  return;
 }
 event.respondWith(caches.match(req,{ignoreSearch:true}).then(saved=>saved||fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return response;})));
});
