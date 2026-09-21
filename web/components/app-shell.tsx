"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  ChevronUp,
  CircleHelp,
  FileText,
  FolderKanban,
  Home,
  Menu,
  MessageCircle,
  Plus,
  Settings,
  Wrench,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  PATCH_MOCK_MODE,
  getMockSession,
} from "@/lib/mockapi/session";

const primaryItems = [
  {
    href: "/",
    label: "Home",
    icon: Home,
  },
  {
    href: "/equipments",
    label: "Equipments",
    icon: Wrench,
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
  },
  {
    href: "/documents",
    label: "Documents",
    icon: FileText,
  },
];

const sessionsToday = [
  {
    id: "filler-02-pressure",
    title: "Filler 02 pressure...",
    time: "10:42 AM",
  },
  {
    id: "conveyor-11-alignment",
    title: "Conveyor 11 alignment",
    time: "9:37 AM",
  },
  {
    id: "line-3-lockout",
    title: "Line 3 lockout review",
    time: "8:58 AM",
  },
  {
    id: "capper-04-torque",
    title: "Capper 04 torque",
    time: "8:12 AM",
  },
];

const sessionsYesterday = [
  {
    id: "palletizer-02-cycle",
    title: "Palletizer 02 cycle",
    time: "Yesterday",
  },
  {
    id: "boiler-feed-pump",
    title: "Boiler feed pump",
    time: "Yesterday",
  },
];

const sessionsEarlier = [
  {
    id: "vision-system-lighting",
    title: "Vision system lighting",
    time: "Tue",
  },
];

function NavItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Home;
}) {
  const pathname = usePathname();

  const active =
    href === "/"
      ? pathname === "/"
      : pathname.startsWith(href);

  return (
    <Link
      className={[
        "nav-item",
        active ? "nav-item-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      href={href}
      aria-current={
        active ? "page" : undefined
      }
    >
      <Icon
        size={17}
        strokeWidth={1.7}
      />

      <span>{label}</span>
    </Link>
  );
}

export function AppSidebar({
  open = false,
  onNavigate,
}: {
  open?: boolean;
  onNavigate?: () => void;
} = {}) {
  const pathname = usePathname();

  function handleClick(
    event: React.MouseEvent<HTMLElement>,
  ) {
    if (!onNavigate) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest("a")) {
      onNavigate();
    }
  }

  return (
    <aside
      className={[
        "app-sidebar",
        open ? "app-sidebar-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Workspace navigation"
      onClick={handleClick}
    >
      <Link
        className="brand"
        href="/"
        aria-label="P.A.T.C.H. home"
      >
        P.A.T.C.H.
      </Link>

      <nav
        className="sidebar-primary"
        aria-label="Primary navigation"
      >
        {primaryItems.map((item) => (
          <NavItem
            key={item.href}
            {...item}
          />
        ))}
      </nav>

      <div className="sidebar-divider" />

      <section
        className="chat-nav"
        aria-label="Chat sessions"
      >
        <div className="chat-heading">
          <NavItem
            href="/chat"
            label="Chat"
            icon={MessageCircle}
          />

          <ChevronUp
            size={14}
            aria-hidden="true"
          />
        </div>

        <Link
          className="new-chat"
          href="/chat/new"
        >
          <Plus size={16} />
          New chat
        </Link>

        <p className="session-group-label">
          Today
        </p>

        {sessionsToday.map((item) => {
          const itemHref = `/chat/${item.id}`;

          const isSelected =
            pathname === itemHref ||
            (pathname === "/chat" &&
              item.id ===
                "filler-02-pressure");

          return (
            <Link
              className={[
                "session-item",
                isSelected
                  ? "session-item-selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              href={itemHref}
              key={item.id}
            >
              <MessageCircle size={16} />

              <span>{item.title}</span>

              <time>{item.time}</time>
            </Link>
          );
        })}

        <p className="session-group-label">
          Yesterday
        </p>

        {sessionsYesterday.map((item) => {
          const itemHref = `/chat/${item.id}`;

          const isSelected =
            pathname === itemHref;

          return (
            <Link
              className={[
                "session-item",
                isSelected
                  ? "session-item-selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              href={itemHref}
              key={item.id}
            >
              <MessageCircle size={16} />

              <span>{item.title}</span>

              <time>{item.time}</time>
            </Link>
          );
        })}

        <p className="session-group-label">
          Earlier this week
        </p>

        {sessionsEarlier.map((item) => {
          const itemHref = `/chat/${item.id}`;

          const isSelected =
            pathname === itemHref;

          return (
            <Link
              className={[
                "session-item",
                isSelected
                  ? "session-item-selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              href={itemHref}
              key={item.id}
            >
              <MessageCircle size={16} />

              <span>{item.title}</span>

              <time>{item.time}</time>
            </Link>
          );
        })}
      </section>

      <div className="sidebar-bottom">
        <NavItem
          href="/settings"
          label="Settings"
          icon={Settings}
        />

        <Link
          className="nav-item"
          href="/settings#support"
        >
          <CircleHelp
            size={17}
            strokeWidth={1.7}
          />

          <span>Help &amp; support</span>
        </Link>
      </div>
    </aside>
  );
}

export function PageTitleBar({
  title,
  status,
  actions,
}: {
  title: string;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-title-bar">
      <div className="title-group">
        <h1>{title}</h1>
        {status}
      </div>

      {actions ? (
        <div className="title-actions">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function AppShell({
  title,
  status,
  actions,
  children,
}: {
  title: string;
  status?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const {
    status: nextAuthStatus,
  } = useSession();

  const pathname = usePathname();
  const router = useRouter();

  const [mockReady, setMockReady] =
    useState(!PATCH_MOCK_MODE);

  const [
    mockAuthenticated,
    setMockAuthenticated,
  ] = useState(false);

  const [mobileNavOpen, setMobileNavOpen] =
    useState(false);

  useEffect(() => {
    if (!PATCH_MOCK_MODE) {
      return;
    }

    function hydrateMockSession() {
      const session =
        getMockSession();

      setMockAuthenticated(
        Boolean(session),
      );

      setMockReady(true);
    }

    hydrateMockSession();
  }, []);

  // Close the mobile drawer on route changes.
  useEffect(() => {
    function closeMobileNav() {
      setMobileNavOpen(false);
    }

    closeMobileNav();
  }, [pathname]);

  useEffect(() => {
    if (PATCH_MOCK_MODE) {
      if (
        mockReady &&
        !mockAuthenticated
      ) {
        router.replace(
          `/sign-in?callbackUrl=${encodeURIComponent(
            pathname,
          )}`,
        );
      }

      return;
    }

    if (
      nextAuthStatus ===
      "unauthenticated"
    ) {
      router.replace(
        `/sign-in?callbackUrl=${encodeURIComponent(
          pathname,
        )}`,
      );
    }
  }, [
    mockAuthenticated,
    mockReady,
    nextAuthStatus,
    pathname,
    router,
  ]);

  if (PATCH_MOCK_MODE) {
    if (
      !mockReady ||
      !mockAuthenticated
    ) {
      return (
        <main
          className="session-state"
          aria-live="polite"
        >
          <p>
            {!mockReady
              ? "Loading your workspace…"
              : "Redirecting to sign in…"}
          </p>
        </main>
      );
    }
  } else if (
    nextAuthStatus !==
    "authenticated"
  ) {
    return (
      <main
        className="session-state"
        aria-live="polite"
      >
        <p>
          {nextAuthStatus ===
          "loading"
            ? "Loading your workspace…"
            : "Redirecting to sign in…"}
        </p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
      >
        Skip to content
      </a>

      <AppSidebar
        open={mobileNavOpen}
        onNavigate={() =>
          setMobileNavOpen(false)
        }
      />

      {mobileNavOpen ? (
        <button
          className="sidebar-backdrop sidebar-backdrop-open"
          type="button"
          aria-label="Close navigation"
          onClick={() =>
            setMobileNavOpen(false)
          }
        />
      ) : null}

      <div className="workspace">
        <div className="mobile-nav-bar">
          <button
            className="icon-button"
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            onClick={() =>
              setMobileNavOpen(true)
            }
          >
            <Menu
              size={20}
              aria-hidden="true"
            />
          </button>

          <span
            className="mobile-nav-brand"
            aria-hidden="true"
          >
            P.A.T.C.H.
          </span>
        </div>

        <PageTitleBar
          title={title}
          status={status}
          actions={actions}
        />

        <main
          className="page-content"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AppShell title={title}>
      <section className="empty-state">
        <BookOpen size={28} />

        <h2>{title} is ready for a later phase</h2>

        <p>{description}</p>
      </section>
    </AppShell>
  );
}