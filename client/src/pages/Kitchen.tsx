import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, queryString } from '../api'
import { Empty, Field, Icon, Loading, Modal, StationBadge, StatusBadge, useToast } from '../components/ui'
import {
  STATIONS,
  STATION_LABEL,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  dateLabel,
  elapsed,
  minutesSince,
  todayISO,
} from '../lib/format'
import type { KitchenTicket, KitchenTicketItem, Station, TicketStatus } from '../types'

const PRIORITY_LABEL: Record<number, string> = { 0: 'Normal', 1: 'High', 2: 'Rush' }

export function Kitchen() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [date, setDate] = useState(todayISO())
  const [station, setStation] = useState<'all' | Station>('all')
  const [showServed, setShowServed] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<KitchenTicket | null>(null)

  const ticketsQuery = useQuery({
    queryKey: ['tickets', date, station],
    queryFn: () => api.get<KitchenTicket[]>(`/kitchen/tickets${queryString({ date, station })}`),
    refetchInterval: 15_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  const fail = (error: unknown) => toast((error as Error).message, 'error')

  const patchTicket = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch<KitchenTicket>(`/kitchen/tickets/${id}`, patch),
    onSuccess: invalidate,
    onError: fail,
  })

  const removeTicket = useMutation({
    mutationFn: (id: string) => api.delete(`/kitchen/tickets/${id}`),
    onSuccess: () => {
      invalidate()
      toast('Ticket deleted')
    },
    onError: fail,
  })

  const addItem = useMutation({
    mutationFn: ({ ticketId, name, quantity }: { ticketId: string; name: string; quantity: number }) =>
      api.post<KitchenTicket>(`/kitchen/tickets/${ticketId}/items`, { name, quantity }),
    onSuccess: invalidate,
    onError: fail,
  })

  const patchItem = useMutation({
    mutationFn: ({
      ticketId,
      itemId,
      patch,
    }: {
      ticketId: string
      itemId: string
      patch: Partial<KitchenTicketItem>
    }) => api.patch<KitchenTicket>(`/kitchen/tickets/${ticketId}/items/${itemId}`, patch),
    onSuccess: invalidate,
    onError: fail,
  })

  const removeItem = useMutation({
    mutationFn: ({ ticketId, itemId }: { ticketId: string; itemId: string }) =>
      api.delete<KitchenTicket>(`/kitchen/tickets/${ticketId}/items/${itemId}`),
    onSuccess: invalidate,
    onError: fail,
  })

  const tickets = ticketsQuery.data ?? []
  const visible = showServed ? tickets : tickets.filter((ticket) => ticket.status !== 'served')

  const columns = TICKET_STATUSES.filter((status) => showServed || status !== 'served')

  return (
    <>
      <header className="topbar">
        <div className="topbar__title">
          <span className="topbar__eyebrow">Kitchen</span>
          <h1>Ticket board</h1>
        </div>
        <div className="topbar__actions">
          <input
            className="input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value || todayISO())}
            style={{ width: 152 }}
            aria-label="Business date"
          />
          <select
            className="select"
            value={station}
            onChange={(event) => setStation(event.target.value as 'all' | Station)}
            aria-label="Station"
            style={{ width: 132 }}
          >
            <option value="all">All stations</option>
            {STATIONS.map((value) => (
              <option key={value} value={value}>
                {STATION_LABEL[value]}
              </option>
            ))}
          </select>
          <label className="row small muted" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={showServed}
              onChange={(event) => setShowServed(event.target.checked)}
            />
            Served
          </label>
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New ticket
          </button>
        </div>
      </header>

      <div className="content">
        <div className="row" style={{ marginBottom: 14 }}>
          <p className="small muted">
            {dateLabel(date)} · {visible.length} ticket{visible.length === 1 ? '' : 's'} · codes are
            editable
          </p>
          <div className="spacer" />
          <div className="legend">
            <span>⏱ 15 min+ late</span>
            <span>↑ priority</span>
          </div>
        </div>

        {ticketsQuery.isPending ? (
          <Loading />
        ) : ticketsQuery.isError ? (
          <Empty>Could not reach the API. Is the server running on port 4000?</Empty>
        ) : (
          <div className="board">
            {columns.map((status) => {
              const columnTickets = visible.filter((ticket) => ticket.status === status)
              return (
                <section key={status} className={`column column--${status}`}>
                  <div className="column__head">
                    <div className="column__title">{TICKET_STATUS_LABEL[status]}</div>
                    <span className="column__count">{columnTickets.length}</span>
                  </div>
                  <div className="column__body">
                    {columnTickets.length === 0 ? (
                      <p className="small muted" style={{ padding: '10px 4px' }}>
                        Nothing here.
                      </p>
                    ) : (
                      columnTickets.map((ticket) => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          onPatch={(patch) => patchTicket.mutate({ id: ticket.id, patch })}
                          onEdit={() => setEditing(ticket)}
                          onDelete={() => {
                            if (window.confirm(`Delete ticket ${ticket.ticketCode}?`)) {
                              removeTicket.mutate(ticket.id)
                            }
                          }}
                          onToggleItem={(item) =>
                            patchItem.mutate({
                              ticketId: ticket.id,
                              itemId: item.id,
                              patch: { done: !item.done },
                            })
                          }
                          onRemoveItem={(item) =>
                            removeItem.mutate({ ticketId: ticket.id, itemId: item.id })
                          }
                          onAddItem={(name, quantity) =>
                            addItem.mutate({ ticketId: ticket.id, name, quantity })
                          }
                        />
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {creating ? (
        <NewTicketModal
          date={date}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            invalidate()
            toast('Ticket created')
          }}
        />
      ) : null}

      {editing ? (
        <EditTicketModal
          ticket={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            invalidate()
            toast('Ticket updated')
          }}
        />
      ) : null}
    </>
  )
}

/* ------------------------------ ticket card ------------------------------ */

function TicketCard({
  ticket,
  onPatch,
  onEdit,
  onDelete,
  onToggleItem,
  onRemoveItem,
  onAddItem,
}: {
  ticket: KitchenTicket
  onPatch: (patch: Record<string, unknown>) => void
  onEdit: () => void
  onDelete: () => void
  onToggleItem: (item: KitchenTicketItem) => void
  onRemoveItem: (item: KitchenTicketItem) => void
  onAddItem: (name: string, quantity: number) => void
}) {
  const [code, setCode] = useState(ticket.ticketCode)
  const [editingCode, setEditingCode] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState('')

  useEffect(() => setCode(ticket.ticketCode), [ticket.ticketCode])

  const late = minutesSince(ticket.firedAt) >= 15 && ticket.status !== 'served'
  const doneCount = ticket.items.filter((item) => item.done).length

  const commitCode = () => {
    setEditingCode(false)
    const next = code.trim()
    if (!next || next === ticket.ticketCode) {
      setCode(ticket.ticketCode)
      return
    }
    onPatch({ ticketCode: next })
  }

  const submitItem = () => {
    const name = newItem.trim()
    if (!name) {
      setAdding(false)
      return
    }
    onAddItem(name, 1)
    setNewItem('')
  }

  const nextStatus: Partial<Record<TicketStatus, TicketStatus>> = {
    queued: 'preparing',
    preparing: 'ready',
    ready: 'served',
  }

  return (
    <article
      className={`ticket ticket--${ticket.status} ticket--priority-${ticket.priority}`}
    >
      <div className="ticket__head">
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingCode ? (
            <input
              className="input ticket__code-input"
              value={code}
              autoFocus
              onChange={(event) => setCode(event.target.value)}
              onBlur={commitCode}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitCode()
                if (event.key === 'Escape') {
                  setCode(ticket.ticketCode)
                  setEditingCode(false)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="ticket__code"
              title="Click to edit the ticket code"
              onClick={() => setEditingCode(true)}
            >
              {ticket.ticketCode}
            </button>
          )}
          <div className="ticket__sub">
            <StationBadge station={ticket.station} />
            <span className="ticket__meta">
              {ticket.orderCode ? <span>order {ticket.orderCode}</span> : <span>walk-in</span>}
              <span>·</span>
              <span>{dateLabel(ticket.businessDate).replace(/,.*/, '')}</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          title={`Priority: ${PRIORITY_LABEL[ticket.priority]} — click to change`}
          onClick={() => onPatch({ priority: (ticket.priority + 1) % 3 })}
        >
          <span
            className="mono"
            style={{ color: ticket.priority ? 'var(--danger)' : 'var(--muted)', fontWeight: 700 }}
          >
            {ticket.priority ? '!'.repeat(ticket.priority) : '·'}
          </span>
        </button>
      </div>

      <div className={`ticket-view ${late ? 'ticket-view--late' : ''}`}>
        <span>
          <Icon name="clock" size={11} /> {elapsed(ticket.firedAt)}
        </span>
        <span>
          {doneCount}/{ticket.items.length} done
        </span>
      </div>

      <ul className="ticket__items">
        {ticket.items.map((item) => (
          <li key={item.id} className={`ticket-item ${item.done ? 'ticket-item--done' : ''}`}>
            <input
              type="checkbox"
              className="ticket-item__check"
              checked={item.done}
              onChange={() => onToggleItem(item)}
              aria-label={`Mark ${item.name} done`}
            />
            <span className="ticket-item__qty">{item.quantity}×</span>
            <span className="ticket-item__name">
              {item.name}
              {item.notes ? <div className="ticket-item__note">{item.notes}</div> : null}
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              title="Remove item"
              onClick={() => onRemoveItem(item)}
            >
              <Icon name="close" size={13} />
            </button>
          </li>
        ))}

        {adding ? (
          <li className="row" style={{ gap: 6, paddingTop: 4 }}>
            <input
              className="input"
              autoFocus
              placeholder="Item name"
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitItem()
                if (event.key === 'Escape') {
                  setAdding(false)
                  setNewItem('')
                }
              }}
            />
            <button type="button" className="btn btn--sm" onClick={submitItem}>
              Add
            </button>
          </li>
        ) : null}
      </ul>

      {ticket.notes ? (
        <p className="small" style={{ padding: '0 12px 8px', color: 'var(--warn)' }}>
          {ticket.notes}
        </p>
      ) : null}

      <div className="ticket__foot">
        {nextStatus[ticket.status] ? (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => onPatch({ status: nextStatus[ticket.status] })}
          >
            {ticket.status === 'queued' ? 'Start' : ticket.status === 'preparing' ? 'Ready' : 'Served'}
          </button>
        ) : (
          <span className="badge badge--neutral">{TICKET_STATUS_LABEL[ticket.status]}</span>
        )}
        <button type="button" className="btn btn--sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={13} /> item
        </button>
        <div className="spacer" />
        <button type="button" className="btn btn--ghost btn--icon" title="Edit ticket" onClick={onEdit}>
          <Icon name="edit" size={14} />
        </button>
        <button type="button" className="btn btn--ghost btn--icon" title="Delete ticket" onClick={onDelete}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </article>
  )
}

/* ------------------------------- modals -------------------------------- */

function NewTicketModal({
  date,
  onClose,
  onCreated,
}: {
  date: string
  onClose: () => void
  onCreated: () => void
}) {
  const toast = useToast()
  const [businessDate, setBusinessDate] = useState(date)
  const [station, setStation] = useState<Station>('kitchen')
  const [priority, setPriority] = useState(0)
  const [notes, setNotes] = useState('')
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)

  const preview = useQuery({
    queryKey: ['next-code', businessDate],
    queryFn: () =>
      api.get<{ preview: string }>(`/kitchen/next-code${queryString({ date: businessDate })}`),
  })

  const submit = async () => {
    setSaving(true)
    try {
      await api.post<KitchenTicket>('/kitchen/tickets', {
        businessDate,
        station,
        priority,
        notes,
        items: itemName.trim() ? [{ name: itemName.trim(), quantity }] : [],
      })
      onCreated()
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="New kitchen ticket"
      subtitle={preview.data ? `Next code: ${preview.data.preview}` : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={saving}>
            Create ticket
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Service date">
          <input
            className="input"
            type="date"
            value={businessDate}
            onChange={(event) => setBusinessDate(event.target.value)}
          />
        </Field>
        <Field label="Station">
          <select
            className="select"
            value={station}
            onChange={(event) => setStation(event.target.value as Station)}
          >
            {STATIONS.map((value) => (
              <option key={value} value={value}>
                {STATION_LABEL[value]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Priority" hint="Rush tickets surface first on the board.">
        <select
          className="select"
          value={priority}
          onChange={(event) => setPriority(Number(event.target.value))}
        >
          <option value={0}>Normal</option>
          <option value={1}>High</option>
          <option value={2}>Rush</option>
        </select>
      </Field>

      <div className="grid-2">
        <Field label="First item">
          <input
            className="input"
            value={itemName}
            placeholder="e.g. Ribeye 300g"
            onChange={(event) => setItemName(event.target.value)}
          />
        </Field>
        <Field label="Quantity">
          <input
            className="input"
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          className="textarea"
          value={notes}
          placeholder="Allergies, timing, plating…"
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
    </Modal>
  )
}

function EditTicketModal({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: KitchenTicket
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [businessDate, setBusinessDate] = useState(ticket.businessDate)
  const [ticketCode, setTicketCode] = useState(ticket.ticketCode)
  const [station, setStation] = useState<Station>(ticket.station)
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [priority, setPriority] = useState(ticket.priority)
  const [notes, setNotes] = useState(ticket.notes)
  const [saving, setSaving] = useState(false)

  const dateChanged = businessDate !== ticket.businessDate
  const codeTouched = ticketCode.trim() !== ticket.ticketCode

  const submit = async () => {
    setSaving(true)
    try {
      const patch: Record<string, unknown> = { businessDate, station, status, priority, notes }
      if (codeTouched && ticketCode.trim()) patch.ticketCode = ticketCode.trim()
      await api.patch<KitchenTicket>(`/kitchen/tickets/${ticket.id}`, patch)
      onSaved()
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Edit ticket"
      subtitle={`Created ${dateLabel(ticket.businessDate)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={saving}>
            Save changes
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Service date" hint={dateChanged ? 'A new day sequence will be issued.' : undefined}>
          <input
            className="input"
            type="date"
            value={businessDate}
            onChange={(event) => setBusinessDate(event.target.value)}
          />
        </Field>
        <Field
          label="Ticket code"
          hint={dateChanged && !codeTouched ? 'Leave blank to regenerate from the new date.' : undefined}
        >
          <input
            className="input input--mono"
            value={ticketCode}
            onChange={(event) => setTicketCode(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid-2">
        <Field label="Station">
          <select
            className="select"
            value={station}
            onChange={(event) => setStation(event.target.value as Station)}
          >
            {STATIONS.map((value) => (
              <option key={value} value={value}>
                {STATION_LABEL[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value as TicketStatus)}
          >
            {TICKET_STATUSES.map((value) => (
              <option key={value} value={value}>
                {TICKET_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Priority">
        <select
          className="select"
          value={priority}
          onChange={(event) => setPriority(Number(event.target.value))}
        >
          <option value={0}>Normal</option>
          <option value={1}>High</option>
          <option value={2}>Rush</option>
        </select>
      </Field>

      <Field label="Notes">
        <textarea
          className="textarea"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>

      <div className="card" style={{ padding: 0 }}>
        <div className="card__head">
          <h3>Items ({ticket.items.length})</h3>
          <StatusBadge status={ticket.status} />
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Qty</th>
              <th>Item</th>
              <th>Done</th>
            </tr>
          </thead>
          <tbody>
            {ticket.items.map((item) => (
              <tr key={item.id}>
                <td className="num">{item.quantity}</td>
                <td>{item.name}</td>
                <td>{item.done ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
