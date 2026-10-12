import { api, messageFor } from './api.js'
import { render } from './utils.js'
import statsTpl from './templates/stats/stats.html?raw'
import heatmapTpl from './templates/stats/heatmap.html?raw'
import heatCellTpl from './templates/stats/heat-cell.html?raw'
import statTileTpl from './templates/stats/stat-tile.html?raw'
import emptyNoteTpl from './templates/homepage/components/empty-note.html?raw'

const MONTHS = 4
const DAY_LABELS = [['Lun', 1], ['Mer', 3], ['Ven', 5]] // [texte, ligne 0 = lundi]

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short' })
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`

// Fenêtre affichée : de 4 mois en arrière (calée sur le lundi de la semaine) jusqu'à aujourd'hui
function window4Months() {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const back = new Date(end.getFullYear(), end.getMonth() - MONTHS, end.getDate() + 1)
  const start = addDays(back, -((back.getDay() + 6) % 7)) // lundi
  return { start, end }
}

const levelOf = (n) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4)

const countOf = (a, metric) => (metric === 'created' ? a.created : metric === 'done' ? a.done : a.created + a.done)

const describe = (a, metric) => {
  const parts = []
  if (metric !== 'done' && a.created) parts.push(plural(a.created, 'tâche créée', 'tâches créées'))
  if (metric !== 'created' && a.done) parts.push(plural(a.done, 'tâche réalisée', 'tâches réalisées'))
  return parts.join(' et ')
}

export function mountStats(root) {
  root.classList.add('home-stats')
  root.innerHTML = statsTpl

  const $ = (sel) => root.querySelector(sel)
  const { start, end } = window4Months()
  let metric = 'all'
  let activity = new Map() // 'YYYY-MM-DD' -> { created, done }

  function renderHeatmap() {
    const days = Math.round((end - start) / 86400000) + 1
    const weeks = Math.ceil(days / 7)

    let months = ''
    let lastMonth = -1
    for (let w = 0; w < weeks; w++) {
      const first = addDays(start, w * 7)
      if (first.getMonth() !== lastMonth) {
        months += `<span class="heat-month" style="grid-column:${w + 2} / span 4">${monthFmt.format(first)}</span>`
        lastMonth = first.getMonth()
      }
    }
    const dayLabels = DAY_LABELS.map(([text, row]) => `<span class="heat-day" style="grid-row:${row + 2}">${text}</span>`).join('')

    let cells = ''
    let shown = 0
    for (let i = 0; i < days; i++) {
      const date = addDays(start, i)
      const a = activity.get(iso(date)) ?? { created: 0, done: 0 }
      const n = countOf(a, metric)
      shown += n
      const detail = describe(a, metric)
      cells += render(heatCellTpl, {
        level: levelOf(n),
        col: Math.floor(i / 7) + 2,
        row: (i % 7) + 2,
        title: `${detail || 'Aucune activité'} · ${dayFmt.format(date)}`,
      })
    }

    const created = [...activity.values()].reduce((s, a) => s + a.created, 0)
    const done = [...activity.values()].reduce((s, a) => s + a.done, 0)
    const activeDays = [...activity.values()].filter((a) => countOf(a, metric) > 0).length

    $('#heatmap').innerHTML = render(heatmapTpl, {
      weeks,
      months,
      dayLabels,
      cells,
      summary: `${plural(created, 'tâche créée', 'tâches créées')} et ${plural(done, 'tâche réalisée', 'tâches réalisées')} sur les ${MONTHS} derniers mois`,
    })
    $('#stat-tiles').innerHTML = [
      { value: created, label: created > 1 ? 'Créées' : 'Créée' },
      { value: done, label: done > 1 ? 'Réalisées' : 'Réalisée' },
      { value: activeDays, label: activeDays > 1 ? 'Jours actifs' : 'Jour actif' },
    ].map((t) => render(statTileTpl, t)).join('')
  }

  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-metric]')
    if (!tab) return
    metric = tab.dataset.metric
    root.querySelectorAll('[data-metric]').forEach((b) => b.setAttribute('aria-selected', String(b === tab)))
    renderHeatmap()
  })

  renderHeatmap() // grille vide pendant le chargement
  api
    .activity(iso(start), iso(end))
    .then((list) => {
      activity = new Map(list.map((a) => [a.date, a]))
      if (root.isConnected) renderHeatmap()
    })
    .catch((err) => {
      if (err.status === 401 || !root.isConnected) return // l'appli renvoie déjà à la connexion
      $('#heatmap').insertAdjacentHTML('afterend', render(emptyNoteTpl, { text: messageFor(err) }))
    })
}
