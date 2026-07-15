"use client";

import { useRef, useState } from "react";
import ChatPanel, { type ChatPanelHandle } from "@/components/ChatPanel";
import Dashboard, { type DashboardHandle } from "@/components/Dashboard";
import Sidebar, { type View } from "@/components/Sidebar";
import SettingsPanel from "@/components/SettingsPanel";
import QuickQuestions from "@/components/QuickQuestions";

export default function Home() {
  const dashboardRef = useRef<DashboardHandle>(null);
  const chatPanelRef = useRef<ChatPanelHandle>(null);
  const [view, setView] = useState<View>("front");

  return (
    <main className="mx-auto flex h-screen max-w-7xl gap-6 p-6">
      <Sidebar view={view} onChange={setView} />

      {view === "front" && (
        <>
          <div className="w-[60%]">
            <ChatPanel ref={chatPanelRef} onTicketAdded={() => dashboardRef.current?.refresh()} />
          </div>
          <div className="w-[40%]">
            <QuickQuestions onSelect={(q) => chatPanelRef.current?.sendQuestion(q)} />
          </div>
        </>
      )}

      {view === "admin" && (
        <div className="flex-1">
          <Dashboard ref={dashboardRef} />
        </div>
      )}

      {view === "settings" && (
        <div className="flex-1">
          <SettingsPanel />
        </div>
      )}
    </main>
  );
}
