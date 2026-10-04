import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { sign, mimeMessage, authenticate } from './protocol.js';

// The CLI produces signed MIME; sending is an explicit separate operation.
if(process.argv[1]?.endsWith('client.js')) {
  const [keyPath,requestPath,outputPath]=process.argv.slice(2);
  if(!keyPath || !requestPath || !outputPath)throw new Error('Usage: node dist/client.js PRIVATE_KEY_JSON REQUEST_JSON OUTPUT_EML');
  const key=JSON.parse(await readFile(keyPath,'utf8'));
  const r=JSON.parse(await readFile(requestPath,'utf8'));
  r.version??='1.0';r.messageId??=randomUUID();r.correlationId??=randomUUID();r.nonce??=randomUUID();r.issuedAt??=Math.floor(Date.now()/1000);r.expiresAt??=r.issuedAt+900;
  const jws=await sign(r,key.privateKey,key.kid);
  await writeFile(outputPath,mimeMessage(key.from,'agent@a2aviary.io',jws,r.messageId,r.correlationId),{mode:0o600});
  console.log(JSON.stringify({messageId:r.messageId,correlationId:r.correlationId,output:outputPath}));
}
