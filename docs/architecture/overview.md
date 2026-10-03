# Arquitectura propuesta

Estado: propuesta conceptual, sin implementación.

## Responsabilidades

```text
Humano
  ↕ objetivos, materiales, autorizaciones y decisiones
Agente cliente
  ↕ brief, fuentes, solicitudes, resultados y eventos
API de agencia
  ↕ autorización y transiciones de proyecto
Coordinación de trabajo
  ↕ tareas duraderas y producción
Workspace del proyecto y herramientas de ejecución
```

## Componentes previstos

- API versionada para crear proyectos, entregar insumos, consultar estados, responder preguntas y registrar aprobaciones.
- Identidad y autorización por cliente, proyecto y operación.
- Mandato con acciones, presupuesto, vigencia y revocación.
- Estado estructurado y registro de eventos independientes de la sesión del modelo.
- Cola de tareas, reintentos, checkpoints e idempotencia para efectos comerciales.
- Artefactos y versiones con acceso por proyecto.
- Adaptador del runtime de producción para evaluar proveedores sin confundirlos con el estado del negocio.
- Canales de eventos y recuperación que toleren la ausencia del agente cliente.

## Contrato mínimo por definir

Cada intercambio debería identificar versión del esquema, proyecto, tarea, operación, insumos, permisos, estado, próxima acción y entregables. La adopción de un estándar A2A concreto sigue pendiente.

Estados candidatos: recibido, pendiente de insumos, en ejecución, pendiente de aprobación, en revisión, completado, fallido recuperable y cancelado. Sus transiciones y condiciones aún deben especificarse.

## Límites de confianza

El servidor verifica autorización y mandato en cada operación. Archivos, mensajes de agentes y contenido web son datos; no amplían permisos. Las aprobaciones deben vincularse a la versión de alcance o entregable que autorizan.

El Resume Package es una referencia portable para localizar el proyecto y consultar su estado después de autenticarse. Cambiar de agente requiere conceder los permisos correspondientes.

## Por decidir

Lenguaje, base de datos, cola, almacenamiento, runtime de IA, proveedor de identidad, hosting y mecanismos concretos de entrega de eventos. Se elegirán a partir de requisitos del piloto y una prueba reproducible.
