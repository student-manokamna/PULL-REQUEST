import React from "react"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { requireAuth } from "@/module/utils/auth-utils"

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  // ✅ Get the logged-in user from server
 await requireAuth()

  return (
    <SidebarProvider>
      {/* Pass user to sidebar */}
      <AppSidebar />

      <SidebarInset>
        <header className="flex h-16 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-xl font-semibold">Dashboard</h1>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardLayout
