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
import { api, session } from './api.js'
import { render as fill, submitForm } from './utils.js'
import ambientTpl from './templates/layout/ambient.html?raw'
import authShellTpl from './templates/auth/auth-shell.html?raw'
import fieldTpl from './templates/auth/field.html?raw'
import loginFormTpl from './templates/auth/login-form.html?raw'
import registerFormTpl from './templates/auth/register-form.html?raw'
import shellTpl from './templates/layout/shell.html?raw'
import dockItemTpl from './templates/layout/dock-item.html?raw'
import pageTitleTpl from './templates/layout/page-title.html?raw'
import mascotTpl from './templates/layout/mascot.html?raw'
import { mountMenu } from './tasks.js'
import { mountStats } from './stats.js'
import { mountSettings } from './settings.js'
import { mountCalendar } from './calendar.js'
import { startReminders } from './reminders.js'

let user = null

const app = document.querySelector('#app')

const field = ({ id, label, type = 'text', autocomplete, hint = '' }) =>
  fill(fieldTpl, { id, label, type, autocomplete, hint })

const authShell = (title, form, switchText) => fill(authShellTpl, { ambient: ambientTpl, title, form, switchText })

function loginView() {
  const form = fill(loginFormTpl, {
    email: field({ id: 'email', label: 'Email', type: 'email', autocomplete: 'email' }),
    password: field({ id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'current-password' }),
  })
  app.innerHTML = authShell('CONNEXION', form, 'Pas encore de compte ? <a href="#/register">Créer un compte</a>')

  document.querySelector('#login-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target
    submitForm(form, async () => {
      user = await api.login(form.elements.email.value.trim(), form.elements.password.value)
      location.hash = '#/menu'
    })
  })
}

function registerView() {
  const form = fill(registerFormTpl, {
    username: field({ id: 'username', label: "Nom d'utilisateur", autocomplete: 'username' }),
    email: field({ id: 'email', label: 'Email', type: 'email', autocomplete: 'email' }),
    password: field({ id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'new-password', hint: '8 caractères minimum' }),
  })
  app.innerHTML = authShell('Renseignez vos informations', form, 'Vous avez déjà un compte ? <a href="#/login">Se connecter</a>')

  document.querySelector('#register-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target
    submitForm(form, async () => {
      user = await api.register(form.elements.username.value.trim(), form.elements.email.value.trim(), form.elements.password.value)
      location.hash = '#/menu'
    })
  })
}

// title : texte de l'en-tête [avant, nom, après] (par défaut « Bonjour {nom} ! »), titleIcon : petite icône à sa suite (null = aucune)
const greeting = (name) => ['Bonjour ', name, ' !']
const PAGES = [
  { path: '/menu', label: 'Menu', icon: house, iconOn: houseFill, mascot: true }, // mascot : la mascotte s'affiche à droite de l'en-tête
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

const VIEWS = {
  '/menu': () => '<main class="home"></main>',
  '/stats': () => '<main class="home"></main>',
  '/calendar': () => '<main class="home"></main>',
  '/settings': () => '<main class="home"></main>',
}

function shellView() {
  app.innerHTML = fill(shellTpl, {
    ambient: ambientTpl,
    dockItems: PAGES.map((p) => fill(dockItemTpl, p)).join(''),
  })
}

function logout() {
  session.clear()
  user = null
  location.hash = '#/login'
}

function setTitle(page) {
  const [before, name, after] = (page.title ?? greeting)(user.username)
  document.querySelector('#page-title').innerHTML = fill(pageTitleTpl, {
    before,
    name,
    after,
    icon: 'titleIcon' in page ? page.titleIcon : stars,
  })
  document.querySelector('.topbar').classList.toggle('has-mascot', !!page.mascot)
  document.querySelector('#header-mascot').innerHTML = page.mascot ? mascotTpl : ''
}

function pageView(path) {
  if (!document.querySelector('.page')) shellView()

  const index = PAGES.findIndex((p) => p.path === path)
  const page = PAGES[index]
  setTitle(page)
  const dock = document.querySelector('.dock')
  dock.style.setProperty('--i', index)
  dock.querySelectorAll('a').forEach((link, i) => {
    if (i === index) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })

  const view = document.querySelector('#view')
  view.innerHTML = VIEWS[path]()
  if (path === '/menu') mountMenu(view.querySelector('.home'))
  if (path === '/stats') mountStats(view.querySelector('.home'))
  if (path === '/calendar') mountCalendar(view.querySelector('.home'))
  if (path === '/settings') {
    mountSettings(view.querySelector('.home'), user, {
      onLogout: logout,
      onProfile: (updated) => {
        user = updated
        setTitle(page)
      },
    })
  }
}

function render() {
  const route = location.hash.replace('#', '') || '/login'
  if (route === '/home') return void (location.hash = '#/menu')

  if (PAGES.some((p) => p.path === route)) {
    if (!user) return void (location.hash = '#/login')
    return pageView(route)
  }
  if (user) return void (location.hash = '#/menu')
  return route === '/register' ? registerView() : loginView()
}

window.addEventListener('session-expired', () => {
  user = null
  location.hash = '#/login'
})

window.addEventListener('hashchange', render)

async function boot() {
  const saved = session.get()
  if (saved) {
    try {
      user = await api.me()
    } catch (err) {
      if (err.status === 0) user = saved.user 
      else session.clear()
    }
  }
  render()
}

boot()
startReminders()
