"use client";

import {
  CircleHelp,
  KeyRound,
  LogOut,
  Moon,
  Monitor,
  Save,
  Sun,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { useTheme, type ThemeChoice } from "@/components/theme-provider";
import { Button, Field } from "@/components/ui";

interface SettingsResponse {
  profile: { name: string; email: string };
  preferences: { theme: "LIGHT" | "DARK" | "SYSTEM" };
}

const themes: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "–"
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">(
    "success",
  );

  useEffect(() => {
    const controller = new AbortController();
    async function loadSettings() {
      try {
        const response = await fetch("/api/settings", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("SETTINGS_UNAVAILABLE");
        }
        const settings = (await response.json()) as SettingsResponse;
        setName(settings.profile.name);
        setEmail(settings.profile.email);
        setTheme(settings.preferences.theme.toLowerCase() as ThemeChoice);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setMessageTone("error");
        setMessage("Settings could not be loaded. Refresh the page to retry.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    void loadSettings();
    return () => controller.abort();
  }, [setTheme]);

  async function updateSettings(
    input: { name?: string; theme?: SettingsResponse["preferences"]["theme"] },
    successMessage: string,
  ): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error("SETTINGS_UPDATE_FAILED");
      }
      const settings = (await response.json()) as SettingsResponse;
      setName(settings.profile.name);
      setEmail(settings.profile.email);
      setMessageTone("success");
      setMessage(successMessage);
      return true;
    } catch {
      setMessageTone("error");
      setMessage(
        "Changes could not be saved. Check your connection and retry.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateSettings({ name }, "Profile saved.");
  }

  async function selectTheme(nextTheme: ThemeChoice) {
    if (saving || nextTheme === theme) {
      return;
    }
    const previousTheme = theme;
    setTheme(nextTheme);
    const saved = await updateSettings(
      {
        theme:
          nextTheme.toUpperCase() as SettingsResponse["preferences"]["theme"],
      },
      "Theme saved.",
    );
    if (!saved) {
      setTheme(previousTheme);
    }
  }

  return (
    <AppShell title="Settings">
      {loading ? (
        <section className="empty-state" aria-live="polite">
          <h2>Loading settings…</h2>
          <p>Your profile and theme preferences are being retrieved.</p>
        </section>
      ) : (
        <div className="settings-grid">
          <form className="settings-panel profile-panel" onSubmit={saveProfile}>
            <h2>Profile</h2>
            <div className="avatar-row">
              <div className="avatar" aria-label={`Initials for ${name}`}>
                {initials(name)}
              </div>
            </div>
            <Field label="Name" required>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={120}
                required
              />
            </Field>
            <Field label="Email" hint="Email cannot be changed here.">
              <input value={email} type="email" disabled />
            </Field>
            <Button
              type="submit"
              icon={<Save size={17} aria-hidden="true" />}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
          <div className="settings-column">
            <section className="settings-panel">
              <h2>Appearance</h2>
              <p className="section-label">Theme</p>
              <div className="theme-grid">
                {themes.map(({ value, label, icon: Icon }) => (
                  <button
                    className={`theme-option ${theme === value ? "theme-option-active" : ""}`}
                    key={value}
                    type="button"
                    onClick={() => void selectTheme(value)}
                    aria-pressed={theme === value}
                    disabled={saving}
                  >
                    <Icon size={28} aria-hidden="true" />
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>
              <p className="field-hint">
                The selected theme is saved to your account.
              </p>
            </section>
            <section className="settings-panel" id="support">
              <h2>Account &amp; support</h2>
              <InformationRow
                icon={<KeyRound aria-hidden="true" />}
                title="Email and password"
                description="Your account uses first-party P.A.T.C.H. authentication."
              />
              <InformationRow
                icon={<CircleHelp aria-hidden="true" />}
                title="Help & support"
                description="Contact your administrator for account or workspace support."
              />
              <Button
                variant="secondary"
                icon={<LogOut size={17} aria-hidden="true" />}
                onClick={() => void signOut({ callbackUrl: "/sign-in" })}
              >
                Sign out
              </Button>
            </section>
            {message ? (
              <p
                className={`form-message form-message-${messageTone}`}
                role={messageTone === "error" ? "alert" : "status"}
              >
                {message}
              </p>
            ) : null}
          </div>
          <section className="settings-panel preview-panel">
            <h2>
              Preview (
              {theme === "dark"
                ? "Dark"
                : theme === "light"
                  ? "Light"
                  : "System"}{" "}
              theme)
            </h2>
            <div className="preview-shell" aria-hidden="true">
              <strong>P.A.T.C.H.</strong>
              <div className="preview-content">
                <h3>Workspace</h3>
                <div className="preview-stat">
                  Navigation
                  <br />
                  <b>Ready</b>
                </div>
                <div className="preview-stat">
                  Theme
                  <br />
                  <b>{theme}</b>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function InformationRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="support-row">
      {icon}
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </div>
  );
}
