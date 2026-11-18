const CACHE='ares-gym-v2';
const MEDIA='ares-media-v1';
const FILES=['./','./index.html','./manifest.json','./icon.svg'];
const MAX_MEDIA=500;

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==MEDIA).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function trimMedia(){
  const c=await caches.open(MEDIA);
  const keys=await c.keys();
  if(keys.length>MAX_MEDIA)await Promise.all(keys.slice(0,keys.length-MAX_MEDIA).map(k=>c.delete(k)));
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  // Arquivos do próprio site: tenta a rede primeiro (pega atualizações) e cai no cache se offline.
  if(url.origin===location.origin){
    e.respondWith(
      fetch(req).then(res=>{
        if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
        return res;
      }).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  // Biblioteca de exercícios (JSON + imagens do GitHub): usa o cache e atualiza em segundo plano.
  if(url.hostname==='raw.githubusercontent.com'){
    e.respondWith(
      caches.open(MEDIA).then(async c=>{
        const cached=await c.match(req);
        const net=fetch(req).then(res=>{
          if(res&&(res.ok||res.type==='opaque')){c.put(req,res.clone()).then(trimMedia)}
          return res;
        }).catch(()=>cached);
        return cached||net;
      })
    );
  }
});