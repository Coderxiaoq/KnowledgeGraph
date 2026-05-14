import type { PropsWithChildren } from 'react'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-transparent px-6 py-8 text-ink-900 md:px-10 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/45 shadow-[0_30px_120px_rgba(19,26,34,0.14)] backdrop-blur-xl">
        {children}
      </div>
    </div>
  )
}
