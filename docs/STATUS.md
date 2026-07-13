# Estado del MVP

Actualizado: 2026-07-12

## Completado

- Fundación Next.js, TypeScript estricto, Tailwind, ESLint y configuración shadcn/ui.
- Constante central `SITE_NAME`.
- Clientes Supabase browser/server y renovación de sesión.
- Acciones reales de login, registro y recuperación de contraseña.
- Guards de servidor para usuario, staff y admin.
- Estructura completa de rutas públicas, de cuenta y staff.
- Migración inicial con enum de estados, historial, funciones controladas, RLS y Storage privado.
- Estados vacíos sin datos simulados.

## Próxima fase

- Conectar un proyecto Supabase y aplicar la migración.
- Generar tipos TypeScript desde la base.
- Construir creación/edición de anuncios y subida ordenada de medios.
- Implementar consultas, búsqueda y filtros del catálogo.
- Construir flujo editorial y pruebas de integración de RLS/transiciones.

## Verificación

Los resultados finales de lint, typecheck y build se registran en la entrega de la sesión.
