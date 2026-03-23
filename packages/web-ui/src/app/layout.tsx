import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout'
import { ThemeProvider } from '@/components/theme'
import { NotificationProvider, ToastContainer } from '@/components/notifications'

export const metadata: Metadata = {
  title: 'APEX Dashboard',
  description: 'Autonomous Product Engineering eXecutor - AI-powered development team automation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NotificationProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto bg-background">
                {children}
              </main>
            </div>
            <ToastContainer />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
