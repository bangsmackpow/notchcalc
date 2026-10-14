import { lazy, Suspense, useEffect, useState } from 'react'
import type { Unit } from './geometry/types.ts'
import { useSettings } from './state/settings.ts'
import { useJoint } from './state/joint.ts'
import { useAssembly } from './assembly/store.ts'
import { api } from './lib/api.ts'
import { SingleJoint } from './components/SingleJoint.tsx'
import { AccountMenu } from './components/AccountMenu.tsx'

const Assembly = lazy(() => import('./components/Assembly.tsx').then((m) => ({ default: m.Assembly })))

type Tab = 'single' | 'assembly'

export default function App() {
  const unit = useSettings((s) => s.unit)
  const setUnit = useSettings((s) => s.setUnit)
  const [tab, setTab] = useState<Tab>('single')

  // Shared project link: /?p=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('p')
    if (!id) return
    api
      .getProject(id)
      .then(({ project }) => {
        if (project.data.kind === 'single') {
          useJoint.getState().loadSpec(project.data.spec)
          setTab('single')
        } else {
          useAssembly.getState().load(project.data.assembly)
          setTab('assembly')
        }
      })
      .catch(() => {
        /* ignore bad/private link */
      })
  }, [])

  return (
    <>
      <div className="app-shell min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-bold tracking-tight">notchcalc</h1>
                <p className="text-xs text-slate-500">Pipe &amp; tube notching template generator</p>
              </div>
              <nav className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
                {(
                  [
                    ['single', 'Single joint'],
                    ['assembly', 'Assembly (3D)'],
                  ] as [Tab, string][]
                ).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3 py-1 font-medium ${tab === t ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm">
                {(['in', 'mm'] as Unit[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`rounded-md px-3 py-1 font-medium ${unit === u ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                  >
                    {u === 'in' ? 'inch' : 'mm'}
                  </button>
                ))}
              </div>
              <AccountMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-4">
          {tab === 'single' ? (
            <SingleJoint />
          ) : (
            <Suspense fallback={<div className="p-6 text-slate-400">Loading 3D editor…</div>}>
              <Assembly />
            </Suspense>
          )}
        </main>
      </div>
      <div id="print-area" />
    </>
  )
}
