const BASE_URL = import.meta.env?.VITE_API_URL ?? 'http://localhost:8080'
const SESSION_KEY = 'todo.session'

export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

export const session = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY))
    } catch {
      return null
    }
  },
  set(token, user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }))
  },
  clear() {
    localStorage.removeItem(SESSION_KEY)
  },
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const s = session.get()
    if (s?.token) headers.Authorization = `Bearer ${s.token}`
  }

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Impossible de joindre le serveur.')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (auth && res.status === 401) {
      session.clear()
      window.dispatchEvent(new Event('session-expired'))
    }
    throw new ApiError(res.status, data?.message ?? res.statusText, data?.errors ?? {})
  }
  return data
}

const MESSAGES = {
  'Invalid credentials': 'Email ou mot de passe incorrect.',
  'Username already taken': "Ce nom d'utilisateur est déjà pris.",
  'Email already used': 'Cet email est déjà utilisé.',
  'Validation failed': 'Merci de corriger les champs en erreur.',
  'Current password is incorrect': 'Le mot de passe actuel est incorrect.',
  'endDate must not be before startDate': 'La date de fin ne peut pas précéder la date de début.',
}

export function messageFor(err) {
  if (err.status === 0) return err.message
  return MESSAGES[err.message] ?? 'Une erreur est survenue, réessaie.'
}

// Critères de recherche -> "?q=...&startDate=..." ; les critères vides ne sont pas envoyés
function queryString({ q, startDate, endDate, place, levels, done } = {}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  if (place) params.set('place', place)
  if (levels?.length) params.set('levels', levels.join(','))
  if (done !== undefined) params.set('done', done)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const api = {
  async login(email, password) {
    const { token, user } = await request('/auth/login', { method: 'POST', body: { email, password } })
    session.set(token, user)
    return user
  },

  async register(username, email, password) {
    await request('/auth/register', { method: 'POST', body: { username, email, password } })
    return this.login(email, password)
  },

  me() {
    return request('/users/me', { auth: true })
  },

  // Met aussi à jour l'utilisateur gardé en session (le nom affiché dans l'en-tête en dépend)
  async updateMe(body) {
    const user = await request('/users/me', { method: 'PUT', body, auth: true })
    const saved = session.get()
    if (saved) session.set(saved.token, user)
    return user
  },

  changePassword(body) {
    return request('/users/me/password', { method: 'PUT', body, auth: true })
  },

  deleteAccount(password) {
    return request('/users/me', { method: 'DELETE', body: { password }, auth: true })
  },

  tasks() {
    return request('/tasks', { auth: true })
  },

  places() {
    return request('/search/places', { auth: true })
  },

  searchTasks(criteria) {
    return request(`/search/tasks${queryString(criteria)}`, { auth: true })
  },

  todoTasks() {
    return request('/search/tasks/todo', { auth: true })
  },

  doneTasks() {
    return request('/search/tasks/done', { auth: true })
  },

  activity(from, to) {
    return request(`/stats/activity?from=${from}&to=${to}`, { auth: true })
  },

  setReminder(id, enabled) {
    return request(`/tasks/${id}/reminder`, { method: 'PUT', body: { enabled }, auth: true })
  },

  todayReminders(date) {
    return request(`/search/tasks/reminders?date=${date}`, { auth: true })
  },

  createTask(body) {
    return request('/tasks', { method: 'POST', body, auth: true })
  },

  updateTask(id, body) {
    return request(`/tasks/${id}`, { method: 'PUT', body, auth: true })
  },

  deleteTask(id) {
    return request(`/tasks/${id}`, { method: 'DELETE', auth: true })
  },
}
