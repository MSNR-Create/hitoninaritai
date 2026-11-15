import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const pathname=decodeURIComponent(url.pathname);
  const name=pathname==='/'?'/index.html':pathname;
  const target=path.resolve(root,'.'+name);
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  const info=await stat(target);if(!info.isFile()){res.writeHead(404);res.end('Not found');return;}
  const data=await readFile(target);res.writeHead(200,{'content-type':mime[path.extname(target)]??'application/octet-stream','cache-control':'no-cache','x-content-type-options':'nosniff'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,()=>console.log(`Zombie Colony RC: http://localhost:${port}`));
