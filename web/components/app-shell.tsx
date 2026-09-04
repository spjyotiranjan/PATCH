"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronUp, CircleHelp, FileText, FolderKanban, Home, MessageCircle, Plus, Settings, Wrench } from "lucide-react";
import type { ReactNode } from "react";

const primaryItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/equipments", label: "Equipments", icon: Wrench },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/documents", label: "Documents", icon: FileText },
];
const sessions = [["Filler O2 pressure instability", "10:42 AM"], ["Conveyor 11 alignment check", "9:37 AM"], ["Line 3 lockout review", "8:58 AM"], ["Capper 04 torque variation", "8:12 AM"]];

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === href : pathname.startsWith(href);
  return <Link className={`nav-item ${active ? "nav-item-active" : ""}`} href={href} aria-current={active ? "page" : undefined}><Icon size={17} strokeWidth={1.7} /><span>{label}</span></Link>;
}

export function AppSidebar() {
  return <aside className="app-sidebar" aria-label="Primary navigation">
    <Link className="brand" href="/" aria-label="P.A.T.C.H. home">P.A.T.C.H.</Link>
    <nav className="sidebar-primary">{primaryItems.map((item) => <NavItem key={item.href} {...item} />)}</nav>
    <div className="sidebar-divider" />
    <section className="chat-nav" aria-label="Chat sessions">
      <div className="chat-heading"><NavItem href="/chat" label="Chat" icon={MessageCircle} /><ChevronUp size={14} aria-hidden="true" /></div>
      <Link className="new-chat" href="/chat"><Plus size={16} />New chat</Link>
      <p className="session-group-label">Today</p>
      {sessions.map(([title, time]) => <Link className="session-item" href="/chat" key={title}><MessageCircle size={16} /><span>{title}</span><time>{time}</time></Link>)}
      <p className="session-group-label">Yesterday</p>
      {[["Palletizer 02 cycle", "Yesterday"], ["Boiler feed pump", "Yesterday"]].map(([title, time]) => <Link className="session-item" href="/chat" key={title}><MessageCircle size={16} /><span>{title}</span><time>{time}</time></Link>)}
      <p className="session-group-label">Earlier this week</p>
      <Link className="session-item" href="/chat"><MessageCircle size={16} /><span>Vision system lighting</span><time>Tue</time></Link>
    </section>
    <div className="sidebar-bottom"><NavItem href="/settings" label="Settings" icon={Settings} /><Link className="nav-item" href="/support"><CircleHelp size={17} strokeWidth={1.7} /><span>Help &amp; support</span></Link></div>
  </aside>;
}

export function PageTitleBar({ title, status, actions }: { title: string; status?: ReactNode; actions?: ReactNode }) {
  return <header className="page-title-bar"><div className="title-group"><h1>{title}</h1>{status}</div>{actions ? <div className="title-actions">{actions}</div> : null}</header>;
}

export function AppShell({ title, status, actions, children }: { title: string; status?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return <div className="app-shell"><AppSidebar /><div className="workspace"><PageTitleBar title={title} status={status} actions={actions} /><main className="page-content">{children}</main></div></div>;
}

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return <AppShell title={title}><section className="empty-state"><BookOpen size={28} /><h2>{title} is ready for a later phase</h2><p>{description}</p></section></AppShell>;
}