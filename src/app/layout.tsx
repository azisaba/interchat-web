import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import React from "react";
import {SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import {Toaster} from "@/components/ui/sonner";
import InterchatStreamConnector from "@/components/interchat-stream-connector";
import ThemeProvider from "@/components/theme-provider";

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
            <InterchatStreamConnector />
            <AppSidebar />
            <main className="w-full p-4">
              <SidebarTrigger />
              {children}
              <Toaster />
            </main>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
