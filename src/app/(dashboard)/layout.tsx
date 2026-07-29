"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] antialiased selection:bg-[#1E6FD9] selection:text-white">
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />
      <Header 
        isCollapsed={isCollapsed} 
        setIsMobileOpen={setIsMobileOpen}
      />

      <main 
        className={`pt-16 min-h-screen transition-all duration-300 ${
          isCollapsed ? "lg:pl-16" : "lg:pl-64"
        }`}
      >
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] w-full mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}

