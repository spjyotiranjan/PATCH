"use client";

import { LockKeyhole, UserPlus } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Field } from "@/components/ui";

interface ApiErrorBody {
  error?: { code?: string };
}

export default function SignUpPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
        setMessage(
          body.error?.code === "EMAIL_ALREADY_REGISTERED"
            ? "An account already exists for this email. Sign in instead."
            : "We could not create your account. Check the fields and try again.",
        );
        return;
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result?.ok) {
        router.replace("/sign-in");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setMessage("Account creation is temporarily unavailable. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-up-heading">
        <div className="auth-brand">P.A.T.C.H.</div>
        <div className="auth-icon" aria-hidden="true">
          <LockKeyhole size={24} />
        </div>
        <h1 id="sign-up-heading">Create your account</h1>
        <p>Enter your name, email, and password to get started.</p>
        <form onSubmit={submit}>
          <Field label="Name" required>
            <input name="name" autoComplete="name" maxLength={120} required />
          </Field>
          <Field label="Email" required>
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </Field>
          <Field label="Password" hint="Use 8 to 128 characters." required>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </Field>
          <Field label="Confirm password" required>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </Field>
          {message ? (
            <p className="form-message form-message-error" role="alert">
              {message}
            </p>
          ) : null}
          <Button
            type="submit"
            icon={<UserPlus size={18} aria-hidden="true" />}
            disabled={submitting}
          >
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
