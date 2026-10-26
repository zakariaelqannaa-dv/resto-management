import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, queryString } from '../api'
import { Field, Icon, Loading, useToast } from '../components/ui'
import { todayISO } from '../lib/format'

interface SettingsPayload {
  kitchen?: { prefix?: string }
}

export function Settings() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [prefix, setPrefix] = useState('K')

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsPayload>('/kitchen/settings'),
  })

  const nextCodeQuery = useQuery({
    queryKey: ['next-code', todayISO()],
    queryFn: () =>
      api.get<{ preview: string }>(`/kitchen/next-code${queryString({ date: todayISO() })}`),
  })

  useEffect(() => {
    const value = settingsQuery.data?.kitchen?.prefix
    if (value) setPrefix(value)
  }, [settingsQuery.data])

  const save = useMutation({
    mutationFn: (value: string) =>
      api.patch<SettingsPayload>('/kitchen/settings', { kitchen: { prefix: value } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['next-code'] })
      toast('Kitchen code prefix saved')
    },
    onError: (error) => toast((error as Error).message, 'error'),
  })

  return (
    <>
      <header className="topbar">
        <div className="topbar__title">
          <span className="topbar__eyebrow">House</span>
          <h1>Settings</h1>
        </div>
      </header>

      <div className="content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <section className="card">
            <div className="card__head">
              <h2>Kitchen ticket codes</h2>
            </div>
            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {settingsQuery.isPending ? (
                <Loading />
              ) : (
                <>
                  <Field
                    label="Code prefix"
                    hint="1–6 letters. New tickets are numbered per service date, e.g. K-261026-007."
                  >
                    <input
                      className="input input--mono"
                      value={prefix}
                      maxLength={6}
                      onChange={(event) => setPrefix(event.target.value.toUpperCase())}
                    />
                  </Field>

                  <div className="row">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => save.mutate(prefix)}
                      disabled={save.isPending || !/^[A-Za-z]{1,6}$/.test(prefix)}
                    >
                      <Icon name="check" size={14} /> Save prefix
                    </button>
                    <span className="small muted">
                      Next code today: <strong className="mono">{nextCodeQuery.data?.preview ?? '—'}</strong>
                    </span>
                  </div>

                  <hr className="hr" />

                  <p className="small muted">
                    Every ticket carries a service date and a day-scoped sequence. Both are editable
                    on the board — changing the date re-issues the sequence so two tickets never
                    share a code.
                  </p>
                </>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2>Database</h2>
            </div>
            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p className="small muted">
                The API runs on an embedded Postgres (PGlite) at <code>server/.data</code>, so no
                server install is needed for development. Set <code>DATABASE_URL</code> in{' '}
                <code>.env</code> to point at a real Postgres — the SQL is identical.
              </p>
              <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                <li>
                  <code>npm run db:migrate</code> — apply migrations
                </li>
                <li>
                  <code>npm run db:seed</code> — demo menu, tables, staff
                </li>
                <li>
                  <code>npm run db:reset</code> — wipe the embedded database
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
