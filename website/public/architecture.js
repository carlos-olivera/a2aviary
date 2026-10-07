const panel = document.getElementById('stage-panel');
const body = document.getElementById('stage-body');
const tabs = [...document.querySelectorAll('[data-stage-tab]')];
const macroNodes = [...document.querySelectorAll('.overview [data-stage-trigger]')];
const announcement = document.getElementById('stage-announcement');
const compact = matchMedia('(max-width:640px)');
const orientTabs = () => document.querySelector('.stage-tabs').setAttribute('aria-orientation', compact.matches ? 'vertical' : 'horizontal');
compact.addEventListener('change', orientTabs); orientTabs();
let activeStage, opener;
function activate(stage, trigger, focusHeading = false) {
  const template = document.getElementById('template-' + stage);
  if (!template || activeStage === stage) return;
  activeStage = stage; opener = trigger;
  body.replaceChildren(template.content.cloneNode(true));
  panel.hidden = false;
  panel.setAttribute('aria-labelledby', 'tab-' + stage);
  for (const tab of tabs) {
    const selected = tab.dataset.stageTab === stage;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
  }
  for (const node of macroNodes) node.setAttribute('aria-expanded', String(node.dataset.stageTrigger === stage));
  for (const node of body.querySelectorAll('[data-node-id]')) {
    node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button'); node.setAttribute('aria-expanded', 'false');
    const details = document.getElementById('detail-' + node.dataset.nodeId);
    const open = () => { details.open = true; details.querySelector('summary').focus(); details.scrollIntoView({block:'nearest'}); };
    node.addEventListener('click', open);
    node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    details.addEventListener('toggle', () => node.setAttribute('aria-expanded', String(details.open)));
  }
  for (const button of body.querySelectorAll('[data-stage-trigger]')) {
    button.disabled = false;
    button.addEventListener('click', () => activate(button.dataset.stageTrigger, document.getElementById('tab-' + button.dataset.stageTrigger), true));
  }
  const title = document.getElementById('stage-title-' + stage);
  announcement.textContent = title.textContent + ' details opened.';
  if (focusHeading) { title.focus({preventScroll:true}); panel.scrollIntoView({block:'start'}); }
}
for (const [index, tab] of tabs.entries()) {
  tab.disabled = false;
  tab.addEventListener('click', () => activate(tab.dataset.stageTab, tab));
  tab.addEventListener('keydown', event => {
    const next = {ArrowRight:(index+1)%tabs.length,ArrowLeft:(index-1+tabs.length)%tabs.length,ArrowDown:(index+1)%tabs.length,ArrowUp:(index-1+tabs.length)%tabs.length,Home:0,End:tabs.length-1}[event.key];
    if (next !== undefined) { event.preventDefault(); tabs[next].focus(); activate(tabs[next].dataset.stageTab, tabs[next]); }
  });
}
for (const node of macroNodes) {
  node.setAttribute('tabindex','0'); node.setAttribute('role','button'); node.setAttribute('aria-expanded','false');
  const select = () => activate(node.dataset.stageTrigger, node, true);
  node.addEventListener('click', select);
  node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
}
document.getElementById('back-overview').addEventListener('click', () => {
  const fallback = document.getElementById('tab-' + activeStage);
  const restore = opener?.getClientRects().length ? opener : fallback;
  activeStage = undefined; panel.hidden = true; body.replaceChildren(); panel.removeAttribute('aria-labelledby');
  for (const [index, tab] of tabs.entries()) { tab.setAttribute('aria-selected','false'); tab.tabIndex = index === 0 ? 0 : -1; }
  for (const node of macroNodes) node.setAttribute('aria-expanded','false');
  announcement.textContent = 'Architecture overview. Stage details closed.';
  restore?.focus({preventScroll:true}); document.getElementById('overview-title').scrollIntoView({block:'start'});
});
document.getElementById('local-toggle').addEventListener('change', event => document.body.classList.toggle('local-highlight', event.target.checked));
