// Reviewed browser runtime. Packages never receive globals or a general async API.
export const behaviorLoader = String.raw`(behaviors, properties, motion) => {
  const media=matchMedia('(prefers-reduced-motion: reduce)'), pointer=matchMedia('(hover: hover) and (pointer: fine)');
  for (const root of document.querySelectorAll('[data-behavior]')) {
    const original=root.innerHTML, touched=new Map(), controller=new AbortController(); let epoch=0, fallback=null, current=false;
    const invalidate=()=>{epoch++;for(const status of root.querySelectorAll('[data-behavior-status]'))status.textContent='';};
    root.addEventListener('click',invalidate,true);
    root.addEventListener('keydown',invalidate,true);
    root.addEventListener('blur',invalidate,true);
    const reset=()=>{for(const [element,keys] of touched)for(const [key,rule] of keys)element.style.setProperty(key,rule.initial+rule.unit);};
    const preference=()=>{if(media.matches || !pointer.matches || motion==='none')reset();};
    media.addEventListener('change',preference);pointer.addEventListener('change',preference);
    let ok=true;
    for (const id of root.dataset.behavior.split(' ')) {
      const context={
        listen(element,event,callback){element.addEventListener(event,e=>{current=e.isTrusted && ['click','keydown','keyup'].includes(e.type);try{callback(e);}finally{current=false;}},{signal:controller.signal});},
        get reducedMotion(){return motion==='none'||media.matches;},
        get finePointer(){return pointer.matches;},
        get motionIntensity(){return motion==='expressive'?1:motion==='subtle'?0.35:0;},
        setProperty(element,key,value){
          const rule=properties[id]?.[key];
          if(!rule || !(element===root||root.contains(element)) || typeof value!=='number' || !Number.isFinite(value))return;
          if(context.reducedMotion||!context.finePointer)value=rule.initial;
          if(!touched.has(element))touched.set(element,new Map());touched.get(element).set(key,rule);
          element.style.setProperty(key,Math.max(rule.min,Math.min(rule.max,value))+rule.unit);
        },
        copyText(link,label,done){
          if(!current || !(link instanceof HTMLAnchorElement) || !root.contains(link) || typeof label!=='string' || !label.trim())return;
          const token=++epoch;
          const url=new URL(link.href);let text=url.href;
          if(['mailto:','tel:'].includes(url.protocol)){text=url.pathname;try{text=decodeURIComponent(text);}catch{}}
          if(!['mailto:','tel:','https:',location.protocol].includes(url.protocol))return;
          const finish=success=>{
            if(token!==epoch || !root.isConnected)return;
            if(!success){
              if(!fallback){fallback=document.createElement('input');fallback.readOnly=true;fallback.type='text';fallback.className='copy-fallback';root.append(fallback);}
              fallback.hidden=false;fallback.value=text;fallback.setAttribute('aria-label',label);fallback.focus();fallback.select();
            } else if(fallback)fallback.hidden=true;
            done(success);
          };
          try{if(!navigator.clipboard?.writeText)throw Error();navigator.clipboard.writeText(text).then(()=>finish(true),()=>finish(false));}catch{finish(false);}
        }
      };
      try { behaviors[id](root,context); } catch {ok=false;break;}
    }
    if(ok){root.classList.add('behavior-ready');if(motion==='expressive')root.classList.add('motion-expressive');if(motion==='none')root.classList.add('motion-none');for(const control of root.querySelectorAll('[data-behavior-control]'))control.hidden=false;}
    else {controller.abort();reset();root.innerHTML=original;root.classList.remove('behavior-ready','motion-expressive');}
  }
}`;
