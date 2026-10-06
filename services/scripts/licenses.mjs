import {readFile,readdir,mkdir,writeFile,cp} from 'node:fs/promises';
import {join} from 'node:path';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));const inventory=[];
await mkdir('dist/licenses',{recursive:true});
for(const [path,pkg]of Object.entries(lock.packages)){
 if(!path.startsWith('node_modules/')||pkg.dev)continue;
 let files;
 try { files=await readdir(path); }
 catch(error) { if(pkg.optional && error.code==='ENOENT')continue; throw error; }
 inventory.push({name:path.replace('node_modules/',''),version:pkg.version,license:pkg.license??'see distributed license'});
 for(const file of files)if(/^(LICENSE|LICENCE|NOTICE|COPYING)(\.|$)/i.test(file))await cp(join(path,file),join('dist/licenses',path.replaceAll('/','_')+'_'+file),{recursive:true});
}
await writeFile('dist/licenses/inventory.json',JSON.stringify(inventory,null,2)+'\n');

for(const file of ['src/_vendor/zod-to-json-schema/LICENSE','src/_vendor/partial-json-parser/LICENSE','src/internal/qs/LICENSE.md'])await cp(join('node_modules/openai',file),join('dist/licenses','openai_vendor_'+file.replaceAll('/','_')));
