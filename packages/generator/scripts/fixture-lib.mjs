import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {canonicalJson} from '../dist/index.js';
export async function fixtureSubmission(){
 const spec=JSON.parse(await readFile(new URL('../../../contracts/site/2.0.0/examples/site-spec.json',import.meta.url),'utf8'));
 const bytes=await readFile(new URL('../../../contracts/site/2.0.0/examples/fictional-pixel.webp',import.meta.url));
 return {slug:'fictional-guide',spec,assets:{[spec.assets[0].id]:bytes.toString('base64')}};
}
export async function writeSource(directory,source,spec){
 for(const [path,text] of Object.entries(source.files)){const file=join(directory,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,text);}
 for(const [path,b64] of Object.entries(source.binaryFiles)){const file=join(directory,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,Buffer.from(b64,'base64'));}
 await writeFile(join(directory,'verification-input.json'),canonicalJson({paths:spec.pages.map(p=>p.path),sourceSha256:source.sourceSha256,specSha256:source.specSha256}));
}
