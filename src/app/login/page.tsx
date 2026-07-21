import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/app/auth-actions";
import { getViewer } from "@/lib/auth";
import { defaultPathForRole, safeInternalPath } from "@/lib/auth-policy";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const requestedNext = typeof params.next === "string" ? params.next : null;
  if (viewer) redirect(safeInternalPath(requestedNext, defaultPathForRole(viewer.role)));
  const message = params.registered === "1"
    ? { text: "Revisa tu correo para confirmar la cuenta.", kind: "success" as const }
    : params.reset === "sent"
      ? { text: "Si la cuenta existe, enviamos un enlace de recuperación.", kind: "success" as const }
      : params.signedOut === "1"
        ? { text: "Tu sesión se cerró correctamente.", kind: "success" as const }
        : params.error
          ? { text: "No fue posible iniciar sesión con esos datos.", kind: "error" as const }
          : undefined;
  return <AuthForm title="Iniciar sesión" action={signIn} submitLabel="Ingresar" footer={{ href: "/recuperar-password", label: "Olvidé mi contraseña" }} message={message} hidden={requestedNext ? { next: requestedNext } : undefined} />;
}
