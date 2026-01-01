import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import React from "react";
import {SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import {Toaster} from "@/components/ui/sonner";
import ThemeProvider from "@/components/theme-provider";
import InterchatDurableConnector from "@/components/interchat-durable-connector";
import MemberSidebar from "@/components/member-sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ギルドチャット",
  description: "ギルドチャット(InterChat)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <SidebarProvider>
            <InterchatDurableConnector />
            <AppSidebar />
            <main className="w-full p-4">
              <SidebarTrigger />
              {children}
              <Toaster />
            </main>
            <MemberSidebar />
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
