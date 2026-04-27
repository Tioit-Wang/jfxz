"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserProfile } from "@/api";

const AdminProfileContext = createContext<UserProfile | null>(null);

export function AdminProfileProvider({
  children,
  profile,
}: Readonly<{ children: ReactNode; profile: UserProfile | null }>) {
  return <AdminProfileContext.Provider value={profile}>{children}</AdminProfileContext.Provider>;
}

export function useAdminProfile() {
  return useContext(AdminProfileContext);
}
