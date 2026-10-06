import {readFile,readdir,mkdir,copyFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const lock=JSON.parse(await readFile(new URL('package-lock.json',root),'utf8'));
const out=new URL('dist/licenses/',root);await mkdir(out,{recursive:true});
const inventory=[];
for(const [path,info] of Object.entries(lock.packages)) {
  if(!path || info.dev) continue;
  const directory=new URL(path+'/',root);
  let metadata;try{metadata=JSON.parse(await readFile(new URL('package.json',directory),'utf8'))}catch(error){if(error.code==='ENOENT' && info.optional)continue;throw error}
  if(!metadata.license) throw new Error('Missing dependency license: '+path);
  inventory.push({name:metadata.name,version:metadata.version,license:metadata.license,path});
  for(const file of await readdir(directory)) if(/^(LICENSE|LICENCE|NOTICE|COPYING)(\.|$)/i.test(file)) await copyFile(new URL(file,directory),new URL(path.replaceAll('/','_')+'_'+file,out));
}
await writeFile(new URL('inventory.json',out),JSON.stringify(inventory,null,2)+'\n');
console.log(`Preserved notices for ${inventory.length} installed runtime dependencies.`);
