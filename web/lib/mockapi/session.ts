export const PATCH_MOCK_MODE = true;

const SESSION_KEY = "patch-demo-session";
const PROFILE_KEY = "patch-demo-profile";

export type MockSession = {
  authenticated: true;
  name: string;
  email: string;
};

const DEFAULT_SESSION: MockSession = {
  authenticated: true,
  name: "Alex Morgan",
  email: "alex@patch.local",
};

export function getMockSession(): MockSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as MockSession;

    if (!parsed.authenticated) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function startMockSession(
  profile?: Partial<
    Pick<MockSession, "name" | "email">
  >,
) {
  if (typeof window === "undefined") {
    return;
  }

  const session: MockSession = {
    ...DEFAULT_SESSION,
    ...profile,
    authenticated: true,
  };

  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session),
  );

  window.localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      name: session.name,
      email: session.email,
    }),
  );
}

export function endMockSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
}

export function getMockProfile() {
  if (typeof window === "undefined") {
    return {
      name: DEFAULT_SESSION.name,
      email: DEFAULT_SESSION.email,
    };
  }

  const raw = window.localStorage.getItem(PROFILE_KEY);

  if (!raw) {
    return {
      name: DEFAULT_SESSION.name,
      email: DEFAULT_SESSION.email,
    };
  }

  try {
    return JSON.parse(raw) as {
      name: string;
      email: string;
    };
  } catch {
    return {
      name: DEFAULT_SESSION.name,
      email: DEFAULT_SESSION.email,
    };
  }
}

export function saveMockProfile(input: {
  name?: string;
  email?: string;
}) {
  const current = getMockProfile();

  const next = {
    ...current,
    ...input,
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify(next),
    );

    const session = getMockSession();

    if (session) {
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...session,
          ...next,
        }),
      );
    }
  }

  return next;
}