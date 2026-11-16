import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/feedback";
import { ServiceWorker } from "@/components/ServiceWorker";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: { default: "AB Prompt Studio", template: "%s · AB Prompt Studio" },
  description: "Transforma ideias em projetos estruturados, arquiteturas e prompts profissionais para qualquer modelo de IA.",
  applicationName: "AB Prompt Studio",
  appleWebApp: { capable: true, title: "AB Prompt Studio", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0a0a0b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <ToastProvider>
          <div className="lg:flex">
            <Sidebar />
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
              <div className="mx-auto max-w-6xl">{children}</div>
            </main>
          </div>
        </ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
