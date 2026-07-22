"use client";

import { useRef, useState, useTransition } from "react";
import { checkUsernameAvailabilityAction } from "@/app/auth-actions";
import { normalizeUsername, USERNAME_HELP, usernameValidationMessage } from "@/lib/auth-validation";

export function UsernameField({ id, autoComplete = "username", placeholder }: { id: string; autoComplete?: string; placeholder?: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState("");
  const [checking, startChecking] = useTransition();
  const requestVersion = useRef(0);
  const helpId = `${id}-help`;
  const feedbackId = `${id}-feedback`;

  function updateValue(rawValue: string) {
    const normalized = normalizeUsername(rawValue);
    requestVersion.current += 1;
    setValue(normalized);
    setAvailability("");
    setError(normalized ? usernameValidationMessage(normalized) ?? "" : "");
  }

  function checkAvailability() {
    const validationError = usernameValidationMessage(value);
    setError(validationError ?? "");
    setAvailability("");
    if (validationError) return;
    const version = ++requestVersion.current;
    startChecking(async () => {
      const result = await checkUsernameAvailabilityAction(value);
      if (requestVersion.current !== version || result.normalized !== value) return;
      setAvailability(result.message);
    });
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">Username</label>
      <input
        id={id}
        name="username"
        value={value}
        required
        minLength={3}
        maxLength={24}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={`${helpId} ${feedbackId}`}
        onChange={(event) => updateValue(event.target.value)}
        onBlur={checkAvailability}
        className="mt-2 h-12 w-full border bg-white px-3 font-normal"
      />
      <p id={helpId} className="mt-2 text-xs text-stone-600">{USERNAME_HELP}</p>
      <p id={feedbackId} role={error ? "alert" : "status"} className={`mt-2 min-h-5 text-sm font-semibold ${error ? "text-red-700" : ""}`}>
        {error || (checking ? "Comprobando disponibilidad…" : availability)}
      </p>
    </div>
  );
}
