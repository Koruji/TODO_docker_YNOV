import plus from 'bootstrap-icons/icons/plus-lg.svg?raw'
import check from 'bootstrap-icons/icons/check-lg.svg?raw'
import close from 'bootstrap-icons/icons/x-lg.svg?raw'
import geoAlt from 'bootstrap-icons/icons/geo-alt.svg?raw'
import calendarEvent from 'bootstrap-icons/icons/calendar-event.svg?raw'
import { api, ApiError, messageFor } from './api.js'
import { escapeHtml, submitForm } from './utils.js'

const svg = (raw) => raw.replace('<svg', '<svg aria-hidden="true" focusable="false"')

let tasks = []
let loaded = false
let filter = 'upcoming'

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

const sortKey = (t) => t.startDate ?? t.endDate ?? '9999-12-31'
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

function taskCard(t, i) {
  const chips = []
  const date = dateLabel(t)
  if (date) chips.push(`<span class="chip">${svg(calendarEvent)}${escapeHtml(date)}</span>`)
  if (t.place) chips.push(`<span class="chip">${svg(geoAlt)}${escapeHtml(t.place)}</span>`)
  const dots =
    t.level == null
      ? ''
      : `<span class="dots" role="img" aria-label="Niveau ${t.level} sur 3">${[1, 2, 3]
          .map((n) => `<i class="${n <= t.level ? 'on' : ''}"></i>`)
          .join('')}</span>`
  const meta = chips.length || dots ? `<span class="task-meta">${chips.join('')}${dots}</span>` : ''

  return `
    <li class="task${t.done ? ' is-done' : ''}" style="--n:${i}" data-id="${t.id}">
      <button type="button" class="check" data-toggle="${t.id}" aria-pressed="${t.done}"
        aria-label="${t.done ? 'Remettre à faire' : 'Marquer comme réalisée'} : ${escapeHtml(t.label)}">${svg(check)}</button>
      <button type="button" class="task-body" data-edit="${t.id}">
        <span class="task-title">${escapeHtml(t.label)}</span>
        <span class="task-desc">${escapeHtml(t.description)}</span>
        ${meta}
      </button>
    </li>`
}

const emptyNote = (text) => `<p class="empty-note">${text}</p>`

const skeleton = `<ul class="tasks" aria-hidden="true">${[0, 1, 2]
  .map((i) => `<li class="task is-skeleton" style="--n:${i}"></li>`)
  .join('')}</ul>`

function level(n, text) {
  return `
    <label class="level">
      <input type="radio" name="level" value="${n}" ${n === '' ? 'checked' : ''} />
      <span aria-label="${text}">${n === '' ? '–' : n}</span>
    </label>`
}

const sheetHtml = `
  <dialog class="sheet" id="sheet" aria-labelledby="sheet-title">
    <div class="sheet-panel">
      <header class="sheet-head">
        <h2 id="sheet-title"></h2>
        <button type="button" class="icon-btn" data-close aria-label="Fermer">${svg(close)}</button>
      </header>

      <form id="task-form" class="form" novalidate>
        <div class="alert" role="alert" hidden></div>

        <div class="field">
          <label for="f-label">Titre</label>
          <input id="f-label" name="label" type="text" maxlength="255" autocomplete="off" required />
        </div>
        <div class="field">
          <label for="f-description">Description</label>
          <textarea id="f-description" name="description" rows="3" required></textarea>
        </div>
        <div class="dates">
          <div class="field">
            <label for="f-start">Début</label>
            <input id="f-start" name="startDate" type="date" />
          </div>
          <div class="field">
            <label for="f-end">Fin</label>
            <input id="f-end" name="endDate" type="date" />
          </div>
        </div>
        <div class="field">
          <label for="f-place">Lieu</label>
          <input id="f-place" name="place" type="text" maxlength="255" autocomplete="off" />
        </div>
        <fieldset class="field levels">
          <legend>Niveau</legend>
          <div class="levels-row">
            ${level('', 'Aucun niveau')}${level('0', 'Niveau 0')}${level('1', 'Niveau 1')}${level('2', 'Niveau 2')}${level('3', 'Niveau 3')}
          </div>
        </fieldset>

        <div class="sheet-actions">
          <button type="button" class="btn btn-quiet" id="delete-task" hidden>Supprimer</button>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  </dialog>`

const openDialog = (d) => (d.showModal ? d.showModal() : d.setAttribute('open', ''))
const closeDialog = (d) => (d.close ? d.close() : d.removeAttribute('open'))

export function mountMenu(root, user) {
  const name = user.username
  root.classList.add('home-list')
  root.innerHTML = `
    <h1>Bonjour ${escapeHtml(name)}</h1>

    <div class="toolbar">
      <div class="seg" role="tablist" aria-label="Filtrer les tâches">
        <span class="seg-indicator" aria-hidden="true"></span>
        <button type="button" role="tab" data-filter="upcoming">À venir <span class="count" data-count="upcoming"></span></button>
        <button type="button" role="tab" data-filter="done">Réalisées <span class="count" data-count="done"></span></button>
      </div>
      <button type="button" class="fab" id="new-task" aria-label="Nouvelle tâche">${svg(plus)}</button>
    </div>

    <section id="list-area" aria-live="polite"></section>
    ${sheetHtml}`

  const $ = (sel) => root.querySelector(sel)
  const area = $('#list-area')
  const sheet = $('#sheet')
  const form = $('#task-form')
  const deleteBtn = $('#delete-task')
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

  function renderList() {
    if (!root.isConnected) return
    root.querySelectorAll('[data-filter]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.filter === filter))
    })
    root.querySelector('.seg').style.setProperty('--i', filter === 'upcoming' ? 0 : 1)
    root.querySelector('[data-count="upcoming"]').textContent = loaded ? tasks.filter((t) => !t.done).length : ''
    root.querySelector('[data-count="done"]').textContent = loaded ? tasks.filter((t) => t.done).length : ''

    if (!loaded) {
      area.innerHTML = skeleton
      return
    }
    const list = visible()
    if (list.length) {
      area.innerHTML = `<ul class="tasks">${list.map(taskCard).join('')}</ul>`
    } else {
      area.innerHTML = emptyNote(filter === 'upcoming' ? 'Rien à venir' : 'Aucune tâche réalisée')
    }
  }

  async function load() {
    try {
      tasks = await api.tasks()
      loaded = true
    } catch (err) {
      if (err.status !== 401) toast(messageFor(err), true) // 401 : l'appli renvoie déjà à la connexion
      loaded = true
    }
    renderList()
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
    if (e.target === sheet) return closeDialog(sheet) // clic sur le fond du panneau
    const target = e.target.closest('button')
    if (!target) return
    if (target.dataset.filter) {
      filter = target.dataset.filter
      renderList()
    } else if (target.id === 'new-task') {
      openSheet()
    } else if (target.dataset.toggle) {
      toggle(Number(target.dataset.toggle))
    } else if (target.dataset.edit) {
      openSheet(tasks.find((t) => t.id === Number(target.dataset.edit)))
    } else if (target.hasAttribute('data-close')) {
      closeDialog(sheet)
    }
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
      tasks = tasks.filter((t) => t.id !== editing.id)
      closeDialog(sheet)
      renderList()
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

      if (editing) tasks = tasks.map((t) => (t.id === saved.id ? saved : t))
      else tasks = [...tasks, saved]
      if (!saved.done) filter = 'upcoming'

      closeDialog(sheet)
      renderList()
      toast(editing ? 'Tâche modifiée' : 'Tâche créée')
    })
  })

  renderList()
  load()
}
