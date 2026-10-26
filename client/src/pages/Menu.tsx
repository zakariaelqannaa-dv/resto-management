import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { Empty, Field, Icon, Loading, Modal, StationBadge, useToast } from '../components/ui'
import { STATIONS, STATION_LABEL, money } from '../lib/format'
import type { Category, MenuItem, Station } from '../types'

export function Menu() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [categoryId, setCategoryId] = useState<'all' | string>('all')
  const [managingCategories, setManagingCategories] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | 'new' | null>(null)

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/menu/categories'),
  })
  const itemsQuery = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => api.get<MenuItem[]>('/menu/items'),
  })

  const categories = categoriesQuery.data ?? []
  const allItems = itemsQuery.data ?? []
  const items = categoryId === 'all' ? allItems : allItems.filter((item) => item.categoryId === categoryId)
  const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name ?? '—'

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['menu-items'] })
    queryClient.invalidateQueries({ queryKey: ['categories'] })
  }
  const fail = (error: unknown) => toast((error as Error).message, 'error')

  const patchItem = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch<MenuItem>(`/menu/items/${id}`, patch),
    onSuccess: invalidate,
    onError: fail,
  })

  const removeItem = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/items/${id}`),
    onSuccess: () => {
      invalidate()
      toast('Item removed')
    },
    onError: fail,
  })

  return (
    <>
      <header className="topbar">
        <div className="topbar__title">
          <span className="topbar__eyebrow">Kitchen</span>
          <h1>Menu</h1>
        </div>
        <div className="topbar__actions">
          <button type="button" className="btn" onClick={() => setManagingCategories(true)}>
            Categories
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setEditingItem('new')}>
            <Icon name="plus" /> New item
          </button>
        </div>
      </header>

      <div className="content">
        <div className="filters" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`btn btn--sm ${categoryId === 'all' ? 'btn--primary' : ''}`}
            onClick={() => setCategoryId('all')}
          >
            All items
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`btn btn--sm ${categoryId === category.id ? 'btn--primary' : ''}`}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        <section className="card">
          <div className="card__head">
            <h2>{categoryId === 'all' ? 'All items' : categoryName(categoryId)}</h2>
            <span className="small muted">{items.length} items</span>
          </div>

          {itemsQuery.isPending ? (
            <Loading />
          ) : items.length === 0 ? (
            <div style={{ padding: 16 }}>
              <Empty>Nothing here yet. Create your first menu item.</Empty>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Station</th>
                    <th>Price</th>
                    <th>Available</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.name}</div>
                        {item.description ? <div className="small muted">{item.description}</div> : null}
                      </td>
                      <td>{categoryName(item.categoryId)}</td>
                      <td>
                        <StationBadge station={item.station} />
                      </td>
                      <td className="num">{money(item.priceCents)}</td>
                      <td>
                        <button
                          type="button"
                          className={`btn btn--sm ${item.available ? '' : 'btn--danger'}`}
                          onClick={() => patchItem.mutate({ id: item.id, patch: { available: !item.available } })}
                        >
                          {item.available ? 'Available' : 'Sold out'}
                        </button>
                      </td>
                      <td>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
                          <button
                            type="button"
                            className="btn btn--ghost btn--icon"
                            title="Edit item"
                            onClick={() => setEditingItem(item)}
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--icon"
                            title="Delete item"
                            onClick={() => {
                              if (window.confirm(`Delete ${item.name}?`)) removeItem.mutate(item.id)
                            }}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {managingCategories ? (
        <CategoriesModal
          categories={categories}
          onClose={() => setManagingCategories(false)}
          onChanged={invalidate}
        />
      ) : null}

      {editingItem ? (
        <ItemModal
          item={editingItem === 'new' ? null : editingItem}
          categories={categories}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null)
            invalidate()
            toast('Menu updated')
          }}
        />
      ) : null}
    </>
  )
}

function ItemModal({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: MenuItem | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [price, setPrice] = useState(item ? (item.priceCents / 100).toFixed(2) : '0.00')
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? '')
  const [station, setStation] = useState<Station>(item?.station ?? 'kitchen')
  const [available, setAvailable] = useState(item?.available ?? true)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) {
      toast('Give the item a name', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description,
        priceCents: Math.round(Number(price.replace(',', '.')) * 100) || 0,
        categoryId: categoryId || null,
        station,
        available,
      }
      if (item) {
        await api.patch(`/menu/items/${item.id}`, payload)
      } else {
        await api.post('/menu/items', payload)
      }
      onSaved()
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={item ? 'Edit item' : 'New menu item'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={saving}>
            Save
          </button>
        </>
      }
    >
      <Field label="Name">
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label="Description">
        <textarea
          className="textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <div className="grid-2">
        <Field label="Price">
          <input
            className="input"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
        <Field label="Category">
          <select
            className="select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid-2">
        <Field label="Station" hint="Where the ticket prints.">
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
        <Field label="Availability">
          <select
            className="select"
            value={available ? 'yes' : 'no'}
            onChange={(event) => setAvailable(event.target.value === 'yes')}
          >
            <option value="yes">Available</option>
            <option value="no">Sold out</option>
          </select>
        </Field>
      </div>
    </Modal>
  )
}

function CategoriesModal({
  categories,
  onClose,
  onChanged,
}: {
  categories: Category[]
  onClose: () => void
  onChanged: () => void
}) {
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})

  const fail = (error: unknown) => toast((error as Error).message, 'error')

  const create = useMutation({
    mutationFn: (name: string) => api.post<Category>('/menu/categories', { name }),
    onSuccess: () => {
      setNewName('')
      onChanged()
    },
    onError: fail,
  })

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<Category>(`/menu/categories/${id}`, { name }),
    onSuccess: onChanged,
    onError: fail,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/categories/${id}`),
    onSuccess: onChanged,
    onError: fail,
  })

  return (
    <Modal
      title="Categories"
      subtitle="Items keep their name if a category is deleted."
      onClose={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Field label="New category">
            <input
              className="input"
              value={newName}
              placeholder="e.g. Starters"
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && newName.trim()) create.mutate(newName.trim())
              }}
            />
          </Field>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!newName.trim()}
          onClick={() => create.mutate(newName.trim())}
        >
          <Icon name="plus" /> Add
        </button>
      </div>

      <ul className="list-clean">
        {categories.map((category) => (
          <li key={category.id} className="row" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
            <input
              className="input"
              value={draft[category.id] ?? category.name}
              onChange={(event) => setDraft({ ...draft, [category.id]: event.target.value })}
              onBlur={() => {
                const value = (draft[category.id] ?? category.name).trim()
                if (value && value !== category.name) rename.mutate({ id: category.id, name: value })
              }}
            />
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              title="Delete category"
              onClick={() => {
                if (window.confirm(`Delete ${category.name}?`)) remove.mutate(category.id)
              }}
            >
              <Icon name="trash" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
