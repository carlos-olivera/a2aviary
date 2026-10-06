export const SENSITIVE = /^(?:\.github\/|infra\/|apps\/|services\/|contracts\/|plans\/|policy\/|docs\/decisions\/|website\/public\/licenses\/|\.dockerignore$|AGENTS\.md$|CONTRIBUTING|GOVERNANCE\.md$|LICENSE$|SECURITY\.md$|package(?:-lock)?\.json$|website\/(?:scripts\/|package(?:-lock)?\.json$|vite\.config\.js$))/;
export function policyDecision(files:{filename:string,previous_filename?:string}[],reviews:{user:{login:string},state:string,commit_id:string}[],head:string){
  const sensitive=files.some(f=>SENSITIVE.test(f.filename)||Boolean(f.previous_filename&&SENSITIVE.test(f.previous_filename)));
  const ownerReviews=reviews.filter(r=>r.user.login==='carlos-olivera');
  const latest=ownerReviews.at(-1);
  const approved=latest?.state==='APPROVED' && latest.commit_id===head;
  return {allowed:!sensitive || approved,sensitive,reason:sensitive&&!approved?'Carlos must approve the current pull-request head.':'Policy satisfied.'};
}
