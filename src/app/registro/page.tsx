import { RegistrationForm } from "@/components/registration-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <RegistrationForm error={Boolean(params.error)} />;
}
