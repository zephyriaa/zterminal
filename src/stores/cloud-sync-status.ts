"use client";
import { create } from "zustand";
export const useCloudSyncStatus = create<{ status: string }>(() => ({ status: "Cloud not checked" }));
