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
import { escapeHtml, submitForm } from './utils.js'
import { mountMenu } from './tasks.js'

let user = null

const app = document.querySelector('#app')

const ambient = `
  <div class="ambient" aria-hidden="true">
    <span class="blob blob-1"></span>
    <span class="blob blob-2"></span>
    <span class="blob blob-3"></span>
    <span class="orb"></span>
  </div>`

function field({ id, label, type = 'text', autocomplete, hint = '' }) {
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <input id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}" autocapitalize="none" spellcheck="false" required />
      ${hint ? `<p class="hint">${hint}</p>` : ''}
    </div>`
}

function authShell(title, form, switchText) {
  return `
    <main class="auth">
      ${ambient}
      <section class="auth-card">
        <h1>${title}</h1>
        ${form}
        <p class="switch">${switchText}</p>
      </section>
    </main>`
}

function loginView() {
  app.innerHTML = authShell('CONNEXION', `
    <form id="login-form" class="form" novalidate>
      <div class="alert" role="alert" hidden></div>
      ${field({ id: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
      ${field({ id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'current-password' })}
      <button type="submit" class="btn btn-primary">Se connecter</button>
    </form>`, 'Pas encore de compte ? <a href="#/register">Créer un compte</a>')

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
  app.innerHTML = authShell('Renseignez vos informations', `
    <form id="register-form" class="form" novalidate>
      <div class="alert" role="alert" hidden></div>
      ${field({ id: 'username', label: "Nom d'utilisateur", autocomplete: 'username' })}
      ${field({ id: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
      ${field({ id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'new-password', hint: '8 caractères minimum' })}
      <button type="submit" class="btn btn-primary">Créer mon compte</button>
    </form>`, 'Vous avez déjà un compte ? <a href="#/login">Se connecter</a>')

  document.querySelector('#register-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target
    submitForm(form, async () => {
      user = await api.register(form.elements.username.value.trim(), form.elements.email.value.trim(), form.elements.password.value)
      location.hash = '#/menu'
    })
  })
}

const PAGES = [
  { path: '/menu', label: 'Menu', icon: house, iconOn: houseFill },
  { path: '/stats', label: 'Statistiques', icon: barChart, iconOn: barChartFill },
  { path: '/calendar', label: 'Calendrier', icon: calendar, iconOn: calendarFill },
  { path: '/settings', label: 'Paramètres', icon: gear, iconOn: gearFill },
]

const emptyState = (svg, text) => `
  <div class="empty">
    <div class="empty-icon" aria-hidden="true">${svg}</div>
    <h2>${text}</h2>
  </div>`

const section = (title, svg, text) => `
  <main class="home">
    <h1>${title}</h1>
    ${emptyState(svg, text)}
  </main>`

const VIEWS = {
  '/menu': () => '<main class="home"></main>',
  '/stats': () => section('Statistiques', barChart, 'Bientôt disponible'),
  '/calendar': () => section('Calendrier', calendar, 'Bientôt disponible'),
  '/settings': () => `
    <main class="home">
      <h1>Paramètres</h1>
      <div class="settings">
        <button id="logout" type="button" class="btn btn-danger">Se déconnecter</button>
      </div>
    </main>`,
}

function shellView() {
  const name = escapeHtml(user.username)
  app.innerHTML = `
    <div class="page">
      ${ambient}

      <header class="topbar">
        <h1>Bonjour ${escapeHtml(name)} ! <span class="title-icon" aria-hidden="true">${stars}</span></h1>
      </header>

      <div id="view"></div>

      <nav class="dock" aria-label="Navigation principale">
        <span class="dock-indicator" aria-hidden="true"></span>
        ${PAGES.map((p) => `
          <a href="#${p.path}" aria-label="${p.label}" title="${p.label}">
            <span class="ic ic-off">${p.icon}</span><span class="ic ic-on">${p.iconOn}</span>
          </a>`).join('')}
      </nav>
    </div>`
}

function logout() {
  session.clear()
  user = null
  location.hash = '#/login'
}

function pageView(path) {
  if (!document.querySelector('.page')) shellView()

  const index = PAGES.findIndex((p) => p.path === path)
  const dock = document.querySelector('.dock')
  dock.style.setProperty('--i', index)
  dock.querySelectorAll('a').forEach((link, i) => {
    if (i === index) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })

  const view = document.querySelector('#view')
  view.innerHTML = VIEWS[path]()
  if (path === '/menu') mountMenu(view.querySelector('.home'), user)
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
