import '@fontsource-variable/lexend'
import '@fontsource-variable/nunito-sans'
import './style.css'
import { api, session, messageFor } from './api.js'

let user = null

const app = document.querySelector('#app')

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

async function submitForm(form, action) {
  const button = form.querySelector('button[type="submit"]')
  const label = button.textContent
  const alert = form.querySelector('.alert')

  alert.hidden = true
  form.querySelectorAll('.field-error').forEach((el) => el.remove())
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'))

  button.disabled = true
  button.textContent = 'Un instant…'
  try {
    await action()
  } catch (err) {
    alert.textContent = messageFor(err)
    alert.hidden = false
    for (const [name, message] of Object.entries(err.fields ?? {})) {
      const input = form.elements[name]
      if (!input) continue
      input.setAttribute('aria-invalid', 'true')
      input.insertAdjacentHTML('afterend', `<p class="field-error">${escapeHtml(message)}</p>`)
    }
  } finally {
    button.disabled = false
    button.textContent = label
  }
}

const logo = `
  <div class="brand">
    <span class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
    </span>
    <span class="brand-name">TODO</span>
  </div>`

function field({ id, label, type = 'text', autocomplete, hint = '' }) {
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <input id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}" autocapitalize="none" spellcheck="false" required />
      ${hint ? `<p class="hint">${hint}</p>` : ''}
    </div>`
}

function authShell(active, title, subtitle, form) {
  return `
    <main class="auth">
      <section class="auth-card">
        ${logo}
        <h1>${title}</h1>
        <p class="subtitle">${subtitle}</p>

        <nav class="tabs" aria-label="Authentification">
          <a href="#/login" class="${active === 'login' ? 'active' : ''}" ${active === 'login' ? 'aria-current="page"' : ''}>Connexion</a>
          <a href="#/register" class="${active === 'register' ? 'active' : ''}" ${active === 'register' ? 'aria-current="page"' : ''}>Créer un compte</a>
        </nav>

        ${form}
      </section>
      <p class="auth-footer">Organise tes tâches, seul ou à plusieurs.</p>
    </main>`
}

function loginView() {
  app.innerHTML = authShell('login', 'Bon retour 👋', 'Connecte-toi pour retrouver tes tâches.', `
    <form id="login-form" class="form" novalidate>
      <div class="alert" role="alert" hidden></div>
      ${field({ id: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
      ${field({ id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'current-password' })}
      <button type="submit" class="btn btn-primary">Se connecter</button>
    </form>
    <p class="switch">Pas encore de compte ? <a href="#/register">Créer un compte</a></p>`)

  document.querySelector('#login-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target
    submitForm(form, async () => {
      user = await api.login(form.elements.email.value.trim(), form.elements.password.value)
      location.hash = '#/home'
    })
  })
}

function registerView() {
  app.innerHTML = authShell('register', 'Crée ton profil', 'Quelques secondes suffisent pour commencer.', `
    <form id="register-form" class="form" novalidate>
      <div class="alert" role="alert" hidden></div>
      ${field({ id: 'username', label: "Nom d'utilisateur", autocomplete: 'username' })}
      ${field({ id: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
      ${field({ id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'new-password', hint: '8 caractères minimum' })}
      <button type="submit" class="btn btn-primary">Créer mon compte</button>
    </form>
    <p class="switch">Déjà inscrit ? <a href="#/login">Se connecter</a></p>`)

  document.querySelector('#register-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target
    submitForm(form, async () => {
      user = await api.register(form.elements.username.value.trim(), form.elements.email.value.trim(), form.elements.password.value)
      location.hash = '#/home'
    })
  })
}

function homeView() {
  const name = escapeHtml(user.username)
  const initial = escapeHtml(user.username.charAt(0).toUpperCase())
  app.innerHTML = `
    <header class="topbar">
      ${logo}
      <div class="topbar-user">
        <span class="avatar" aria-hidden="true">${initial}</span>
        <span class="topbar-name">${name}</span>
        <button id="logout" type="button" class="btn btn-ghost">Se déconnecter</button>
      </div>
    </header>

    <main class="home">
      <h1>Bonjour ${name} 👋</h1>
      <p class="subtitle">Te voilà connecté.</p>

      <div class="empty">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/></svg>
        </div>
        <h2>Aucune tâche pour le moment</h2>
        <p>Tes tâches apparaîtront ici dès qu'on aura construit cet écran.</p>
      </div>
    </main>`

  document.querySelector('#logout').addEventListener('click', () => {
    session.clear()
    user = null
    location.hash = '#/login'
  })
}

function render() {
  const route = location.hash.replace('#', '') || '/login'
  if (route === '/home') {
    if (!user) return void (location.hash = '#/login')
    return homeView()
  }
  if (user) return void (location.hash = '#/home')
  return route === '/register' ? registerView() : loginView()
}

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
