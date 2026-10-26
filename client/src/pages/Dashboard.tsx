import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, queryString } from '../api'
import { Empty, Loading, StatusBadge, StationBadge } from '../components/ui'
import { clock, dateLabel, money, todayISO } from '../lib/format'
import type { KitchenTicket, Order, Stats } from '../types'

export function Dashboard() {
  const date = todayISO()

  const statsQuery = useQuery({
    queryKey: ['stats', date],
    queryFn: () => api.get<Stats>(`/stats/today${queryString({ date })}`),
    refetchInterval: 20_000,
  })

  const ticketsQuery = useQuery({
    queryKey: ['tickets', date, 'all'],
    queryFn: () => api.get<KitchenTicket[]>(`/kitchen/tickets${queryString({ date, open: 'true' })}`),
    refetchInterval: 20_000,
  })

  const ordersQuery = useQuery({
    queryKey: ['orders', date, 'open'],
    queryFn: () => api.get<Order[]>(`/orders${queryString({ date, open: 'true' })}`),
    refetchInterval: 20_000,
  })

  const stats = statsQuery.data
  const tickets = ticketsQuery.data ?? []
  const orders = ordersQuery.data ?? []

  return (
    <>
      <header className="topbar">
        <div className="topbar__title">
          <span className="topbar__eyebrow">{dateLabel(date)}</span>
          <h1>Service overview</h1>
        </div>
        <div className="topbar__actions">
          <Link to="/kitchen" className="btn btn--primary">
            Open kitchen board
          </Link>
        </div>
      </header>

      <div className="content">
        <div className="stat-grid">
          <div className="stat">
            <div className="stat__label">Open tickets</div>
            <div className="stat__value">{stats?.tickets.open ?? '—'}</div>
            <div className="stat__meta">
              {stats ? `${stats.tickets.byStatus.queued ?? 0} queued · ${stats.tickets.byStatus.ready ?? 0} ready` : ' '}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Open orders</div>
            <div className="stat__value">{stats?.orders.open ?? '—'}</div>
            <div className="stat__meta">{stats ? `${stats.orders.byStatus.sent ?? 0} at the pass` : ' '}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Covers</div>
            <div className="stat__value">{stats?.orders.covers ?? '—'}</div>
            <div className="stat__meta">guests booked today</div>
          </div>
          <div className="stat">
            <div className="stat__label">Revenue paid</div>
            <div className="stat__value" style={{ fontSize: 24 }}>
              {stats ? money(stats.revenueCents) : '—'}
            </div>
            <div className="stat__meta">closed bills today</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <section className="card">
            <div className="card__head">
              <h2>Live tickets</h2>
              <Link to="/kitchen" className="btn btn--sm">
                Manage
              </Link>
            </div>
            <div className="card__body" style={{ padding: 0 }}>
              {ticketsQuery.isPending ? (
                <Loading />
              ) : tickets.length === 0 ? (
                <div style={{ padding: 16 }}>
                  <Empty>No open tickets. Fire an order to send food to the kitchen.</Empty>
                </div>
              ) : (
                <ul className="list-clean">
                  {tickets.slice(0, 6).map((ticket) => (
                    <li
                      key={ticket.id}
                      className="row"
                      style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}
                    >
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {ticket.ticketCode}
                      </span>
                      <StationBadge station={ticket.station} />
                      <span className="small muted">
                        {ticket.items.length} item{ticket.items.length === 1 ? '' : 's'} · {clock(ticket.firedAt)}
                      </span>
                      <div className="spacer" />
                      <StatusBadge status={ticket.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2>Open orders</h2>
              <Link to="/orders" className="btn btn--sm">
                Manage
              </Link>
            </div>
            <div className="card__body" style={{ padding: 0 }}>
              {ordersQuery.isPending ? (
                <Loading />
              ) : orders.length === 0 ? (
                <div style={{ padding: 16 }}>
                  <Empty>No open orders for today.</Empty>
                </div>
              ) : (
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
                    {orders.slice(0, 6).map((order) => (
                      <tr key={order.id}>
                        <td className="mono">{order.orderCode}</td>
                        <td>{order.tableLabel ?? '—'}</td>
                        <td className="num">{money(order.totalCents)}</td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
