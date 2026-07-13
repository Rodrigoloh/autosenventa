import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/app/auth-actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const message = params.registered === "1"
    ? { text: "Revisa tu correo para confirmar la cuenta.", kind: "success" as const }
    : params.reset === "sent"
      ? { text: "Si la cuenta existe, enviamos un enlace de recuperación.", kind: "success" as const }
      : params.signedOut === "1"
        ? { text: "Tu sesión se cerró correctamente.", kind: "success" as const }
        : params.error
          ? { text: "No fue posible iniciar sesión con esos datos.", kind: "error" as const }
          : undefined;
  return <AuthForm title="Iniciar sesión" action={signIn} submitLabel="Ingresar" footer={{ href: "/recuperar-password", label: "Olvidé mi contraseña" }} message={message} />;
}
