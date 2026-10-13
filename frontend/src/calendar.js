import { api, messageFor } from './api.js'
import { render, toast } from './utils.js'
import calendarTpl from './templates/calendar/calendar.html?raw'
import dayHeroTpl from './templates/calendar/day-hero.html?raw'
import taskItemTpl from './templates/calendar/task-item.html?raw'
import weekDayTpl from './templates/calendar/week-day.html?raw'
import monthGridTpl from './templates/calendar/month-grid.html?raw'
import monthCellTpl from './templates/calendar/month-cell.html?raw'
import chipTpl from './templates/homepage/components/chip.html?raw'
import emptyNoteTpl from './templates/homepage/components/empty-note.html?raw'
import prev from 'bootstrap-icons/icons/chevron-left.svg?raw'
import next from 'bootstrap-icons/icons/chevron-right.svg?raw'
import geoAlt from 'bootstrap-icons/icons/geo-alt.svg?raw'
import speedometer from 'bootstrap-icons/icons/speedometer2.svg?raw'
import checkCircle from 'bootstrap-icons/icons/check-circle.svg?raw'
import calendarEvent from 'bootstrap-icons/icons/calendar-event.svg?raw'

const VIEWS = ['day', 'week', 'month']
const decorative = (raw) => raw.replace('<svg', '<svg aria-hidden="true" focusable="false"')

// ---------- Dates (locales, jamais d'UTC : une tâche du 12 reste au 12) ----------
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromIso = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7))
const today = () => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}
const addMonths = (d, n) => {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last))
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const fmt = (opts) => {
  const f = new Intl.DateTimeFormat('fr-FR', opts)
  return (d) => f.format(d)
}
const weekdayLong = fmt({ weekday: 'long' })
const weekdayShort = fmt({ weekday: 'short' })
const monthLong = fmt({ month: 'long' })
const monthYear = fmt({ month: 'long', year: 'numeric' })
const dayFull = fmt({ weekday: 'long', day: 'numeric', month: 'long' })
const dayMonthShort = fmt({ day: 'numeric', month: 'short' })

// ---------- Tâches d'un jour ----------
const covers = (t, day) => {
  const start = t.startDate ?? t.endDate
  const end = t.endDate ?? t.startDate
  return !!start && start <= day && day <= end
}
// du niveau le plus important au moins important (sans niveau en dernier), puis à faire avant réalisées
const byImportance = (a, b) =>
  (b.level ?? -1) - (a.level ?? -1) || Number(a.done) - Number(b.done) || a.label.localeCompare(b.label, 'fr')

const chip = (icon, text, kind = '') => render(chipTpl, { icon: decorative(icon), text, kind })
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

function taskItem(t, { detailed }) {
  const chips = []
  if (t.startDate && t.endDate && t.startDate !== t.endDate) {
    chips.push(chip(calendarEvent, `${dayMonthShort(fromIso(t.startDate))} → ${dayMonthShort(fromIso(t.endDate))}`))
  }
  if (t.place) chips.push(chip(geoAlt, t.place, 'place'))
  if (t.level > 0) chips.push(chip(speedometer, `Niveau ${t.level}`, `level lvl-${t.level}`))
  if (t.done) chips.push(chip(checkCircle, 'Réalisée', 'ontime'))
  return render(taskItemTpl, {
    level: t.level ?? 'none',
    done: t.done,
    label: t.label,
    description: detailed ? t.description : '',
    chips: chips.join(''),
  })
}

// État conservé quand on quitte la page puis qu'on y revient
let view = 'day'
let cursor = today()

export function mountCalendar(root) {
  root.classList.add('home-calendar')
  root.innerHTML = render(calendarTpl, { prev: decorative(prev), next: decorative(next) })

  const $ = (sel) => root.querySelector(sel)
  let tasks = []
  let loaded = false
  let everLoaded = false // tant qu'aucune réponse n'est arrivée, on n'affiche pas un faux « rien de prévu »
  let seq = 0

  const windowOf = () => {
    if (view === 'day') return [cursor, cursor]
    if (view === 'week') return [mondayOf(cursor), addDays(mondayOf(cursor), 6)]
    return [new Date(cursor.getFullYear(), cursor.getMonth(), 1), new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)]
  }

  const label = () => {
    const [from, to] = windowOf()
    if (view === 'day') return cap(dayFull(cursor))
    if (view === 'month') return cap(monthYear(cursor))
    return `${dayMonthShort(from)} – ${dayMonthShort(to)} ${to.getFullYear()}`
  }

  const tasksOn = (day) => tasks.filter((t) => covers(t, iso(day))).sort(byImportance)

  // ---------- Rendu des trois vues ----------
  function dayView() {
    const list = tasksOn(cursor)
    const hero = render(dayHeroTpl, {
      num: cursor.getDate(),
      weekday: cap(weekdayLong(cursor)),
      month: cap(monthLong(cursor)),
      count: list.length ? plural(list.length, 'tâche', 'tâches') : '',
    })
    const body = list.length
      ? `<ul class="cal-tasks">${list.map((t) => taskItem(t, { detailed: true })).join('')}</ul>`
      : render(emptyNoteTpl, { text: 'Rien de prévu ce jour-là' })
    return hero + body
  }

  function weekView() {
    const start = mondayOf(cursor)
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
      const list = tasksOn(d)
      return render(weekDayTpl, {
        day: iso(d),
        label: dayFull(d),
        weekday: weekdayShort(d),
        num: d.getDate(),
        today: iso(d) === iso(today()),
        tasks: list.map((t) => taskItem(t, { detailed: false })).join(''),
        none: !list.length,
      })
    })
    return `<ul class="week">${days.join('')}</ul>`
  }

  function monthView() {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    let cells = '<span class="month-blank"></span>'.repeat((first.getDay() + 6) % 7)
    let total = 0
    for (let n = 1; n <= last; n++) {
      const day = new Date(first.getFullYear(), first.getMonth(), n)
      const list = tasksOn(day)
      total += list.length
      const dots = list.slice(0, 3).map((t) => `<i class="dot lvl-${t.level ?? 'none'}"></i>`).join('')
      cells += render(monthCellTpl, {
        day: iso(day),
        num: n,
        today: iso(day) === iso(today()),
        busy: list.length > 0,
        dots: dots + (list.length > 3 ? `<small>+${list.length - 3}</small>` : ''),
        label: `${dayFull(day)} : ${list.length ? plural(list.length, 'tâche', 'tâches') : 'rien de prévu'}`,
      })
    }
    const seen = new Set(tasks.map((t) => t.id)).size
    return render(monthGridTpl, {
      cells,
      summary: seen ? `${plural(seen, 'tâche datée', 'tâches datées')} ce mois-ci` : 'Aucune tâche datée ce mois-ci',
    })
  }

  function renderAll() {
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)))
    $('.cal-seg').style.setProperty('--i', VIEWS.indexOf(view))
    $('#cal-label').textContent = label()
    $('#cal-body').innerHTML = !everLoaded ? '' : view === 'day' ? dayView() : view === 'week' ? weekView() : monthView()
    $('#cal-body').classList.toggle('is-busy', !loaded)
  }

  // Les tâches viennent du backend : celles dont la période chevauche la fenêtre affichée (les tâches sans date sont écartées)
  async function load() {
    const mine = ++seq
    const [from, to] = windowOf()
    loaded = false
    $('#cal-body').classList.add('is-busy')
    try {
      const result = await api.searchTasks({ startDate: iso(from), endDate: iso(to) })
      if (mine !== seq) return
      tasks = result
    } catch (err) {
      if (mine !== seq) return
      tasks = []
      if (err.status !== 401) toast(messageFor(err), true)
    }
    if (!root.isConnected) return
    loaded = true
    everLoaded = true
    renderAll()
  }

  function go(next) {
    view = next.view ?? view
    cursor = next.cursor ?? cursor
    renderAll()
    load()
  }

  root.addEventListener('click', (e) => {
    const button = e.target.closest('button')
    if (!button) return
    if (button.dataset.view) go({ view: button.dataset.view })
    else if (button.dataset.nav) {
      const n = Number(button.dataset.nav)
      go({ cursor: view === 'day' ? addDays(cursor, n) : view === 'week' ? addDays(cursor, 7 * n) : addMonths(cursor, n) })
    } else if (button.hasAttribute('data-today')) go({ cursor: today() })
    else if (button.dataset.day) go({ view: 'day', cursor: fromIso(button.dataset.day) })
  })

  renderAll()
  load()
}
