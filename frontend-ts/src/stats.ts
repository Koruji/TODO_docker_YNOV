import { api, messageFor, statusOf } from './api'
import { closestFrom, must, render } from './utils'
import type { DailyActivity } from './types'
import statsTpl from './templates/stats/stats.html?raw'
import heatmapTpl from './templates/stats/heatmap.html?raw'
import heatCellTpl from './templates/stats/heat-cell.html?raw'
import statTileTpl from './templates/stats/stat-tile.html?raw'
import emptyNoteTpl from './templates/homepage/components/empty-note.html?raw'

const MONTHS = 4
const DAY_LABELS: [string, number][] = [['Lun', 1], ['Mer', 3], ['Ven', 5]] // [texte, ligne 0 = lundi]

type Metric = 'all' | 'created' | 'done'
type Count = Pick<DailyActivity, 'created' | 'done'>

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short' })
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const pad = (n: number): string => String(n).padStart(2, '0')
const iso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`

// Fenêtre affichée : de 4 mois en arrière (calée sur le lundi de la semaine) jusqu'à aujourd'hui
function window4Months(): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const back = new Date(end.getFullYear(), end.getMonth() - MONTHS, end.getDate() + 1)
  const start = addDays(back, -((back.getDay() + 6) % 7)) // lundi
  return { start, end }
}

const levelOf = (n: number): number => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4)

const countOf = (a: Count, metric: Metric): number =>
  metric === 'created' ? a.created : metric === 'done' ? a.done : a.created + a.done

const describe = (a: Count, metric: Metric): string => {
  const parts: string[] = []
  if (metric !== 'done' && a.created) parts.push(plural(a.created, 'tâche créée', 'tâches créées'))
  if (metric !== 'created' && a.done) parts.push(plural(a.done, 'tâche réalisée', 'tâches réalisées'))
  return parts.join(' et ')
}

export function mountStats(root: HTMLElement): void {
  root.classList.add('home-stats')
  root.innerHTML = statsTpl

  const $ = <T extends Element = HTMLElement>(sel: string): T => must<T>(root, sel)
  const { start, end } = window4Months()
  let metric: Metric = 'all'
  let activity = new Map<string, DailyActivity>() // 'YYYY-MM-DD' -> { created, done }

  function renderHeatmap(): void {
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
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
    for (let i = 0; i < days; i++) {
      const date = addDays(start, i)
      const a: Count = activity.get(iso(date)) ?? { created: 0, done: 0 }
      const n = countOf(a, metric)
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
    const tab = closestFrom(e.target, '[data-metric]')
    if (!tab) return
    metric = tab.dataset.metric as Metric
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
    .catch((err: unknown) => {
      if (statusOf(err) === 401 || !root.isConnected) return // l'appli renvoie déjà à la connexion
      $('#heatmap').insertAdjacentHTML('afterend', render(emptyNoteTpl, { text: messageFor(err) }))
    })
}
