export const STAFF_LISTING_VIEWS = [
  "all",
  "pending",
  "in-review",
  "mine",
  "changes-requested",
  "published",
  "paused",
] as const;

export type StaffListingView = (typeof STAFF_LISTING_VIEWS)[number];

export const STAFF_LISTING_VIEW_COPY: Record<StaffListingView, {
  title: string;
  empty: string;
  countLabel: (count: number) => string;
}> = {
  all: {
    title: "Todas las revisiones",
    empty: "No hay anuncios activos en revisión.",
    countLabel: (count) => `${count} ${count === 1 ? "anuncio activo" : "anuncios activos"}`,
  },
  pending: {
    title: "Pendientes de revisión",
    empty: "No hay anuncios esperando revisión.",
    countLabel: (count) => `${count} ${count === 1 ? "anuncio esperando atención" : "anuncios esperando atención"}`,
  },
  "in-review": {
    title: "En revisión",
    empty: "No hay anuncios en revisión.",
    countLabel: (count) => `${count} ${count === 1 ? "anuncio en revisión" : "anuncios en revisión"}`,
  },
  mine: {
    title: "Mis revisiones activas",
    empty: "No tienes revisiones activas.",
    countLabel: (count) => `${count} ${count === 1 ? "revisión asignada a ti" : "revisiones asignadas a ti"}`,
  },
  "changes-requested": {
    title: "Cambios solicitados",
    empty: "No hay anuncios con cambios solicitados.",
    countLabel: (count) => `${count} ${count === 1 ? "anuncio esperando correcciones" : "anuncios esperando correcciones"}`,
  },
  published: {
    title: "Publicados",
    empty: "No hay anuncios publicados.",
    countLabel: (count) => `${count} ${count === 1 ? "anuncio publicado" : "anuncios publicados"}`,
  },
  paused: {
    title: "Publicaciones pausadas",
    empty: "No hay publicaciones pausadas.",
    countLabel: (count) => `${count} ${count === 1 ? "publicación pausada" : "publicaciones pausadas"}`,
  },
};

export function parseStaffListingView(value: unknown): StaffListingView | null {
  if (value === undefined) return "all";
  if (typeof value !== "string") return null;
  return STAFF_LISTING_VIEWS.includes(value as StaffListingView) ? value as StaffListingView : null;
}

export function staffListingViewHref(view: StaffListingView) {
  return view === "all" ? "/staff/anuncios" : `/staff/anuncios?view=${view}`;
}
