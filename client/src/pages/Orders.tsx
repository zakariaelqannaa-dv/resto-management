import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api, queryString } from '../api'
import { Empty, Field, Icon, Loading, Modal, StatusBadge, useToast } from '../components/ui'
import { clock, dateLabel, money, todayISO } from '../lib/format'
import type { DiningTable, MenuItem, Order } from '../types'

export function Orders() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [date, setDate] = useState(todayISO())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const ordersQuery = useQuery({
    queryKey: ['orders', date],
    queryFn: () => api.get<Order[]>(`/orders${queryString({ date })}`),
    refetchInterval: 20_000,
  })

  const tablesQuery = useQuery({
    queryKey: ['tables'],
    queryFn: () => api.get<DiningTable[]>('/tables'),
  })

  const menuQuery = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => api.get<MenuItem[]>('/menu/items'),
  })

  const orders = ordersQuery.data ?? []
  const selected = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? orders[0] ?? null,
    [orders, selectedId],
  )

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: ['tables'] })
  }

  const fail = (error: unknown) => toast((error as Error).message, 'error')

  const addItem = useMutation({
    mutationFn: ({ orderId, menuItemId, quantity, notes }: { orderId: string; menuItemId: string; quantity: number; notes: string }) =>
      api.post<Order>(`/orders/${orderId}/items`, { menuItemId, quantity, notes }),
    onSuccess: invalidate,
    onError: fail,
  })

  const removeItem = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      api.delete<Order>(`/orders/${orderId}/items/${itemId}`),
    onSuccess: invalidate,
    onError: fail,
  })

  const sendToKitchen = useMutation({
    mutationFn: (orderId: string) =>
      api.post<{ tickets: Array<{ ticketCode: string }> }>(`/orders/${orderId}/send-to-kitchen`),
    onSuccess: (data) => {
      invalidate()
      toast(`Sent: ${data.tickets.map((ticket) => ticket.ticketCode).join(', ')}`)
    },
    onError: fail,
  })

  const patchOrder = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch<Order>(`/orders/${id}`, patch),
    onSuccess: () => {
      invalidate()
      toast('Order updated')
    },
    onError: fail,
  })

  const removeOrder = useMutation({
    mutationFn: (id: string) => api.delete(`/orders/${id}`),
    onSuccess: () => {
      invalidate()
      toast('Order deleted')
    },
    onError: fail,
  })

  const pendingCount = (order: Order) => order.items.filter((item) => item.status === 'pending').length

  return (
    <>
      <header className="topbar">
        <div className="topbar__title">
          <span className="topbar__eyebrow">Service</span>
          <h1>Orders</h1>
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
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New order
          </button>
        </div>
      </header>

      <div className="content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
          <section className="card">
            <div className="card__head">
              <h2>{dateLabel(date)}</h2>
              <span className="small muted">{orders.length} orders</span>
            </div>
            {ordersQuery.isPending ? (
              <Loading />
            ) : orders.length === 0 ? (
              <div style={{ padding: 16 }}>
                <Empty>No orders yet. Create one to start a ticket.</Empty>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Table</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedId(order.id)}
                        style={{
                          cursor: 'pointer',
                          background: selected?.id === order.id ? 'var(--accent-soft)' : undefined,
                        }}
                      >
                        <td>
                          <div className="mono" style={{ fontWeight: 600 }}>
                            {order.orderCode}
                          </div>
                          <div className="small muted">
                            {order.items.length} items · {clock(order.openedAt)}
                          </div>
                        </td>
                        <td>{order.tableLabel ?? '—'}</td>
                        <td className="num">{money(order.totalCents)}</td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selected ? (
            <OrderDetail
              order={selected}
              menu={menuQuery.data ?? []}
              onAddItem={(menuItemId, quantity, notes) =>
                addItem.mutate({ orderId: selected.id, menuItemId, quantity, notes })
              }
              onRemoveItem={(itemId) => removeItem.mutate({ orderId: selected.id, itemId })}
              onSend={() => sendToKitchen.mutate(selected.id)}
              onPaid={() => patchOrder.mutate({ id: selected.id, patch: { status: 'paid' } })}
              onCancel={() => patchOrder.mutate({ id: selected.id, patch: { status: 'cancelled' } })}
              onDelete={() => {
                if (window.confirm(`Delete ${selected.orderCode}?`)) removeOrder.mutate(selected.id)
              }}
              pending={pendingCount(selected)}
              busy={sendToKitchen.isPending}
            />
          ) : null}
        </div>
      </div>

      {creating ? (
        <NewOrderModal
          tables={tablesQuery.data ?? []}
          date={date}
          onClose={() => setCreating(false)}
          onCreated={(order) => {
            setCreating(false)
            setSelectedId(order.id)
            invalidate()
            toast(`Order ${order.orderCode} created`)
          }}
        />
      ) : null}
    </>
  )
}

function OrderDetail({
  order,
  menu,
  onAddItem,
  onRemoveItem,
  onSend,
  onPaid,
  onCancel,
  onDelete,
  pending,
  busy,
}: {
  order: Order
  menu: MenuItem[]
  onAddItem: (menuItemId: string, quantity: number, notes: string) => void
  onRemoveItem: (itemId: string) => void
  onSend: () => void
  onPaid: () => void
  onCancel: () => void
  onDelete: () => void
  pending: number
  busy: boolean
}) {
  const [menuItemId, setMenuItemId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const closed = order.status === 'paid' || order.status === 'cancelled'

  return (
    <section className="card">
      <div className="card__head">
        <div>
          <h2 className="mono">{order.orderCode}</h2>
          <p className="small muted">
            {order.tableLabel ? `Table ${order.tableLabel}` : order.type.replace('_', ' ')} ·{' '}
            {order.guests} guest{order.guests === 1 ? '' : 's'} · opened {clock(order.openedAt)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="card__body" style={{ padding: 0 }}>
        {order.items.length === 0 ? (
          <div style={{ padding: 16 }}>
            <Empty>No items yet — add from the menu below.</Empty>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Qty</th>
                <th>Item</th>
                <th>Status</th>
                <th />
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="num">{item.quantity}</td>
                  <td>
                    {item.name}
                    {item.notes ? <div className="small muted">{item.notes}</div> : null}
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    {item.status === 'pending' && !closed ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon"
                        title="Remove item"
                        onClick={() => onRemoveItem(item.id)}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    ) : null}
                  </td>
                  <td className="num">{money(item.unitPriceCents * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>
                  Total
                </td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {money(order.totalCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {!closed ? (
        <div className="card__body" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '2 1 220px' }}>
              <Field label="Add from menu">
                <select
                  className="select"
                  value={menuItemId}
                  onChange={(event) => setMenuItemId(event.target.value)}
                >
                  <option value="">Choose an item…</option>
                  {menu.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {money(item.priceCents)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={{ width: 76 }}>
              <Field label="Qty">
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
            <div style={{ flex: '1 1 140px' }}>
              <Field label="Notes">
                <input
                  className="input"
                  value={notes}
                  placeholder="No onion…"
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>
            </div>
            <button
              type="button"
              className="btn"
              disabled={!menuItemId}
              onClick={() => {
                onAddItem(menuItemId, quantity, notes)
                setMenuItemId('')
                setQuantity(1)
                setNotes('')
              }}
            >
              <Icon name="plus" /> Add
            </button>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={pending === 0 || busy}
              onClick={onSend}
            >
              <Icon name="send" /> Send {pending || ''} to kitchen
            </button>
            <button type="button" className="btn" onClick={onPaid}>
              Mark paid
            </button>
            <button type="button" className="btn btn--danger" onClick={onCancel}>
              Cancel order
            </button>
            <div className="spacer" />
            <button type="button" className="btn btn--ghost btn--icon" title="Delete order" onClick={onDelete}>
              <Icon name="trash" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function NewOrderModal({
  tables,
  date,
  onClose,
  onCreated,
}: {
  tables: DiningTable[]
  date: string
  onClose: () => void
  onCreated: (order: Order) => void
}) {
  const toast = useToast()
  const [tableId, setTableId] = useState('')
  const [type, setType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in')
  const [guests, setGuests] = useState(2)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const order = await api.post<Order>('/orders', {
        tableId: tableId || null,
        type,
        guests,
        notes,
        businessDate: date,
      })
      onCreated(order)
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="New order"
      subtitle={`Service date ${dateLabel(date)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={saving}>
            Create order
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Table">
          <select className="select" value={tableId} onChange={(event) => setTableId(event.target.value)}>
            <option value="">No table</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.label} · {table.seats} seats
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select
            className="select"
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            <option value="dine_in">Dine in</option>
            <option value="takeaway">Takeaway</option>
            <option value="delivery">Delivery</option>
          </select>
        </Field>
      </div>

      <Field label="Guests">
        <input
          className="input"
          type="number"
          min={0}
          max={50}
          value={guests}
          onChange={(event) => setGuests(Number(event.target.value))}
        />
      </Field>

      <Field label="Notes">
        <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
    </Modal>
  )
}
