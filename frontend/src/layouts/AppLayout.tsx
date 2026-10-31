import { Outlet } from 'react-router'
import { TopBar } from '../components/TopBar'
import { BottomNav } from '../components/BottomNav'

// Top bar + the current screen (Outlet) + the bottom navigation.
// "bare" is for a screen that arranges its own space, like the messages (the list scrolls, the box to write stays put).
export function AppLayout({ bare = false }: { bare?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className={bare ? 'flex min-h-0 flex-1 flex-col' : 'flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pt-2 pb-6'}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
