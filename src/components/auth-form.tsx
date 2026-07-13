import Link from "next/link";

export function AuthForm({ title, action, submitLabel, password = true, footer, message }: {
  title: string; action: (data: FormData) => Promise<void>; submitLabel: string; password?: boolean; footer?: { href: string; label: string }; message?: { text: string; kind: "success" | "error" };
}) {
  return <main className="mx-auto w-full max-w-md flex-1 px-5 py-20"><h1 className="text-4xl font-black tracking-tight">{title}</h1>{message ? <p role={message.kind === "error" ? "alert" : "status"} className="mt-6 border px-4 py-3 text-sm">{message.text}</p> : null}<form action={action} className="mt-10 space-y-5"><label className="block text-sm font-semibold">Correo<input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full border bg-white px-3 font-normal" /></label>{password ? <label className="block text-sm font-semibold">Contraseña<input name="password" type="password" required minLength={8} autoComplete="current-password" className="mt-2 h-12 w-full border bg-white px-3 font-normal" /></label> : null}<button type="submit" className="h-12 w-full bg-stone-950 text-sm font-bold text-white hover:bg-accent">{submitLabel}</button></form>{footer ? <Link href={footer.href} className="mt-6 inline-block text-sm underline underline-offset-4">{footer.label}</Link> : null}</main>;
}
