"use client";

import { LockKeyhole, LogIn, Mail, MessageCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { Button, Field } from "@/components/ui";

function safeCallbackUrl(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sessionExpired = searchParams.get("reason") === "session-expired";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result?.ok) {
        setMessage("The email or password is incorrect. Try again.");
        return;
      }
      router.replace(safeCallbackUrl(searchParams.get("callbackUrl")));
      router.refresh();
    } catch {
      setMessage("Sign-in is temporarily unavailable. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <div className="auth-brand">P.A.T.C.H.</div>
        <div className="auth-icon" aria-hidden="true">
          <LockKeyhole size={24} />
        </div>
        <h1 id="sign-in-heading">
          {sessionExpired ? "Session expired" : "Sign in"}
        </h1>
        <p>
          {sessionExpired
            ? "Your session expired due to inactivity. Sign in again to continue."
            : "Use your P.A.T.C.H. email and password to continue."}
        </p>
        <form onSubmit={submit}>
          <Field label="Email" required>
            <span className="input-with-icon">
              <Mail size={18} aria-hidden="true" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                required
              />
            </span>
          </Field>
          <Field label="Password" required>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            icon={<LogIn size={18} aria-hidden="true" />}
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="auth-switch">
          New to P.A.T.C.H.? <Link href="/sign-up">Create an account</Link>
        </p>
      </section>
      <div className="auth-support" id="support">
        <MessageCircle size={18} aria-hidden="true" /> Help &amp; support
        <span className="visually-hidden">
          Contact your administrator for account support.
        </span>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="session-state" aria-live="polite">
          <p>Loading sign in…</p>
        </main>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
