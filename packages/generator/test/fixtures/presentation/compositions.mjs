import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const compositionNames = ['dark-en', 'light-es', 'contrast-es'];
export const shells = {
  en: {
    skipLink: 'Skip to content',
    primaryNavigationLabel: 'Main navigation',
    footerNavigationLabel: 'Footer navigation',
    notFoundTitle: 'Page unavailable',
    notFoundText: 'This fictional page could not be found.',
    notFoundHomeLabel: 'Return home',
  },
  es: {
    skipLink: 'Ir al contenido',
    primaryNavigationLabel: 'Navegación principal',
    footerNavigationLabel: 'Navegación del pie',
    notFoundTitle: 'Página no disponible',
    notFoundText: 'No se encontró esta página ficticia.',
    notFoundHomeLabel: 'Volver al inicio',
  },
};
export async function composition(
  name,
  { image = true, contact = true, length = 'normal', fonts } = {},
) {
  if (!compositionNames.includes(name))
    throw Error('unknown_presentation_composition');
  const es = name !== 'dark-en',
    language = es ? 'es' : 'en';
  const spec = JSON.parse(
    await readFile(
      new URL(
        '../../../../../contracts/site/2.2.0/examples/site-spec.json',
        import.meta.url,
      ),
    ),
  );
  spec.language = language;
  spec.shell = structuredClone(shells[language]);
  spec.cms = { collections: [] };
  const palette = {
    'dark-en': [
      '#101820',
      '#17232F',
      '#F7FAFC',
      '#C2CFDB',
      '#9FD9FF',
      '#FBCB85',
      '#7C94AC',
    ],
    'light-es': [
      '#FCFAF5',
      '#FFFFFF',
      '#17252E',
      '#455866',
      '#174D74',
      '#823E13',
      '#6C7881',
    ],
    'contrast-es': [
      '#000000',
      '#000000',
      '#FFFFFF',
      '#FFFFFF',
      '#FFFF00',
      '#00FFFF',
      '#FFFFFF',
    ],
  }[name];
  spec.tokens = {
    colors: Object.fromEntries(
      [
        'background',
        'surface',
        'text',
        'muted',
        'primary',
        'accent',
        'border',
      ].map((slot, i) => [slot, palette[i]]),
    ),
    fonts:
      fonts ??
      {
        'dark-en': {
          heading: 'Space Grotesk',
          body: 'Inter',
          mono: 'JetBrains Mono',
        },
        'light-es': {
          heading: 'EB Garamond',
          body: 'Inter',
          mono: 'system-mono',
        },
        'contrast-es': {
          heading: 'system-sans',
          body: 'system-serif',
          mono: 'system-mono',
        },
      }[name],
    spacing: 24,
    radius: 16,
    layout: 'flush',
    motion: 'expressive',
  };
  const props = {
    name: es ? 'Iria Nube' : 'Robin Vale',
    role: es
      ? 'Objetos para imaginar otros mundos'
      : 'Objects for imagining other worlds',
    links: [
      {
        label: es ? 'Colección de muestras' : 'Sample collection',
        url: 'https://example.com/work',
      },
      { label: es ? 'Conversar' : 'Conversation', url: 'tel:+12025550123' },
    ],
    flipLabel: es ? 'Ver contacto' : 'View contact',
    backLabel: es ? 'Volver a la presentación' : 'Back to introduction',
  };
  if (contact)
    Object.assign(props, {
      primaryContact: {
        label: es ? 'Correo del estudio' : 'Studio email',
        url: 'mailto:studio@example.com',
      },
      copyLabel: es ? 'Copiar dirección' : 'Copy address',
      copiedLabel: es ? 'Dirección copiada' : 'Address copied',
      manualCopyLabel: es
        ? 'Copia la dirección seleccionada con el teclado'
        : 'Copy the selected address with your keyboard',
    });
  const assets = {};
  spec.assets = [];
  if (image) {
    const bytes = await readFile(new URL('./sculpture.webp', import.meta.url));
    const id = 'fictional-sculpture';
    spec.assets = [
      {
        id,
        format: 'webp',
        width: 320,
        height: 320,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        alt: es
          ? 'Escultura ficticia de cerámica con arco y esfera'
          : 'Fictional ceramic sculpture with an arch and sphere',
      },
    ];
    assets[id] = bytes.toString('base64');
    props.image = id;
  }
  if (length === 'minimum') {
    props.name = 'R';
    props.role = 'A';
  }
  if (length === 'maximum') {
    props.name = (
      es
        ? 'Nombre ficticio para probar el ajuste del texto. '
        : 'Fictional name for checking long content wrapping. '
    )
      .repeat(4)
      .slice(0, 120);
    props.role = (
      es
        ? 'Descripción ficticia que permite verificar contenido extenso y accesible. '
        : 'Fictional description for checking long accessible content without truncation. '
    )
      .repeat(10)
      .slice(0, 500);
  }
  const link = (label, sectionId) => ({ label, pageId: 'home', sectionId });
  spec.navigation = {
    primary: [
      link(es ? 'Presentación' : 'Introduction', 'intro'),
      link(es ? 'Proceso' : 'Process', 'process'),
      link(es ? 'Contacto' : 'Contact', 'contact'),
    ],
    footer: [
      {
        label: es ? 'Archivo de ejemplo' : 'Example archive',
        url: 'https://example.com/archive',
      },
    ],
  };
  spec.pages = [
    {
      id: 'home',
      path: '/',
      seo: {
        title: es
          ? 'Iria Nube — estudio ficticio'
          : 'Robin Vale — fictional studio',
        description: es
          ? 'Composición ficticia para verificar una biblioteca reutilizable.'
          : 'Fictional composition verifying a reusable presentation library.',
      },
      sections: [
        {
          id: 'intro',
          effects: ['aurora'],
          blocks: [
            {
              id: 'identity',
              component: 'profile-card',
              variant: 'flip-3d',
              props,
            },
          ],
        },
        {
          id: 'services',
          blocks: [
            {
              id: 'services-grid',
              component: 'feature-grid',
              variant: 'standard',
              effects: ['glow-border', 'reveal'],
              props: {
                heading: es ? 'Posibilidades' : 'Possibilities',
                items: [
                  {
                    heading: es ? 'Objetos' : 'Objects',
                    text: es
                      ? 'Explorar formas, materiales y nuevas preguntas.'
                      : 'Explore forms, materials, and new questions.',
                  },
                  {
                    heading: es ? 'Relatos' : 'Stories',
                    text: es
                      ? 'Dar espacio a ideas que todavía no existen.'
                      : 'Make room for ideas that do not exist yet.',
                  },
                ],
              },
            },
            {
              id: 'sample-links',
              component: 'link-cards',
              variant: 'standard',
              effects: ['glow-border', 'reveal'],
              props: {
                heading: es ? 'Muestras' : 'Samples',
                items: [
                  {
                    heading: es ? 'Un archivo abierto' : 'An open archive',
                    text: es
                      ? 'Proyectos completamente ficticios.'
                      : 'Entirely fictional projects.',
                    link: {
                      label: es ? 'Explorar' : 'Explore',
                      url: 'https://example.com/samples',
                    },
                  },
                ],
              },
            },
          ],
        },
        {
          id: 'process',
          blocks: [
            {
              id: 'process-steps',
              component: 'steps',
              variant: 'timeline',
              props: {
                heading: es ? 'Cómo empieza una idea' : 'How an idea starts',
                items: [
                  {
                    heading: es ? 'Escuchar' : 'Listen',
                    text: es
                      ? 'Conversamos sobre la intención.'
                      : 'We talk about the intention.',
                  },
                  {
                    heading: es ? 'Probar' : 'Try',
                    text: es
                      ? 'Creamos una primera muestra.'
                      : 'We create a first sample.',
                  },
                  {
                    heading: es ? 'Compartir' : 'Share',
                    text: es
                      ? 'Revisamos juntos el resultado.'
                      : 'We review the result together.',
                  },
                ],
              },
            },
          ],
        },
        {
          id: 'contact',
          blocks: [
            {
              id: 'contact-action',
              component: 'cta',
              variant: 'standard',
              effects: ['shimmer'],
              props: {
                heading: es ? 'Imaginemos algo' : 'Let us imagine something',
                text: es
                  ? 'Este sitio es una demostración ficticia, sin servicios a la venta.'
                  : 'This is a fictional demonstration, with no services for sale.',
                action: {
                  label: es ? 'Escribir al estudio' : 'Write to the studio',
                  url: 'mailto:studio@example.com',
                },
              },
            },
          ],
        },
      ],
    },
  ];
  if (length === 'minimum') {
    for (const key of [
      'flipLabel',
      'backLabel',
      'copyLabel',
      'copiedLabel',
      'manualCopyLabel',
    ])
      if (props[key]) props[key] = 'A';
    props.links = [{ label: 'A', url: 'https://example.com/' }];
    if (props.primaryContact) props.primaryContact.label = 'A';
    for (const section of spec.pages[0].sections)
      for (const block of section.blocks) {
        if (block.props.heading) block.props.heading = 'A';
        if (block.props.text) block.props.text = 'A';
        if (block.props.items) {
          block.props.items = [block.props.items[0]];
          block.props.items[0].heading = 'A';
          block.props.items[0].text = 'A';
          if (block.props.items[0].link) block.props.items[0].link.label = 'A';
        }
        if (block.props.action) block.props.action.label = 'A';
      }
    for (const key of Object.keys(spec.shell)) spec.shell[key] = 'A';
    for (const asset of spec.assets) asset.alt = 'A';
  }
  if (length === 'maximum') {
    const fill = (value, max) => {
      const seed = value + ' ';
      return seed.repeat(Math.ceil(max / seed.length)).slice(0, max - 1) + 'x';
    };
    for (const key of [
      'flipLabel',
      'backLabel',
      'copyLabel',
      'copiedLabel',
      'manualCopyLabel',
    ])
      if (props[key]) props[key] = fill(props[key], 500);
    for (const l of props.links) l.label = fill(l.label, 80);
    if (props.primaryContact)
      props.primaryContact.label = fill(props.primaryContact.label, 80);
    for (const section of spec.pages[0].sections)
      for (const block of section.blocks) {
        if (block.props.heading)
          block.props.heading = fill(block.props.heading, 120);
        if (block.props.text) block.props.text = fill(block.props.text, 500);
        if (block.props.items)
          block.props.items = Array.from({ length: 12 }, (_, i) => {
            const item = structuredClone(
              block.props.items[i % block.props.items.length],
            );
            item.heading = fill(item.heading, 120);
            item.text = fill(item.text, 2000);
            if (item.link) item.link.label = fill(item.link.label, 80);
            return item;
          });
        if (block.props.action)
          block.props.action.label = fill(block.props.action.label, 80);
      }
    for (const [key, value] of Object.entries(spec.shell))
      spec.shell[key] = fill(
        value,
        key === 'notFoundText' ? 500 : key === 'notFoundTitle' ? 120 : 80,
      );
    for (const asset of spec.assets) asset.alt = fill(asset.alt, 240);
  }
  return { slug: 'fictional-' + name, spec, assets };
}
