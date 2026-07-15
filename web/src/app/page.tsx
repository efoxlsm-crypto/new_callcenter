"use client";

import { useRef } from "react";
import ChatPanel from "@/components/ChatPanel";
import Dashboard, { type DashboardHandle } from "@/components/Dashboard";

export default function Home() {
  const dashboardRef = useRef<DashboardHandle>(null);

  return (
    <main className="mx-auto flex h-screen max-w-7xl gap-6 p-6">
      <div className="w-[55%]">
        <ChatPanel onTicketAdded={() => dashboardRef.current?.refresh()} />
      </div>
      <div className="w-[45%]">
        <Dashboard ref={dashboardRef} />
      </div>
    </main>
  );
}
