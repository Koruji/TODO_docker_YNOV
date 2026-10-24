import '@fontsource-variable/lexend'
import '@fontsource-variable/nunito-sans'
import './style.css'
import house from 'bootstrap-icons/icons/house.svg?raw'
import houseFill from 'bootstrap-icons/icons/house-fill.svg?raw'
import barChart from 'bootstrap-icons/icons/bar-chart.svg?raw'
import barChartFill from 'bootstrap-icons/icons/bar-chart-fill.svg?raw'
import calendar from 'bootstrap-icons/icons/calendar-week.svg?raw'
import calendarFill from 'bootstrap-icons/icons/calendar-week-fill.svg?raw'
import stars from 'bootstrap-icons/icons/stars.svg?raw'
import gear from 'bootstrap-icons/icons/gear.svg?raw'
import gearFill from 'bootstrap-icons/icons/gear-fill.svg?raw'
import { api, session, statusOf } from './api'
import { must, render as fill, submitForm } from './utils'
import type { User } from './types'
import ambientTpl from './templates/layout/ambient.html?raw'
import authShellTpl from './templates/auth/auth-shell.html?raw'
import fieldTpl from './templates/auth/field.html?raw'
import loginFormTpl from './templates/auth/login-form.html?raw'
import registerFormTpl from './templates/auth/register-form.html?raw'
import shellTpl from './templates/layout/shell.html?raw'
import dockItemTpl from './templates/layout/dock-item.html?raw'
import pageTitleTpl from './templates/layout/page-title.html?raw'
import mascotTpl from './templates/layout/mascot.html?raw'
import { mountMenu } from './tasks'
import { mountStats } from './stats'
import { mountSettings } from './settings'
import { mountCalendar } from './calendar'
import { startReminders } from './reminders'

let user: User | null = null

const app = must<HTMLElement>(document, '#app')

interface FieldOptions {
  id: string
  label: string
  type?: string
  autocomplete: string
  hint?: string
}

const field = ({ id, label, type = 'text', autocomplete, hint = '' }: FieldOptions): string =>
  fill(fieldTpl, { id, label, type, autocomplete, hint })

const authShell = (title: string, form: string, switchText: string): string =>
  fill(authShellTpl, { ambient: ambientTpl, title, form, switchText })

interface LoginElements extends HTMLFormControlsCollection {
  email: HTMLInputElement
  password: HTMLInputElement
}

interface RegisterElements extends LoginElements {
  username: HTMLInputElement
}

function loginView(): void {
  const form = fill(loginFormTpl, {
    email: field({ id: 'email', label: 'Email', type: 'email', autocomplete: 'email' }),
    password: field({ id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'current-password' }),
  })
  app.innerHTML = authShell('CONNEXION', form, 'Pas encore de compte ? <a href="#/register">Créer un compte</a>')

  must<HTMLFormElement>(document, '#login-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const f = form.elements as LoginElements
    submitForm(form, async () => {
      user = await api.login(f.email.value.trim(), f.password.value)
      location.hash = '#/menu'
    })
  })
}

function registerView(): void {
  const form = fill(registerFormTpl, {
    username: field({ id: 'username', label: "Nom d'utilisateur", autocomplete: 'username' }),
    email: field({ id: 'email', label: 'Email', type: 'email', autocomplete: 'email' }),
    password: field({ id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'new-password', hint: '8 caractères minimum' }),
  })
  app.innerHTML = authShell('Renseignez vos informations', form, 'Vous avez déjà un compte ? <a href="#/login">Se connecter</a>')

  must<HTMLFormElement>(document, '#register-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const f = form.elements as RegisterElements
    submitForm(form, async () => {
      user = await api.register(f.username.value.trim(), f.email.value.trim(), f.password.value)
      location.hash = '#/menu'
    })
  })
}

type Route = '/menu' | '/stats' | '/calendar' | '/settings'

interface Page {
  path: Route
  label: string
  icon: string
  iconOn: string
  mascot?: boolean // la mascotte s'affiche à droite de l'en-tête
  title?: (name: string) => [string, string, string] // texte de l'en-tête [avant, nom, après] (par défaut « Bonjour {nom} ! »)
  titleIcon?: string | null // petite icône à sa suite (null = aucune)
}

const greeting = (name: string): [string, string, string] => ['Bonjour ', name, ' !']
const PAGES: Page[] = [
  { path: '/menu', label: 'Menu', icon: house, iconOn: houseFill, mascot: true },
  {
    path: '/stats', label: 'Statistiques', icon: barChart, iconOn: barChartFill,
    title: (name) => ["Envie d'avoir une vue d'ensemble ", name, ' ?'], titleIcon: null,
  },
  {
    path: '/calendar', label: 'Calendrier', icon: calendar, iconOn: calendarFill,
    title: (name) => ['Ne perdez pas le fil de vos tâches, ', name, ' !'],
  },
  {
    path: '/settings', label: 'Paramètres', icon: gear, iconOn: gearFill,
    title: (name) => ['Besoin de modifier vos données personnelles, ', name, ' ?'], titleIcon: null,
  },
]

const VIEWS: Record<Route, () => string> = {
  '/menu': () => '<main class="home"></main>',
  '/stats': () => '<main class="home"></main>',
  '/calendar': () => '<main class="home"></main>',
  '/settings': () => '<main class="home"></main>',
}

function shellView(): void {
  app.innerHTML = fill(shellTpl, {
    ambient: ambientTpl,
    dockItems: PAGES.map((p) => fill(dockItemTpl, p)).join(''),
  })
}

function logout(): void {
  session.clear()
  user = null
  location.hash = '#/login'
}

function setTitle(page: Page, current: User): void {
  const [before, name, after] = (page.title ?? greeting)(current.username)
  must(document, '#page-title').innerHTML = fill(pageTitleTpl, {
    before,
    name,
    after,
    icon: 'titleIcon' in page ? page.titleIcon : stars,
  })
  must(document, '.topbar').classList.toggle('has-mascot', !!page.mascot)
  must(document, '#header-mascot').innerHTML = page.mascot ? mascotTpl : ''
}

function pageView(path: Route, current: User): void {
  if (!document.querySelector('.page')) shellView()

  const index = PAGES.findIndex((p) => p.path === path)
  const page = PAGES[index]
  setTitle(page, current)
  const dock = must(document, '.dock')
  dock.style.setProperty('--i', String(index))
  dock.querySelectorAll('a').forEach((link, i) => {
    if (i === index) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })

  const view = must(document, '#view')
  view.innerHTML = VIEWS[path]()
  const home = must(view, '.home')
  if (path === '/menu') mountMenu(home)
  if (path === '/stats') mountStats(home)
  if (path === '/calendar') mountCalendar(home)
  if (path === '/settings') {
    mountSettings(home, current, {
      onLogout: logout,
      onProfile: (updated) => {
        user = updated
        setTitle(page, updated)
      },
    })
  }
}

const isRoute = (route: string): route is Route => PAGES.some((p) => p.path === route)

function render(): void {
  const route = location.hash.replace('#', '') || '/login'
  if (route === '/home') return void (location.hash = '#/menu')

  if (isRoute(route)) {
    if (!user) return void (location.hash = '#/login')
    return pageView(route, user)
  }
  if (user) return void (location.hash = '#/menu')
  return route === '/register' ? registerView() : loginView()
}

window.addEventListener('session-expired', () => {
  user = null
  location.hash = '#/login'
})

window.addEventListener('hashchange', render)

async function boot(): Promise<void> {
  const saved = session.get()
  if (saved) {
    try {
      user = await api.me()
    } catch (err) {
      if (statusOf(err) === 0) user = saved.user
      else session.clear()
    }
  }
  render()
}

boot()
startReminders()
