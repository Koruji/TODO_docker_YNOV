import type {
  AuthResponse,
  DailyActivity,
  FieldErrors,
  PasswordUpdateRequest,
  SearchCriteria,
  Session,
  Task,
  TaskRequest,
  User,
  UserUpdateRequest,
} from './types'

const BASE_URL: string = import.meta.env?.VITE_API_URL ?? 'http://localhost:8080'
const SESSION_KEY = 'todo.session'

export class ApiError extends Error {
  status: number
  fields: FieldErrors

  constructor(status: number, message: string, fields: FieldErrors = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

// Code HTTP d'une erreur (undefined si ce n'est pas une ApiError)
export const statusOf = (err: unknown): number | undefined => (err instanceof ApiError ? err.status : undefined)

export const session = {
  get(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw === null ? null : (JSON.parse(raw) as Session | null)
    } catch {
      return null
    }
  },
  set(token: string, user: User): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }))
  },
  clear(): void {
    localStorage.removeItem(SESSION_KEY)
  },
}

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean
}

async function request<T>(path: string, { method = 'GET', body, auth = false }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const s = session.get()
    if (s?.token) headers.Authorization = `Bearer ${s.token}`
  }

  let res: Response
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
  return data as T
}

const MESSAGES: Record<string, string> = {
  'Invalid credentials': 'Email ou mot de passe incorrect.',
  'Username already taken': "Ce nom d'utilisateur est déjà pris.",
  'Email already used': 'Cet email est déjà utilisé.',
  'Validation failed': 'Merci de corriger les champs en erreur.',
  'Current password is incorrect': 'Le mot de passe actuel est incorrect.',
  'endDate must not be before startDate': 'La date de fin ne peut pas précéder la date de début.',
}

export function messageFor(err: unknown): string {
  if (err instanceof ApiError && err.status === 0) return err.message
  const message = err instanceof Error ? err.message : ''
  return MESSAGES[message] ?? 'Une erreur est survenue, réessaie.'
}

// Critères de recherche -> "?q=...&startDate=..." ; les critères vides ne sont pas envoyés
function queryString({ q, startDate, endDate, place, levels, done }: SearchCriteria = {}): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  if (place) params.set('place', place)
  if (levels?.length) params.set('levels', levels.join(','))
  if (done !== undefined) params.set('done', String(done))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const api = {
  async login(email: string, password: string): Promise<User> {
    const { token, user } = await request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } })
    session.set(token, user)
    return user
  },

  async register(username: string, email: string, password: string): Promise<User> {
    await request<unknown>('/auth/register', { method: 'POST', body: { username, email, password } })
    return this.login(email, password)
  },

  me(): Promise<User> {
    return request<User>('/users/me', { auth: true })
  },

  // Met aussi à jour l'utilisateur gardé en session (le nom affiché dans l'en-tête en dépend)
  async updateMe(body: UserUpdateRequest): Promise<User> {
    const user = await request<User>('/users/me', { method: 'PUT', body, auth: true })
    const saved = session.get()
    if (saved) session.set(saved.token, user)
    return user
  },

  changePassword(body: PasswordUpdateRequest): Promise<unknown> {
    return request<unknown>('/users/me/password', { method: 'PUT', body, auth: true })
  },

  deleteAccount(password: string): Promise<unknown> {
    return request<unknown>('/users/me', { method: 'DELETE', body: { password }, auth: true })
  },

  places(): Promise<string[]> {
    return request<string[]>('/search/places', { auth: true })
  },

  searchTasks(criteria: SearchCriteria): Promise<Task[]> {
    return request<Task[]>(`/search/tasks${queryString(criteria)}`, { auth: true })
  },

  todoTasks(): Promise<Task[]> {
    return request<Task[]>('/search/tasks/todo', { auth: true })
  },

  doneTasks(): Promise<Task[]> {
    return request<Task[]>('/search/tasks/done', { auth: true })
  },

  activity(from: string, to: string): Promise<DailyActivity[]> {
    return request<DailyActivity[]>(`/stats/activity?from=${from}&to=${to}`, { auth: true })
  },

  setReminder(id: number, enabled: boolean): Promise<Task> {
    return request<Task>(`/tasks/${id}/reminder`, { method: 'PUT', body: { enabled }, auth: true })
  },

  todayReminders(date: string): Promise<Task[]> {
    return request<Task[]>(`/search/tasks/reminders?date=${date}`, { auth: true })
  },

  createTask(body: TaskRequest): Promise<Task> {
    return request<Task>('/tasks', { method: 'POST', body, auth: true })
  },

  updateTask(id: number, body: TaskRequest): Promise<Task> {
    return request<Task>(`/tasks/${id}`, { method: 'PUT', body, auth: true })
  },

  deleteTask(id: number): Promise<unknown> {
    return request<unknown>(`/tasks/${id}`, { method: 'DELETE', auth: true })
  },
}
