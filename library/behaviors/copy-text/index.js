export default (element, context) => {
  const control = element.querySelector('.copy-control');
  if (!control) return;
  const link = element.querySelector('.primary-contact').querySelector('a');
  const status = element.querySelector('.copy-status');
  const copied = element.querySelector('.copied-message').textContent;
  const manual = element.querySelector('.manual-message').textContent;
  element.querySelectorAll('.card-control').forEach((button) => {
    button.addEventListener('blur', (event) => {
      status.textContent = '';
    });
    button.addEventListener('click', (event) => {
      status.textContent = '';
    });
  });
  control.addEventListener('click', (event) => {
    status.textContent = '';
    context.copyText(link, manual, (success) => {
      status.textContent = success ? copied : manual;
    });
  });
};
