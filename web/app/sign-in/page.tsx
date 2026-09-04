"use client";

import { signIn } from "next-auth/react";
import { LockKeyhole, Mail, MessageCircle, Send, UserRound } from "lucide-react";
import { useState } from "react";
import { Button, Field } from "@/components/ui";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand">P.A.T.C.H.</div><div className="auth-icon"><LockKeyhole size={24} /></div><h1>Session expired</h1><p>For your security, your session has expired due to inactivity. Please sign in again to continue.</p><Button icon={<UserRound size={18} />} onClick={() => void signIn()}>Sign in with SSO</Button><div className="or-divider"><span>OR</span></div><h2>Sign in with your work email</h2><form onSubmit={(event) => { event.preventDefault(); void signIn("credentials", { email, redirect: true, callbackUrl: "/" }); }}><Field label=""><span className="input-with-icon"><Mail size={18} /><input aria-label="Work email" type="email" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></span></Field><Button type="submit" icon={<Send size={18} />}>Send sign-in link</Button></form></section><a className="auth-support" href="/support"><MessageCircle size={18} />Help &amp; support</a></main>;
}