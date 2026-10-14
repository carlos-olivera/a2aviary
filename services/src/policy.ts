// Unknown paths are sensitive; status and authority sources are never routine.
export const ROUTINE = /^(?:docs\/(?!(?:decisions|evidence|history)(?:\/|$)|release-verification\.md$).+|(?:CHANGELOG|README|COSTS)\.md)$/;
export function policyDecision(files:{filename:string,previous_filename?:string}[],reviews:{user:{login:string},state:string,commit_id:string}[],head:string){
  const sensitive=files.some(f=>!ROUTINE.test(f.filename)||Boolean(f.previous_filename&&!ROUTINE.test(f.previous_filename)));
  const ownerReviews=reviews.filter(r=>r.user.login==='carlos-olivera');
  const latest=ownerReviews.at(-1);
  const approved=latest?.state==='APPROVED' && latest.commit_id===head;
  return {allowed:!sensitive || approved,sensitive,reason:sensitive&&!approved?'Carlos must approve the current pull-request head.':'Policy satisfied.'};
}
