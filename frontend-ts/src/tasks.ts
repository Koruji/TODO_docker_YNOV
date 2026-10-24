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
import { api, ApiError, messageFor, statusOf } from './api'
import { closestFrom, escapeHtml, must, render, submitForm } from './utils'
import type { SearchCriteria, Task, TaskRequest } from './types'
import menuTpl from './templates/homepage/menu.html?raw'
import taskCardTpl from './templates/homepage/components/task-card.html?raw'
import chipTpl from './templates/homepage/components/chip.html?raw'
import skeletonTpl from './templates/homepage/components/skeleton.html?raw'
import emptyNoteTpl from './templates/homepage/components/empty-note.html?raw'
import levelRadioTpl from './templates/homepage/popups/level-radio.html?raw'
import filterLevelTpl from './templates/homepage/popups/filter-level.html?raw'
import taskSheetTpl from './templates/homepage/popups/task-sheet.html?raw'
import filterSheetTpl from './templates/homepage/popups/filter-sheet.html?raw'

const svg = (raw: string): string => raw.replace('<svg', '<svg aria-hidden="true" focusable="false"')

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

type Filter = 'upcoming' | 'done'

interface Filters {
  date: string
  place: string
  levels: Set<number>
}

let tasks: Task[] = []
let loaded = false
let filter: Filter = 'upcoming'
let query = ''
const filters: Filters = { date: '', place: '', levels: new Set() }

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const toDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  return shortDate.format(new Date(y, m - 1, d))
}

function dateLabel(t: Task): string {
  if (t.startDate && t.endDate && t.startDate !== t.endDate) return `${toDate(t.startDate)} → ${toDate(t.endDate)}`
  const single = t.startDate ?? t.endDate
  return single ? toDate(single) : ''
}

interface DeadlineAlert {
  kind: 'late' | 'soon'
  text: string
}

const DAY = 86400000
const SOON_DAYS = 3
function deadlineAlert(iso: string | null): DeadlineAlert | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const now = new Date()
  const days = Math.round((new Date(y, m - 1, d).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / DAY)
  if (days < 0) return { kind: 'late', text: 'En retard' }
  if (days === 0) return { kind: 'soon', text: "Aujourd'hui" }
  if (days === 1) return { kind: 'soon', text: 'Demain' }
  if (days <= SOON_DAYS) return { kind: 'soon', text: `Dans ${days} jours` }
  return null
}

const sortKey = (t: Task): string => t.startDate ?? t.endDate ?? '9999-12-31'
const criteria = (): SearchCriteria => ({
  q: query.trim(),
  startDate: filters.date,
  endDate: filters.date,
  place: filters.place,
  levels: [...filters.levels],
})
const hasFilters = (): boolean => !!(filters.date || filters.place || filters.levels.size)
const isSearching = (): boolean => !!query.trim() || hasFilters()

// Lieux proposés dans la popup : fournis par le backend (GET /search/places)
let knownPlaces: string[] = []

// `tasks` contient les résultats de la recherche faite par le backend (déjà séparés par `done`) : ici on ne fait que trier l'onglet affiché
const visible = (): Task[] =>
  filter === 'upcoming'
    ? tasks.filter((t) => !t.done).sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.id - b.id)
    : tasks.filter((t) => t.done).sort((a, b) => b.id - a.id)

const toRequest = (t: Task, changes: Partial<TaskRequest> = {}): TaskRequest => ({
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

const chip = (icon: string, text: string, kind = ''): string => render(chipTpl, { icon: svg(icon), text, kind })

function taskCard(t: Task, i: number): string {
  const chips: string[] = []
  const date = dateLabel(t)
  if (date) chips.push(chip(calendarEvent, date))
  if (t.place) chips.push(chip(geoAlt, t.place, 'place'))
  const alert = !t.done ? deadlineAlert(t.endDate) : null
  if (alert) chips.push(chip(alarm, alert.text, alert.kind))
  if (t.done && t.endDate && t.doneAt) {
    const onTime = t.doneAt <= t.endDate
    chips.push(onTime ? chip(checkCircle, 'Réalisée dans les temps', 'ontime') : chip(alarm, 'Réalisée en retard', 'late'))
  }
  if (!t.done && t.level != null && t.level > 0) chips.push(chip(speedometer, `Niveau ${t.level}`, `level lvl-${t.level}`))

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

const emptyNote = (text: string): string => render(emptyNoteTpl, { text })

const taskLevels = [
  { value: '', symbol: '–', text: 'Aucun niveau', checked: true },
  ...[0, 1, 2, 3].map((n) => ({ value: n, symbol: n, text: `Niveau ${n}`, checked: false })),
]
const sheetHtml = render(taskSheetTpl, { ...icons, levels: taskLevels.map((l) => render(levelRadioTpl, l)).join('') })

const filterSheetHtml = render(filterSheetTpl, {
  ...icons,
  levels: [1, 2, 3].map((n) => render(filterLevelTpl, { n })).join(''),
})

const openDialog = (d: HTMLDialogElement): void => (d.showModal ? d.showModal() : d.setAttribute('open', ''))
const closeDialog = (d: HTMLDialogElement): void => (d.close ? d.close() : d.removeAttribute('open'))

// Champs du formulaire de tâche (level est un groupe de boutons radio)
interface TaskElements extends HTMLFormControlsCollection {
  label: HTMLInputElement
  description: HTMLTextAreaElement
  startDate: HTMLInputElement
  endDate: HTMLInputElement
  place: HTMLInputElement
  level: RadioNodeList
}

// Champs du formulaire de filtres
interface FilterElements extends HTMLFormControlsCollection {
  date: HTMLInputElement
  place: HTMLSelectElement
}

export function mountMenu(root: HTMLElement): void {
  root.classList.add('home-list')
  root.innerHTML = render(menuTpl, { ...icons, query, taskSheet: sheetHtml, filterSheet: filterSheetHtml })

  const $ = <T extends Element = HTMLElement>(sel: string): T => must<T>(root, sel)
  const area = $('#list-area')
  const sheet = $<HTMLDialogElement>('#sheet')
  const form = $<HTMLFormElement>('#task-form')
  const deleteBtn = $<HTMLButtonElement>('#delete-task')
  const filterSheet = $<HTMLDialogElement>('#filter-sheet')
  const filterForm = $<HTMLFormElement>('#filter-form')
  let editing: Task | null = null

  // ---------- Affichage ----------
  function toast(message: string, isError = false): void {
    const el = document.createElement('div')
    el.className = `toast${isError ? ' is-error' : ''}`
    el.setAttribute('role', 'status')
    el.textContent = message
    document.body.appendChild(el)
    setTimeout(() => el.classList.add('is-leaving'), 3000)
    setTimeout(() => el.remove(), 3500)
  }

  function renderFilters(): void {
    const count = (filters.date ? 1 : 0) + (filters.place ? 1 : 0) + (filters.levels.size ? 1 : 0)
    const badge = $('#filter-badge')
    badge.hidden = !count
    badge.textContent = String(count)
    $('#open-filters').classList.toggle('has-filters', count > 0)
  }

  function openFilters(): void {
    const f = filterForm.elements as FilterElements
    f.place.innerHTML =
      `<option value="">Tous les lieux</option>` +
      knownPlaces.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')
    f.date.value = filters.date
    f.place.value = filters.place
    filterForm.querySelectorAll<HTMLInputElement>('[name="level"]').forEach((c) => {
      c.checked = filters.levels.has(Number(c.value))
    })
    openDialog(filterSheet)
  }

  function renderList(): void {
    if (!root.isConnected) return
    renderFilters()
    root.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.filter === filter))
    })
    $('.seg').style.setProperty('--i', String(filter === 'upcoming' ? 0 : 1))
    $('[data-count="upcoming"]').textContent = loaded ? String(tasks.filter((t) => !t.done).length) : ''
    $('[data-count="done"]').textContent = loaded ? String(tasks.filter((t) => t.done).length) : ''

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
  async function loadPlaces(): Promise<void> {
    try {
      knownPlaces = await api.places()
    } catch {
      // la liste déroulante reste simplement avec les lieux déjà connus
    }
  }

  let searchSeq = 0
  async function search(): Promise<void> {
    const seq = ++searchSeq
    area.classList.add('is-busy')
    try {
      // Une requête par onglet, toujours côté backend : sans recherche on liste (/todo et /done),
      // avec une recherche on passe par /search/tasks en précisant done=false ou done=true
      const [upcoming, finished] = isSearching()
        ? await Promise.all([api.searchTasks({ ...criteria(), done: false }), api.searchTasks({ ...criteria(), done: true })])
        : await Promise.all([api.todoTasks(), api.doneTasks()])
      if (seq !== searchSeq) return
      tasks = [...upcoming, ...finished]
    } catch (err) {
      if (seq !== searchSeq) return
      if (statusOf(err) !== 401) toast(messageFor(err), true) // 401 : l'appli renvoie déjà à la connexion
    } finally {
      if (seq === searchSeq) {
        loaded = true
        area.classList.remove('is-busy')
        renderList()
      }
    }
  }

  // ---------- Actions ----------
  async function toggle(id: number): Promise<void> {
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

  function openSheet(task: Task | null = null): void {
    editing = task
    $('#sheet-title').textContent = task ? 'Modifier la tâche' : 'Nouvelle tâche'
    form.reset()
    must(form, '.alert').hidden = true
    form.querySelectorAll('.field-error').forEach((el) => el.remove())
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'))

    const f = form.elements as TaskElements
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
    if (e.target === sheet || e.target === filterSheet) return closeDialog(e.target as HTMLDialogElement) // clic sur le fond du panneau
    const target = closestFrom<HTMLButtonElement>(e.target, 'button')
    if (!target) return
    if (target.dataset.filter) {
      filter = target.dataset.filter as Filter
      renderList()
    } else if (target.id === 'open-filters') {
      openFilters()
    } else if (target.id === 'new-task') {
      openSheet()
    } else if (target.dataset.toggle) {
      toggle(Number(target.dataset.toggle))
    } else if (target.dataset.edit) {
      openSheet(tasks.find((t) => t.id === Number(target.dataset.edit)) ?? null)
    } else if (target.hasAttribute('data-close')) {
      const dialog = target.closest('dialog')
      if (dialog) closeDialog(dialog)
    }
  })

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  $<HTMLInputElement>('#search').addEventListener('input', (e) => {
    query = (e.target as HTMLInputElement).value
    clearTimeout(searchTimer) // on attend une courte pause dans la frappe avant d'interroger le backend
    searchTimer = setTimeout(search, 300)
  })

  filterForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const f = filterForm.elements as FilterElements
    filters.date = f.date.value
    filters.place = f.place.value
    filters.levels = new Set(
      [...filterForm.querySelectorAll<HTMLInputElement>('[name="level"]:checked')].map((c) => Number(c.value)),
    )
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

  const formElements = form.elements as TaskElements
  formElements.startDate.addEventListener('change', (e) => {
    formElements.endDate.min = (e.target as HTMLInputElement).value
  })

  deleteBtn.addEventListener('click', async () => {
    if (!deleteBtn.dataset.confirm) {
      deleteBtn.dataset.confirm = '1'
      deleteBtn.textContent = 'Confirmer la suppression'
      return
    }
    if (!editing) return
    try {
      await api.deleteTask(editing.id)
      closeDialog(sheet)
      search()
      loadPlaces()
      toast('Tâche supprimée')
    } catch (err) {
      const alert = must(form, '.alert')
      alert.textContent = messageFor(err)
      alert.hidden = false
    }
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    submitForm(form, async () => {
      const f = form.elements as TaskElements
      const start = f.startDate.value || null
      const end = f.endDate.value || null
      if (start && end && end < start) throw new ApiError(400, 'endDate must not be before startDate')

      const body: TaskRequest = {
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
      loadPlaces()
      await search()
      toast(editing ? 'Tâche modifiée' : 'Tâche créée')
    })
  })

  renderList()
  search()
  loadPlaces()
}
