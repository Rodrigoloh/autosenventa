"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth-actions";

type UserMenuProps = {
  username: string | null;
  displayName: string | null;
  role: "user" | "staff" | "admin";
};

const roleLabels = { user: "Usuario", staff: "Staff", admin: "Admin" } as const;

export function UserMenu({ username, displayName, role }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusAfterOpen = useRef<"first" | "last" | null>(null);
  const identity = username ? `@${username}` : displayName || "Mi cuenta";

  function menuItems() {
    return Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  useEffect(() => {
    if (!open || !focusAfterOpen.current) return;
    const items = menuItems();
    const target = focusAfterOpen.current === "last" ? items.at(-1) : items[0];
    focusAfterOpen.current = null;
    target?.focus();
  }, [open]);

  useEffect(() => {
    function closeFromOutside(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeFromEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !open) return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [open]);

  function openFromKeyboard(position: "first" | "last") {
    focusAfterOpen.current = position;
    setOpen(true);
  }

  function handleMenuKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = menuItems();
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
        : event.key === "ArrowDown" ? (current + 1) % items.length
          : (current <= 0 ? items.length : current) - 1;
    items[next]?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Menú de usuario: ${identity}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); openFromKeyboard("first"); }
          if (event.key === "ArrowUp") { event.preventDefault(); openFromKeyboard("last"); }
        }}
        className="flex cursor-pointer items-center gap-2 font-bold text-zinc-200 transition-colors hover:text-white"
      >
        <span className="grid size-9 place-items-center rounded-full border border-white/15 bg-zinc-900 text-white">
          {(username ?? displayName ?? "U").slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{identity}</span>
      </button>
      {open ? (
        <div
          id="user-menu"
          role="menu"
          aria-label="Opciones de usuario"
          onKeyDown={handleMenuKeys}
          className="public-raised absolute right-0 z-20 mt-3 w-60 border public-rule p-4 text-zinc-100 shadow-2xl shadow-black/50"
        >
          <p className="font-black">{username ? `@${username}` : "Usuario sin username"}</p>
          {displayName ? <p className="text-sm text-zinc-400">{displayName}</p> : null}
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{roleLabels[role]}</p>
          <div className="mt-4 flex flex-col gap-3 border-t public-rule pt-4">
            <Link role="menuitem" href="/cuenta" onClick={() => setOpen(false)} className="hover:text-orange-400">Mi cuenta</Link>
            {role !== "user" ? <Link role="menuitem" href="/staff" onClick={() => setOpen(false)} className="hover:text-orange-400">Panel staff</Link> : null}
            <form action={signOut}>
              <button role="menuitem" type="submit" className="font-medium hover:text-orange-400">Cerrar sesión</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
