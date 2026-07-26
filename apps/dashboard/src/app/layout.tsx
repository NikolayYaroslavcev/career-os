import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import { getServerLocale } from '@/lib/i18n/get-server-locale';
import { ThemeProvider, themeInitScript } from '@/lib/theme/theme-provider';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'CareerOS - AI Career Operating System',
  description: 'Your personal AI career assistant',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const locale = await getServerLocale();

  return (
    <html lang={locale} suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider initialLocale={locale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
