import { defaultPolicy } from '../../../services/src/site/policy.ts';
import type { SiteSpec } from '../../../services/src/site/types.ts';
import { boundCollections } from './render.ts';
export const POCKETBASE_VERSION = '0.40.4';
export const POCKETBASE_ZIP_SHA256 =
  '9042ec818570e79c3628dadcd0a756c1496d9e1173918ec409d133c02f82e5fa';
export const POCKETBASE_ARM64_ZIP_SHA256 =
  '86095bf8ed9345954f0d2bf0a5fb9b57584ae60b77ebf3b6cd23a8003a3fd418';
export function pocketBaseMigration(spec: SiteSpec): string {
  const editor = "@request.auth.collectionName = 'editors'";
  const definitions = boundCollections(spec).map((name) => ({
    name,
    type: 'base',
    listRule: `published = true || (${editor})`,
    viewRule: `published = true || (${editor})`,
    createRule: editor,
    updateRule: editor,
    deleteRule: editor,
    fields: [
      {
        name: 'title',
        type: 'text',
        required: true,
        max: defaultPolicy.firstVersion.copy.heading.value
      },
      {
        name: 'body',
        type: 'text',
        required: true,
        max: defaultPolicy.firstVersion.copy.paragraph.value
      },
      { name: 'published', type: 'bool' }
    ]
  }));
  return `migrate((app)=>{\nif(!app.findAllCollections().some(c=>c.name==='editors'))app.save(new Collection({name:'editors',type:'auth',listRule:'id = @request.auth.id',viewRule:'id = @request.auth.id',createRule:null,updateRule:'id = @request.auth.id',deleteRule:null,authRule:'',passwordAuth:{enabled:true,identityFields:['email']}}));\nfor(const definition of ${JSON.stringify(definitions)}){if(!app.findAllCollections().some(c=>c.name===definition.name))app.save(new Collection(definition));}\n},()=>{throw new Error('CMS rollback requires explicit owner data recovery; content is never deleted by a site change');});\n`;
}
export const pocketBaseBootstrap = `onBootstrap((event)=>{event.next();const app=event.app;app.runAllMigrations();const required=n=>{const v=$os.getenv(n);if(!v)throw new Error('Missing CMS runtime configuration');return v};
const adminEmail=required('PB_ADMIN_EMAIL'),adminPassword=required('PB_ADMIN_PASSWORD');
let admin;try{admin=app.findAuthRecordByEmail('_superusers',adminEmail)}catch{admin=new Record(app.findCollectionByNameOrId('_superusers'));admin.set('email',adminEmail)}admin.setPassword(adminPassword);app.save(admin);
const clientEmail=required('PB_CLIENT_EMAIL');let client;try{client=app.findAuthRecordByEmail('editors',clientEmail)}catch{client=new Record(app.findCollectionByNameOrId('editors'));client.set('email',clientEmail);client.set('verified',true);client.setPassword(required('PB_CLIENT_PASSWORD'));app.save(client)}
const settings=app.settings();settings.backups.cron='0 3 * * *';settings.backups.cronMaxKeep=7;settings.backups.s3.enabled=true;settings.backups.s3.bucket=required('PB_BACKUP_BUCKET');settings.backups.s3.region=required('PB_BACKUP_REGION');settings.backups.s3.endpoint=required('PB_BACKUP_ENDPOINT');settings.backups.s3.accessKey=required('PB_BACKUP_ACCESS_KEY_ID');settings.backups.s3.secret=required('PB_BACKUP_SECRET_ACCESS_KEY');settings.backups.s3.forcePathStyle=$os.getenv('PB_BACKUP_FORCE_PATH_STYLE')==='true';settings.rateLimits.enabled=true;app.save(settings);
});\n`;
export const pocketBaseDockerfile = `FROM alpine:3.23.4 AS download
ARG TARGETARCH
RUN apk add --no-cache curl unzip ca-certificates
RUN case "$TARGETARCH" in amd64) checksum='${POCKETBASE_ZIP_SHA256}' ;; arm64) checksum='${POCKETBASE_ARM64_ZIP_SHA256}' ;; *) exit 1 ;; esac && curl --fail --location --silent --show-error "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_$TARGETARCH.zip" -o /tmp/pb.zip && echo "$checksum  /tmp/pb.zip" | sha256sum -c - && unzip /tmp/pb.zip -d /pb
FROM alpine:3.23.4
RUN apk add --no-cache ca-certificates && adduser -D -u 1000 pocketbase
COPY --from=download /pb /pb
COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks
COPY pb_public /pb/pb_public
RUN mkdir -p /pb/pb_data && chown -R pocketbase:pocketbase /pb
USER pocketbase
EXPOSE 8090
WORKDIR /pb
CMD ["/pb/pocketbase","serve","--http=[::]:8090","--dir=/pb/pb_data","--encryptionEnv=PB_ENCRYPTION_KEY"]
`;
export function cmsEditorHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Site CMS</title><script src="editor.js" defer></script></head><body><main><h1>Site content</h1><form id="login"><label>Email <input name="email" type="email" autocomplete="username" required></label><label>Password <input name="password" type="password" autocomplete="current-password" required></label><button>Sign in</button></form><p id="status" role="status"></p><section id="editor" hidden><button id="logout">Sign out</button><label>Collection <select id="collection"></select></label><ul id="records"></ul><form id="record"><input name="id" type="hidden"><label>Title <input name="title" maxlength="${defaultPolicy.firstVersion.copy.heading.value}" required></label><label>Body <textarea name="body" maxlength="${defaultPolicy.firstVersion.copy.paragraph.value}" required></textarea></label><label>Published <input name="published" type="checkbox"></label><button>Save content</button></form></section></main></body></html>`;
}
export function cmsEditorScript(spec: SiteSpec): string {
  return `const collections=${JSON.stringify(boundCollections(spec))};let token='';const status=document.querySelector('#status'),editor=document.querySelector('#editor'),select=document.querySelector('#collection');for(const name of collections){const o=document.createElement('option');o.value=name;o.textContent=name;select.append(o)}const api=async(path,data,method='GET')=>{const r=await fetch('api/'+path,{method,headers:{'Content-Type':'application/json',Authorization:token},body:data?JSON.stringify(data):undefined});if(!r.ok)throw Error('Request rejected');return r.status===204?{}:r.json()};async function refresh(){const data=await api('collections/'+select.value+'/records?perPage=100');const list=document.querySelector('#records');list.replaceChildren();for(const item of data.items){const li=document.createElement('li'),edit=document.createElement('button'),remove=document.createElement('button');edit.textContent=item.title;edit.onclick=()=>{const f=document.querySelector('#record');for(const k of ['id','title','body'])f.elements[k].value=item[k];f.elements.published.checked=item.published};remove.textContent='Delete';remove.onclick=async()=>{if(!confirm('Delete this content record?'))return;try{await api('collections/'+select.value+'/records/'+item.id,undefined,'DELETE');await refresh()}catch{status.textContent='Delete failed'}};li.append(edit,remove);list.append(li)}}document.querySelector('#login').onsubmit=async e=>{e.preventDefault();try{const f=new FormData(e.target),r=await api('collections/editors/auth-with-password',{identity:f.get('email'),password:f.get('password')},'POST');token=r.token;e.target.reset();e.target.hidden=true;editor.hidden=false;status.textContent='Signed in';await refresh()}catch{status.textContent='Sign in failed'}};document.querySelector('#record').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),id=f.get('id');try{await api('collections/'+select.value+'/records'+(id?'/'+id:''),{title:f.get('title'),body:f.get('body'),published:f.has('published')},id?'PATCH':'POST');e.target.reset();await refresh();status.textContent='Saved. CMS edits do not consume site changes.'}catch{status.textContent='Save failed'}};select.onchange=()=>refresh().catch(()=>status.textContent='Load failed');document.querySelector('#logout').onclick=()=>location.reload();\n`;
}
