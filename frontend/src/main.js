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
import graph from 'bootstrap-icons/icons/bar-chart-line.svg?raw'
import gear from 'bootstrap-icons/icons/gear.svg?raw'
import gearFill from 'bootstrap-icons/icons/gear-fill.svg?raw'
import { api, session } from './api.js'
import { render as fill, submitForm } from './utils.js'
import ambientTpl from './templates/layout/ambient.html?raw'
import authShellTpl from './templates/auth/auth-shell.html?raw'
import fieldTpl from './templates/auth/field.html?raw'
import loginFormTpl from './templates/auth/login-form.html?raw'
import registerFormTpl from './templates/auth/register-form.html?raw'
import emptyStateTpl from './templates/pages/empty-state.html?raw'
import sectionTpl from './templates/pages/section.html?raw'
import settingsTpl from './templates/pages/settings.html?raw'
import shellTpl from './templates/layout/shell.html?raw'
import dockItemTpl from './templates/layout/dock-item.html?raw'
import pageTitleTpl from './templates/layout/page-title.html?raw'
import { mountMenu } from './tasks.js'
import { mountStats } from './stats.js'

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

// title : texte de l'en-tête de la page (par défaut « Bonjour {nom} ! »), titleIcon : petite icône à sa suite
const greeting = (name) => `Bonjour ${name} !`
const PAGES = [
  { path: '/menu', label: 'Menu', icon: house, iconOn: houseFill },
  {
    path: '/stats', label: 'Statistiques', icon: barChart, iconOn: barChartFill,
    title: (name) => `Envie d'avoir une vue d'ensemble ${name} ?`, titleIcon: graph,
  },
  { path: '/calendar', label: 'Calendrier', icon: calendar, iconOn: calendarFill },
  { path: '/settings', label: 'Paramètres', icon: gear, iconOn: gearFill },
]

const section = (title, icon, text) =>
  fill(sectionTpl, { title, empty: fill(emptyStateTpl, { icon, text }) })

const VIEWS = {
  '/menu': () => '<main class="home"></main>',
  '/stats': () => '<main class="home"></main>',
  '/calendar': () => section('Calendrier', calendar, 'Bientôt disponible'),
  '/settings': () => settingsTpl,
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

function pageView(path) {
  if (!document.querySelector('.page')) shellView()

  const index = PAGES.findIndex((p) => p.path === path)
  const page = PAGES[index]
  document.querySelector('#page-title').innerHTML = fill(pageTitleTpl, {
    text: (page.title ?? greeting)(user.username),
    icon: page.titleIcon ?? stars,
  })
  const dock = document.querySelector('.dock')
  dock.style.setProperty('--i', index)
  dock.querySelectorAll('a').forEach((link, i) => {
    if (i === index) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })

  const view = document.querySelector('#view')
  view.innerHTML = VIEWS[path]()
  if (path === '/menu') mountMenu(view.querySelector('.home'), user)
  if (path === '/stats') mountStats(view.querySelector('.home'))
  if (path === '/settings') view.querySelector('#logout').addEventListener('click', logout)
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

if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
  let frame = 0
  window.addEventListener('pointermove', (e) => {
    if (frame || e.pointerType === 'touch') return
    frame = requestAnimationFrame(() => {
      frame = 0
      const root = document.documentElement.style
      root.setProperty('--px', `${(e.clientX / innerWidth - 0.5) * -24}px`)
      root.setProperty('--py', `${(e.clientY / innerHeight - 0.5) * -24}px`)
    })
  })
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
