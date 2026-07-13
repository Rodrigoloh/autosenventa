import { AuthForm } from "@/components/auth-form";
import { signUp } from "@/app/auth-actions";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const message = params.error ? { text: "No fue posible crear la cuenta con esos datos.", kind: "error" as const } : undefined;
  return <AuthForm title="Crear cuenta" action={signUp} submitLabel="Registrarme" footer={{ href: "/login", label: "Ya tengo una cuenta" }} message={message} />;
}
