import { AuthForm } from "@/components/auth-form"; import { signIn } from "@/app/auth-actions";
export default function LoginPage() { return <AuthForm title="Iniciar sesión" action={signIn} submitLabel="Ingresar" footer={{ href: "/recuperar-password", label: "Olvidé mi contraseña" }} />; }
