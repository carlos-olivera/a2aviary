const svg=document.querySelector('.canvas svg');
const views={all:[0,0,1220,2166],website:[0,0,960,185],email:[0,210,1220,1015],operator:[0,1310,1220,390],planned:[0,1790,1220,375]};
for(const button of document.querySelectorAll('[data-view]')) {
  button.disabled=false;
  button.addEventListener('click',()=>{
    svg.setAttribute('viewBox',views[button.dataset.view].join(' '));
    for(const control of document.querySelectorAll('[data-view]')) control.setAttribute('aria-pressed',String(control===button));
    document.querySelector('.canvas').scrollLeft=0;
  });
}
const toggle=document.getElementById('local-toggle');toggle.disabled=false;
toggle.addEventListener('change',()=>svg.classList.toggle('local-highlight',toggle.checked));
for(const node of svg.querySelectorAll('[data-node-id]')) {
  node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-expanded','false');
  const detail=document.getElementById('detail-'+node.dataset.nodeId);
  const open=()=>{detail.open=true;detail.querySelector('summary').focus();detail.scrollIntoView({block:'nearest',behavior:'instant'});};
  node.addEventListener('click',open);
  node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
  detail.addEventListener('toggle',()=>node.setAttribute('aria-expanded',String(detail.open)));
}
