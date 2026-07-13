import { AuthForm } from "@/components/auth-form"; import { resetPassword } from "@/app/auth-actions";
export default function ResetPage() { return <AuthForm title="Recuperar contraseña" action={resetPassword} submitLabel="Enviar enlace" password={false} footer={{ href: "/login", label: "Volver a iniciar sesión" }} />; }
