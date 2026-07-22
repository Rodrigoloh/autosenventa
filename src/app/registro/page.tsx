import { RegistrationForm } from "@/components/registration-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  return <RegistrationForm error={error as Parameters<typeof RegistrationForm>[0]["error"]} />;
}
