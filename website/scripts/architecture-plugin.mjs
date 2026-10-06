import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export function architecturePage() {
  let config;
  const source=()=>readFile(resolve(config.root,'architecture/index.html'),'utf8');
  const middleware=read=>async(req,res,next)=>{
    if(!['/architecture','/architecture/','/architecture/index.html'].includes(req.url?.split('?')[0])||!['GET','HEAD'].includes(req.method))return next();
    try {const html=await read();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.method==='HEAD'?undefined:html);}catch(error){next(error);}
  };
  return {name:'a2aviary-architecture',configResolved(value){config=value;},configureServer(server){server.middlewares.use(middleware(source));},configurePreviewServer(server){server.middlewares.use(middleware(()=>readFile(resolve(config.root,config.build.outDir,'architecture'),'utf8')));},async generateBundle(){this.emitFile({type:'asset',fileName:'architecture',source:await source()});}};
}
