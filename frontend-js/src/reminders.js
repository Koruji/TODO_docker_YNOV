import { api, session } from './api.js'

// Rappels : le navigateur notifie, le matin, à midi et le soir, les tâches du jour dont la cloche est activée.
// Limite : tant que l'application est ouverte dans un onglet ou une fenêtre (pas de notification en arrière-plan sans serveur push).
const SLOTS = [8, 13, 18]
const GRACE_MINUTES = 30 // si l'appli s'ouvre un peu après l'heure, le rappel part quand même
const CHECK_EVERY_MS = 30_000
const LAST_KEY = 'todo:reminders:last'

export const slotsLabel = () => SLOTS.map((h) => `${h} h`).join(', ').replace(/, (\d+ h)$/, ' et $1')

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const fromIso = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const supported = () => typeof Notification !== 'undefined'

// À appeler depuis un clic : c'est le seul moment où le navigateur accepte de demander l'autorisation
export async function ensurePermission() {
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'default') return Notification.requestPermission()
  return Notification.permission
}

function show(title, body, tag) {
  if (!supported() || Notification.permission !== 'granted') return false
  try {
    new Notification(title, { body, tag })
    return true
  } catch {
    return false // certains navigateurs mobiles n'autorisent que les notifications d'un service worker
  }
}

// Texte « tel jour » d'une tâche
function whenText(task) {
  const start = task.startDate ?? task.endDate
  const end = task.endDate ?? task.startDate
  const today = iso(new Date())
  if (start <= today && today <= end) return "aujourd'hui"
  if (start === end) return `le ${dayFmt.format(fromIso(start))}`
  return `du ${dayFmt.format(fromIso(start))} au ${dayFmt.format(fromIso(end))}`
}

// Notification immédiate quand on active la cloche (sert à tester sans attendre 8 h)
export function announceReminder(task) {
  return show(`Rappel : ${task.label}`, `À réaliser ${whenText(task)}`, `task-${task.id}`)
}

const byImportance = (a, b) => (b.level ?? -1) - (a.level ?? -1) || a.label.localeCompare(b.label, 'fr')

function digest(tasks) {
  const list = [...tasks].sort(byImportance)
  const title = list.length === 1 ? 'À réaliser aujourd’hui' : `${list.length} tâches à réaliser aujourd’hui`
  const shown = list.slice(0, 4).map((t) => t.label)
  if (list.length > 4) shown.push(`… et ${list.length - 4} autre${list.length - 4 > 1 ? 's' : ''}`)
  return { title, body: shown.join('\n') }
}

function currentSlot(now) {
  return SLOTS.find((h) => {
    const late = (now - new Date(now.getFullYear(), now.getMonth(), now.getDate(), h)) / 60000
    return late >= 0 && late <= GRACE_MINUTES
  })
}

const read = () => {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}
const write = (value) => {
  try {
    if (value === null) localStorage.removeItem(LAST_KEY)
    else localStorage.setItem(LAST_KEY, value)
  } catch {
    // stockage indisponible : au pire le rappel peut être renvoyé
  }
}

async function check() {
  if (document.hidden) return // onglet en arrière-plan : on revérifie dès qu'il redevient visible
  const saved = session.get()
  if (!saved || !supported() || Notification.permission !== 'granted') return
  const now = new Date()
  const slot = currentSlot(now)
  if (slot === undefined) return

  const key = `${saved.user.id}|${iso(now)}|${slot}` // un seul rappel par créneau et par jour
  if (read() === key) return
  write(key)
  try {
    const tasks = await api.todayReminders(iso(now))
    if (!tasks.length) return
    const { title, body } = digest(tasks)
    show(title, body, `reminders-${slot}`)
  } catch {
    write(null) // échec réseau : on réessaiera au prochain passage
  }
}

let started = false
export function startReminders() {
  if (started) return
  started = true
  setInterval(check, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  check()
}
