// Fictional verification inputs only. No fixture values are part of the registry.
import { composition } from '../presentation/compositions.mjs';
import { getStarter } from '../../src/starters.ts';
export async function profileComposition(name) {
  const input = await composition(name);
  const original = input.spec.pages[0], es = name !== 'dark-en';
  const props = Object.fromEntries(original.sections.flatMap(s => s.blocks).map(b => [b.component,b.props]));
  props['rich-text'] = { content: [{type:'paragraph',text:es ? 'Una identidad completamente ficticia.' : 'An entirely fictional identity.'}] };
  props.gallery = { heading: es ? 'Imágenes del portafolio' : 'Portfolio images', images: input.spec.assets.map(a => a.id) };
  props.contact = { heading: es ? 'Contacto' : 'Contact', text: es ? 'Contacto del estudio ficticio.' : 'Fictional studio contact.', links: [{label:es ? 'Correo' : 'Email',url:'mailto:studio@example.com'}] };
  const page = getStarter('profile','1.0.0',true).seed.pages[0];
  page.path = '/'; page.seo = original.seo;
  for (const section of page.sections) for (const block of section.blocks) block.props = structuredClone(props[block.component]);
  input.spec.pages = [page];
  input.spec.navigation.primary = [{label:es ? 'Presentación' : 'Introduction',pageId:page.id,sectionId:'identity'},{label:es ? 'Contacto' : 'Contact',pageId:page.id,sectionId:'contact'}];
  input.slug = 'fictional-profile-' + name;
  return input;
}
