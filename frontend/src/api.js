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
    throw new ApiError(res.status, data?.message ?? res.statusText, data?.errors ?? {})
  }
  return data
}

const MESSAGES = {
  'Invalid credentials': 'Email ou mot de passe incorrect.',
  'Username already taken': "Ce nom d'utilisateur est déjà pris.",
  'Email already used': 'Cet email est déjà utilisé.',
  'Validation failed': 'Merci de corriger les champs en erreur.',
}

export function messageFor(err) {
  if (err.status === 0) return err.message
  return MESSAGES[err.message] ?? 'Une erreur est survenue, réessaie.'
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
}
