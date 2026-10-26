import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { Empty, Field, Icon, Loading, Modal, StatusBadge, useToast } from '../components/ui'
import type { DiningTable, TableStatus } from '../types'

const NEXT_STATUS: Record<TableStatus, TableStatus> = {
  free: 'seated',
  seated: 'dirty',
  dirty: 'free',
  reserved: 'seated',
}

export function Tables() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<DiningTable | 'new' | null>(null)

  const tablesQuery = useQuery({
    queryKey: ['tables'],
    queryFn: () => api.get<DiningTable[]>('/tables'),
  })

  const tables = tablesQuery.data ?? []
  const zones = [...new Set(tables.map((table) => table.zone))]

  const fail = (error: unknown) => toast((error as Error).message, 'error')
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tables'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  const patchTable = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch<DiningTable>(`/tables/${id}`, patch),
    onSuccess: refresh,
    onError: fail,
  })

  const removeTable = useMutation({
    mutationFn: (id: string) => api.delete(`/tables/${id}`),
    onSuccess: () => {
      refresh()
      toast('Table removed')
    },
    onError: fail,
  })

  return (
    <>
      <header className="topbar">
        <div className="topbar__title">
          <span className="topbar__eyebrow">Floor</span>
          <h1>Tables</h1>
        </div>
        <div className="topbar__actions">
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            <Icon name="plus" /> New table
          </button>
        </div>
      </header>

      <div className="content">
        {tablesQuery.isPending ? (
          <Loading />
        ) : tables.length === 0 ? (
          <Empty>No tables yet. Add the first one to map your floor.</Empty>
        ) : (
          zones.map((zone) => (
            <section key={zone} style={{ marginBottom: 28 }}>
              <div className="row" style={{ marginBottom: 12 }}>
                <h2 style={{ textTransform: 'capitalize' }}>{zone}</h2>
                <span className="small muted">
                  {tables.filter((table) => table.zone === zone).length} tables
                </span>
              </div>
              <div className="table-grid">
                {tables
                  .filter((table) => table.zone === zone)
                  .map((table) => (
                    <article
                      key={table.id}
                      className={`table-tile table-tile--${table.status}`}
                      onClick={() =>
                        patchTable.mutate({ id: table.id, patch: { status: NEXT_STATUS[table.status] } })
                      }
                      title="Click to move to the next status"
                    >
                      <div className="row">
                        <span className="table-tile__label">{table.label}</span>
                        <div className="spacer" />
                        <button
                          type="button"
                          className="btn btn--ghost btn--icon"
                          title="Edit table"
                          onClick={(event) => {
                            event.stopPropagation()
                            setEditing(table)
                          }}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      </div>
                      <div className="small muted">{table.seats} seats</div>
                      <div>
                        <StatusBadge status={table.status} />
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))
        )}

        <p className="small muted">Click a table to cycle its status: free → seated → dirty → free.</p>
      </div>

      {editing ? (
        <TableModal
          table={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
            toast('Table saved')
          }}
          onDelete={
            editing !== 'new'
              ? () => {
                  if (window.confirm(`Delete table ${editing.label}?`)) {
                    removeTable.mutate(editing.id)
                    setEditing(null)
                  }
                }
              : undefined
          }
        />
      ) : null}
    </>
  )
}

function TableModal({
  table,
  onClose,
  onSaved,
  onDelete,
}: {
  table: DiningTable | null
  onClose: () => void
  onSaved: () => void
  onDelete?: () => void
}) {
  const toast = useToast()
  const [label, setLabel] = useState(table?.label ?? '')
  const [seats, setSeats] = useState(table?.seats ?? 2)
  const [zone, setZone] = useState(table?.zone ?? 'main')
  const [status, setStatus] = useState<TableStatus>(table?.status ?? 'free')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!label.trim()) {
      toast('Give the table a label', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = { label: label.trim(), seats, zone: zone.trim() || 'main', status }
      if (table) await api.patch(`/tables/${table.id}`, payload)
      else await api.post('/tables', payload)
      onSaved()
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={table ? `Edit table ${table.label}` : 'New table'}
      onClose={onClose}
      footer={
        <>
          {onDelete ? (
            <button type="button" className="btn btn--danger" onClick={onDelete}>
              Delete
            </button>
          ) : null}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={saving}>
            Save
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Label">
          <input className="input" value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
        <Field label="Seats">
          <input
            className="input"
            type="number"
            min={1}
            max={50}
            value={seats}
            onChange={(event) => setSeats(Number(event.target.value))}
          />
        </Field>
      </div>

      <div className="grid-2">
        <Field label="Zone">
          <input
            className="input"
            value={zone}
            placeholder="main, terrace, bar…"
            onChange={(event) => setZone(event.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value as TableStatus)}
          >
            <option value="free">Free</option>
            <option value="seated">Seated</option>
            <option value="reserved">Reserved</option>
            <option value="dirty">Needs cleaning</option>
          </select>
        </Field>
      </div>
    </Modal>
  )
}
