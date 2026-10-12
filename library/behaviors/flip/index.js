export default (element, context) => {
  const front = element.querySelector('.card-front');
  const back = element.querySelector('.card-back');
  const open = element.querySelector('.flip-control');
  const close = element.querySelector('.back-control');
  back.inert = true;
  back.setAttribute('aria-hidden', 'true');
  open.setAttribute('aria-pressed', 'false');
  close.setAttribute('aria-pressed', 'false');
  open.addEventListener('click', (event) => {
    element.classList.add('is-flipped');
    front.classList.remove('is-active');
    back.classList.add('is-active');
    front.inert = true;
    front.setAttribute('aria-hidden', 'true');
    back.inert = false;
    back.removeAttribute('aria-hidden');
    open.setAttribute('aria-pressed', 'true');
    close.setAttribute('aria-pressed', 'true');
    close.focus();
  });
  close.addEventListener('click', (event) => {
    element.classList.remove('is-flipped');
    back.classList.remove('is-active');
    front.classList.add('is-active');
    back.inert = true;
    back.setAttribute('aria-hidden', 'true');
    front.inert = false;
    front.removeAttribute('aria-hidden');
    open.setAttribute('aria-pressed', 'false');
    close.setAttribute('aria-pressed', 'false');
    open.focus();
  });
};
