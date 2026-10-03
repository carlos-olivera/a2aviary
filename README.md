# a2aviary

Agencia web autónoma diseñada para trabajar con el asistente del cliente: el humano define objetivos y autoriza acciones, su agente prepara el encargo y la agencia produce y gestiona el sitio.

Dominio elegido: **a2aviary.io**. El dominio no implica que exista un servicio desplegado.

## Estado

Proyecto en fase de diseño. Esta primera versión conserva la visión, las decisiones y el alcance del piloto. Todavía no contiene una aplicación ejecutable, una API operativa ni un sitio desplegado.

El proyecto nace con licencia Apache 2.0 desde su primer commit. El objetivo es desarrollar en público y publicar el repositorio; la publicación remota es un paso separado de la preparación local.

## Recorrido previsto

1. El cliente entrega objetivos y materiales a su propio agente.
2. El agente prepara un brief con fuentes, dudas y criterios de aceptación.
3. La agencia valida acceso, mandato, presupuesto e insumos.
4. La agencia construye una preview y recibe revisiones.
5. Las aprobaciones y la entrega quedan registradas en el proyecto.
6. El trabajo puede retomarse después de una interrupción mediante identificadores estables y reautenticación.

## Principios

- Autonomía dentro de permisos y presupuesto acordados.
- Preparación de materiales primero del lado del agente cliente.
- Estado del negocio independiente del chat y del runtime de IA.
- Integración inicial mediante skill y API; estándar A2A pendiente de elección.
- Operaciones asíncronas e idempotentes.
- Código abierto y ejemplos ficticios; datos y materiales de clientes privados.
- Calidad, costos y esfuerzo de soporte medidos con un piloto.

## Documentación

- [Visión y alcance](docs/vision.md)
- [Arquitectura propuesta](docs/architecture/overview.md)
- [Decisiones y preguntas abiertas](docs/decisions/README.md)
- [Roadmap y piloto Teco](docs/roadmap.md)
- [Identidad visual en exploración](docs/brand.md)
- [Desarrollo en público](docs/build-in-public.md)
- [Cómo contribuir](CONTRIBUTING.md)
- [Reporte de vulnerabilidades](SECURITY.md)
- [Historial de avances](CHANGELOG.md)

## Organización del trabajo

Este repositorio es la fuente de verdad del código, los contratos y la documentación técnica. El Espacio a2aviary se utiliza para conversaciones, decisiones de producto y seguimiento; las decisiones que afectan la implementación se trasladan a documentos versionados.

Las referencias específicas de cada máquina y del Espacio privado pueden mantenerse en `.local/`, excluido de Git. No hay sincronización automática entre la carpeta y el Espacio.

## Licencia

Apache License 2.0. Consulta [LICENSE](LICENSE). Las dependencias conservan sus propias licencias. Los permisos de uso del nombre, logo y materiales de clientes deben documentarse por separado; esta licencia no concede derechos sobre activos de terceros.
