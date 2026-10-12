import sliders from 'bootstrap-icons/icons/sliders.svg?raw'
import search from 'bootstrap-icons/icons/search.svg?raw'
import plus from 'bootstrap-icons/icons/plus-lg.svg?raw'
import check from 'bootstrap-icons/icons/check-lg.svg?raw'
import close from 'bootstrap-icons/icons/x-lg.svg?raw'
import geoAlt from 'bootstrap-icons/icons/geo-alt.svg?raw'
import calendarEvent from 'bootstrap-icons/icons/calendar-event.svg?raw'
import checkCircle from 'bootstrap-icons/icons/check-circle.svg?raw'
import alarm from 'bootstrap-icons/icons/alarm.svg?raw'
import speedometer from 'bootstrap-icons/icons/speedometer2.svg?raw'
import { api, ApiError, messageFor } from './api.js'
import { escapeHtml, render, submitForm } from './utils.js'
import menuTpl from './templates/menu.html?raw'
import taskCardTpl from './templates/task-card.html?raw'
import chipTpl from './templates/chip.html?raw'
import skeletonTpl from './templates/skeleton.html?raw'
import emptyNoteTpl from './templates/empty-note.html?raw'
import levelRadioTpl from './templates/level-radio.html?raw'
import filterLevelTpl from './templates/filter-level.html?raw'
import taskSheetTpl from './templates/task-sheet.html?raw'
import filterSheetTpl from './templates/filter-sheet.html?raw'

const svg = (raw) => raw.replace('<svg', '<svg aria-hidden="true" focusable="false"')

const icons = {
  sliders: svg(sliders),
  search: svg(search),
  plus: svg(plus),
  check: svg(check),
  close: svg(close),
  geoAlt: svg(geoAlt),
  calendarEvent: svg(calendarEvent),
  speedometer: svg(speedometer),
}

let tasks = []
let loaded = false
let filter = 'upcoming'
let query = ''
let filters = { date: '', place: '', levels: new Set() }

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const toDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return shortDate.format(new Date(y, m - 1, d))
}

function dateLabel(t) {
  if (t.startDate && t.endDate && t.startDate !== t.endDate) return `${toDate(t.startDate)} → ${toDate(t.endDate)}`
  const single = t.startDate ?? t.endDate
  return single ? toDate(single) : ''
}

const DAY = 86400000
const SOON_DAYS = 3
function deadlineAlert(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const now = new Date()
  const days = Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY)
  if (days < 0) return { kind: 'late', text: 'En retard' }
  if (days === 0) return { kind: 'soon', text: "Aujourd'hui" }
  if (days === 1) return { kind: 'soon', text: 'Demain' }
  if (days <= SOON_DAYS) return { kind: 'soon', text: `Dans ${days} jours` }
  return null
}

const sortKey = (t) => t.startDate ?? t.endDate ?? '9999-12-31'
const criteria = () => ({
  q: query.trim(),
  startDate: filters.date,
  endDate: filters.date,
  place: filters.place,
  levels: [...filters.levels],
})
const hasFilters = () => !!(filters.date || filters.place || filters.levels.size)
const isSearching = () => !!query.trim() || hasFilters()

// Lieux proposés dans la popup : pris sur l'ensemble des tâches, pas seulement sur le résultat d'une recherche
let knownPlaces = []
let placesLoaded = false
const collectPlaces = (list) => [
  ...new Map(list.filter((t) => t.place?.trim()).map((t) => [t.place.trim().toLowerCase(), t.place.trim()])).values(),
].sort((a, b) => a.localeCompare(b, 'fr'))

// `tasks` contient déjà le résultat de la recherche (faite par le backend) : ici on ne fait que trier l'onglet affiché
const visible = () =>
  filter === 'upcoming'
    ? tasks.filter((t) => !t.done).sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.id - b.id)
    : tasks.filter((t) => t.done).sort((a, b) => b.id - a.id)

const toRequest = (t, changes = {}) => ({
  label: t.label,
  description: t.description,
  startDate: t.startDate,
  endDate: t.endDate,
  place: t.place,
  level: t.level,
  collaboratorId: t.collaborator?.id ?? null,
  done: t.done,
  ...changes,
})

const chip = (icon, text, kind = '') => render(chipTpl, { icon: svg(icon), text, kind })

function taskCard(t, i) {
  const chips = []
  const date = dateLabel(t)
  if (date) chips.push(chip(calendarEvent, date))
  if (t.place) chips.push(chip(geoAlt, t.place, 'place'))
  const alert = !t.done && deadlineAlert(t.endDate)
  if (alert) chips.push(chip(alarm, alert.text, alert.kind))
  if (t.done && t.endDate && t.doneAt) {
    const onTime = t.doneAt <= t.endDate
    chips.push(onTime ? chip(checkCircle, 'Réalisée dans les temps', 'ontime') : chip(alarm, 'Réalisée en retard', 'late'))
  }
  if (!t.done && t.level > 0) chips.push(chip(speedometer, `Niveau ${t.level}`, `level lvl-${t.level}`))

  return render(taskCardTpl, {
    ...icons,
    i,
    id: t.id,
    done: t.done,
    label: t.label,
    description: t.description,
    checkLabel: t.done ? 'Remettre à faire' : 'Marquer comme réalisée',
    chips: chips.join(''),
  })
}

const emptyNote = (text) => render(emptyNoteTpl, { text })

const taskLevels = [
  { value: '', symbol: '–', text: 'Aucun niveau', checked: true },
  ...[0, 1, 2, 3].map((n) => ({ value: n, symbol: n, text: `Niveau ${n}` })),
]
const sheetHtml = render(taskSheetTpl, { ...icons, levels: taskLevels.map((l) => render(levelRadioTpl, l)).join('') })

const filterSheetHtml = render(filterSheetTpl, {
  ...icons,
  levels: [1, 2, 3].map((n) => render(filterLevelTpl, { n })).join(''),
})

const openDialog = (d) => (d.showModal ? d.showModal() : d.setAttribute('open', ''))
const closeDialog = (d) => (d.close ? d.close() : d.removeAttribute('open'))

export function mountMenu(root, user) {
  const name = user.username
  root.classList.add('home-list')
  root.innerHTML = render(menuTpl, { ...icons, query, taskSheet: sheetHtml, filterSheet: filterSheetHtml })

  const $ = (sel) => root.querySelector(sel)
  const area = $('#list-area')
  const sheet = $('#sheet')
  const form = $('#task-form')
  const deleteBtn = $('#delete-task')
  const filterSheet = $('#filter-sheet')
  const filterForm = $('#filter-form')
  let editing = null

  // ---------- Affichage ----------
  function toast(message, isError = false) {
    const el = document.createElement('div')
    el.className = `toast${isError ? ' is-error' : ''}`
    el.setAttribute('role', 'status')
    el.textContent = message
    document.body.appendChild(el)
    setTimeout(() => el.classList.add('is-leaving'), 3000)
    setTimeout(() => el.remove(), 3500)
  }

  function renderFilters() {
    const count = (filters.date ? 1 : 0) + (filters.place ? 1 : 0) + (filters.levels.size ? 1 : 0)
    const badge = $('#filter-badge')
    badge.hidden = !count
    badge.textContent = count
    $('#open-filters').classList.toggle('has-filters', count > 0)
  }

  function openFilters() {
    const f = filterForm.elements
    f.place.innerHTML =
      `<option value="">Tous les lieux</option>` +
      knownPlaces.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')
    f.date.value = filters.date
    f.place.value = filters.place
    filterForm.querySelectorAll('[name="level"]').forEach((c) => {
      c.checked = filters.levels.has(Number(c.value))
    })
    openDialog(filterSheet)
  }

  function renderList() {
    if (!root.isConnected) return
    renderFilters()
    root.querySelectorAll('[data-filter]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.filter === filter))
    })
    root.querySelector('.seg').style.setProperty('--i', filter === 'upcoming' ? 0 : 1)
    root.querySelector('[data-count="upcoming"]').textContent = loaded ? tasks.filter((t) => !t.done).length : ''
    root.querySelector('[data-count="done"]').textContent = loaded ? tasks.filter((t) => t.done).length : ''

    if (!loaded) {
      area.innerHTML = skeletonTpl
      return
    }
    const list = visible()
    if (list.length) {
      area.innerHTML = `<ul class="tasks">${list.map(taskCard).join('')}</ul>`
    } else {
      area.innerHTML = emptyNote(
        isSearching() ? 'Aucun résultat' : filter === 'upcoming' ? 'Rien à venir' : 'Aucune tâche réalisée',
      )
    }
  }

  // Recherche côté backend (GET /search/tasks). Un compteur écarte les réponses périmées si l'utilisateur tape vite.
  let searchSeq = 0
  async function search() {
    const seq = ++searchSeq
    area.classList.add('is-busy')
    try {
      const result = await api.searchTasks(criteria())
      if (seq !== searchSeq) return
      tasks = result
      if (!isSearching()) {
        knownPlaces = collectPlaces(result)
        placesLoaded = true
      } else if (!placesLoaded) {
        placesLoaded = true
        api.tasks().then((all) => (knownPlaces = collectPlaces(all))).catch(() => (placesLoaded = false))
      }
    } catch (err) {
      if (seq !== searchSeq) return
      if (err.status !== 401) toast(messageFor(err), true) // 401 : l'appli renvoie déjà à la connexion
    } finally {
      if (seq === searchSeq) {
        loaded = true
        area.classList.remove('is-busy')
        renderList()
      }
    }
  }

  // ---------- Actions ----------
  async function toggle(id) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const previous = task.done

    task.done = !previous
    root.querySelector(`.task[data-id="${id}"]`)?.classList.add('is-leaving')
    setTimeout(renderList, 320)
    try {
      const saved = await api.updateTask(id, toRequest(task))
      Object.assign(task, saved)
      renderList()
    } catch (err) {
      task.done = previous
      renderList()
      toast(messageFor(err), true)
    }
  }

  function openSheet(task = null) {
    editing = task
    $('#sheet-title').textContent = task ? 'Modifier la tâche' : 'Nouvelle tâche'
    form.reset()
    form.querySelector('.alert').hidden = true
    form.querySelectorAll('.field-error').forEach((el) => el.remove())
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'))

    const f = form.elements
    f.label.value = task?.label ?? ''
    f.description.value = task?.description ?? ''
    f.startDate.value = task?.startDate ?? ''
    f.endDate.value = task?.endDate ?? ''
    f.endDate.min = task?.startDate ?? ''
    f.place.value = task?.place ?? ''
    f.level.value = task?.level == null ? '' : String(task.level)

    deleteBtn.hidden = !task
    deleteBtn.textContent = 'Supprimer'
    deleteBtn.dataset.confirm = ''
    openDialog(sheet)
    f.label.focus()
  }

  // ---------- Événements ----------
  root.addEventListener('click', (e) => {
    if (e.target === sheet || e.target === filterSheet) return closeDialog(e.target) // clic sur le fond du panneau
    const target = e.target.closest('button')
    if (!target) return
    if (target.dataset.filter) {
      filter = target.dataset.filter
      renderList()
    } else if (target.id === 'open-filters') {
      openFilters()
    } else if (target.id === 'new-task') {
      openSheet()
    } else if (target.dataset.toggle) {
      toggle(Number(target.dataset.toggle))
    } else if (target.dataset.edit) {
      openSheet(tasks.find((t) => t.id === Number(target.dataset.edit)))
    } else if (target.hasAttribute('data-close')) {
      closeDialog(target.closest('dialog'))
    }
  })

  let searchTimer
  $('#search').addEventListener('input', (e) => {
    query = e.target.value
    clearTimeout(searchTimer) // on attend une courte pause dans la frappe avant d'interroger le backend
    searchTimer = setTimeout(search, 300)
  })

  filterForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const f = filterForm.elements
    filters.date = f.date.value
    filters.place = f.place.value
    filters.levels = new Set([...filterForm.querySelectorAll('[name="level"]:checked')].map((c) => Number(c.value)))
    closeDialog(filterSheet)
    renderFilters()
    search()
  })
  $('#reset-filters').addEventListener('click', () => {
    filters.date = ''
    filters.place = ''
    filters.levels.clear()
    closeDialog(filterSheet)
    renderFilters()
    search()
  })

  form.elements.startDate.addEventListener('change', (e) => {
    form.elements.endDate.min = e.target.value
  })

  deleteBtn.addEventListener('click', async () => {
    if (!deleteBtn.dataset.confirm) {
      deleteBtn.dataset.confirm = '1'
      deleteBtn.textContent = 'Confirmer la suppression'
      return
    }
    try {
      await api.deleteTask(editing.id)
      closeDialog(sheet)
      placesLoaded = false
      search()
      toast('Tâche supprimée')
    } catch (err) {
      form.querySelector('.alert').textContent = messageFor(err)
      form.querySelector('.alert').hidden = false
    }
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    submitForm(form, async () => {
      const f = form.elements
      const start = f.startDate.value || null
      const end = f.endDate.value || null
      if (start && end && end < start) throw new ApiError(400, 'endDate must not be before startDate')

      const body = {
        label: f.label.value.trim(),
        description: f.description.value.trim(),
        startDate: start,
        endDate: end,
        place: f.place.value.trim() || null,
        level: f.level.value === '' ? null : Number(f.level.value),
        collaboratorId: editing?.collaborator?.id ?? null,
        done: editing ? editing.done : false,
      }
      const saved = editing ? await api.updateTask(editing.id, body) : await api.createTask(body)

      if (!saved.done) filter = 'upcoming'

      closeDialog(sheet)
      placesLoaded = false
      await search()
      toast(editing ? 'Tâche modifiée' : 'Tâche créée')
    })
  })

  renderList()
  search()
}
