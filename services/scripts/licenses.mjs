import {readFile,readdir,mkdir,writeFile,cp} from 'node:fs/promises';
import {join} from 'node:path';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));const inventory=[];
await mkdir('dist/licenses',{recursive:true});
for(const [path,pkg]of Object.entries(lock.packages)){
 if(!path.startsWith('node_modules/')||pkg.dev)continue;
 inventory.push({name:path.replace('node_modules/',''),version:pkg.version,license:pkg.license??'see distributed license'});
 for(const file of await readdir(path))if(/^(LICENSE|LICENCE|NOTICE|COPYING)(\.|$)/i.test(file))await cp(join(path,file),join('dist/licenses',path.replaceAll('/','_')+'_'+file),{recursive:true});
}
await writeFile('dist/licenses/inventory.json',JSON.stringify(inventory,null,2)+'\n');
