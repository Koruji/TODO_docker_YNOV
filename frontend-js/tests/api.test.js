import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}

const events = []
globalThis.window = { dispatchEvent: (event) => events.push(event.type) }

const { api, session, ApiError, messageFor } = await import('../src/api.js')

const originalFetch = globalThis.fetch
let calls

function mockFetch(...responses) {
  calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    const next = responses.shift()
    if (next instanceof Error) throw next
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      statusText: next.statusText ?? '',
      json: async () => {
        if (next.body === undefined) throw new Error('no body')
        return next.body
      },
    }
  }
}

beforeEach(() => {
  store.clear()
  events.length = 0
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('session conserve et efface la session', () => {
  assert.equal(session.get(), null)
  session.set('tok', { id: 1 })
  assert.deepEqual(session.get(), { token: 'tok', user: { id: 1 } })
  session.clear()
  assert.equal(session.get(), null)
})

test('session.get renvoie null si le stockage contient du JSON invalide', () => {
  store.set('todo.session', '{pas du json')
  assert.equal(session.get(), null)
})

test('messageFor traduit les messages connus', () => {
  assert.equal(messageFor(new ApiError(401, 'Invalid credentials')), 'Email ou mot de passe incorrect.')
  assert.equal(messageFor(new ApiError(409, 'Email already used')), 'Cet email est déjà utilisé.')
  assert.equal(messageFor(new ApiError(400, 'Validation failed')), 'Merci de corriger les champs en erreur.')
})

test('messageFor renvoie un message générique pour une erreur inconnue', () => {
  assert.equal(messageFor(new ApiError(500, 'boom')), 'Une erreur est survenue, réessaie.')
})

test('messageFor reprend le message réseau quand le serveur est injoignable', () => {
  assert.equal(messageFor(new ApiError(0, 'Impossible de joindre le serveur.')), 'Impossible de joindre le serveur.')
})

test('login enregistre la session avec le token reçu', async () => {
  mockFetch({ status: 200, body: { token: 'jwt', user: { id: 7, username: 'jade' } } })

  const user = await api.login('jade@ynov.com', 'secret123')

  assert.deepEqual(user, { id: 7, username: 'jade' })
  assert.deepEqual(session.get(), { token: 'jwt', user: { id: 7, username: 'jade' } })
  assert.match(calls[0].url, /\/auth\/login$/)
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'jade@ynov.com', password: 'secret123' })
})

test('register crée le compte puis connecte', async () => {
  mockFetch({ status: 201, body: { id: 7 } }, { status: 200, body: { token: 'jwt', user: { id: 7 } } })

  await api.register('jade', 'jade@ynov.com', 'secret123')

  assert.match(calls[0].url, /\/auth\/register$/)
  assert.match(calls[1].url, /\/auth\/login$/)
  assert.equal(session.get().token, 'jwt')
})

test('les routes protégées envoient le jeton Bearer', async () => {
  session.set('jwt', { id: 1 })
  mockFetch({ status: 200, body: [] })

  await api.todoTasks()

  assert.equal(calls[0].options.headers.Authorization, 'Bearer jwt')
  assert.match(calls[0].url, /\/search\/tasks\/todo$/)
})

test('les routes publiques n’envoient pas de jeton', async () => {
  session.set('jwt', { id: 1 })
  mockFetch({ status: 401, body: { message: 'Invalid credentials' } })

  await assert.rejects(api.login('a@b.com', 'x'), ApiError)

  assert.equal(calls[0].options.headers.Authorization, undefined)
})

test('une erreur API expose le statut, le message et les erreurs par champ', async () => {
  mockFetch({ status: 400, body: { message: 'Validation failed', errors: { email: 'invalide' } } })

  await assert.rejects(api.login('x', 'y'), (err) => {
    assert.ok(err instanceof ApiError)
    assert.equal(err.status, 400)
    assert.equal(err.message, 'Validation failed')
    assert.deepEqual(err.fields, { email: 'invalide' })
    return true
  })
})

test('une réponse sans corps JSON retombe sur le statusText', async () => {
  mockFetch({ status: 502, statusText: 'Bad Gateway' })

  await assert.rejects(api.todoTasks(), (err) => err.status === 502 && err.message === 'Bad Gateway')
})

test('un échec réseau devient une ApiError de statut 0', async () => {
  mockFetch(new TypeError('failed to fetch'))

  await assert.rejects(api.login('a@b.com', 'x'), (err) => err.status === 0 && /joindre le serveur/.test(err.message))
})

test('un 401 sur une route protégée efface la session et signale l’expiration', async () => {
  session.set('jwt', { id: 1 })
  mockFetch({ status: 401, body: { message: 'Unauthorized' } })

  await assert.rejects(api.todoTasks(), ApiError)

  assert.equal(session.get(), null)
  assert.deepEqual(events, ['session-expired'])
})

test('un 401 sur une route publique ne touche pas à la session', async () => {
  session.set('jwt', { id: 1 })
  mockFetch({ status: 401, body: { message: 'Invalid credentials' } })

  await assert.rejects(api.login('a@b.com', 'x'), ApiError)

  assert.notEqual(session.get(), null)
  assert.deepEqual(events, [])
})

test('searchTasks n’envoie que les critères renseignés', async () => {
  session.set('jwt', { id: 1 })
  mockFetch({ status: 200, body: [] }, { status: 200, body: [] })

  await api.searchTasks({ q: 'docker', place: 'Maison', levels: [1, 3], done: false, startDate: '', endDate: undefined })
  await api.searchTasks({})

  const url = new URL(calls[0].url)
  assert.equal(url.pathname, '/search/tasks')
  assert.equal(url.searchParams.get('q'), 'docker')
  assert.equal(url.searchParams.get('place'), 'Maison')
  assert.equal(url.searchParams.get('levels'), '1,3')
  assert.equal(url.searchParams.get('done'), 'false')
  assert.equal(url.searchParams.has('startDate'), false)
  assert.equal(url.searchParams.has('endDate'), false)
  assert.match(calls[1].url, /\/search\/tasks$/)
})

test('updateMe met à jour l’utilisateur gardé en session', async () => {
  session.set('jwt', { id: 1, username: 'jade' })
  mockFetch({ status: 200, body: { id: 1, username: 'jade2' } })

  await api.updateMe({ username: 'jade2' })

  assert.deepEqual(session.get(), { token: 'jwt', user: { id: 1, username: 'jade2' } })
  assert.equal(calls[0].options.method, 'PUT')
})

test('les appels sur une tâche utilisent la bonne route et la bonne méthode', async () => {
  session.set('jwt', { id: 1 })
  mockFetch(
    { status: 200, body: {} },
    { status: 200, body: {} },
    { status: 200, body: {} },
    { status: 200, body: {} },
    { status: 200, body: [] },
    { status: 200, body: [] },
  )

  await api.createTask({ label: 'a' })
  await api.updateTask(5, { label: 'b' })
  await api.deleteTask(5)
  await api.setReminder(5, true)
  await api.todayReminders('2026-10-29')
  await api.activity('2026-10-01', '2026-10-31')

  assert.deepEqual(calls.map((c) => [c.options.method, new URL(c.url).pathname + new URL(c.url).search]), [
    ['POST', '/tasks'],
    ['PUT', '/tasks/5'],
    ['DELETE', '/tasks/5'],
    ['PUT', '/tasks/5/reminder'],
    ['GET', '/search/tasks/reminders?date=2026-10-29'],
    ['GET', '/stats/activity?from=2026-10-01&to=2026-10-31'],
  ])
  assert.deepEqual(JSON.parse(calls[3].options.body), { enabled: true })
})
