import { AuthForm } from "@/components/auth-form"; import { signUp } from "@/app/auth-actions";
export default function RegisterPage() { return <AuthForm title="Crear cuenta" action={signUp} submitLabel="Registrarme" footer={{ href: "/login", label: "Ya tengo una cuenta" }} />; }
