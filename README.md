# Garage

Fundación del MVP de una plataforma curada de automóviles publicados por sus propietarios.

## Desarrollo local

1. Copia `.env.example` a `.env.local` y completa las claves de Supabase.
2. Aplica `supabase/migrations/202607120001_initial_foundation.sql` al proyecto Supabase.
3. Ejecuta `npm install` y `npm run dev`.

## Verificación

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

Consulta `docs/ARCHITECTURE.md` para decisiones técnicas y `docs/STATUS.md` para el avance.
