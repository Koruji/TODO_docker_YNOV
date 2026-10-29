import { test } from 'node:test'
import assert from 'node:assert/strict'

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }

const { slotsLabel, ensurePermission, announceReminder } = await import('../src/reminders.js')

test('slotsLabel liste les créneaux avec « et » avant le dernier', () => {
  assert.equal(slotsLabel(), '8 h, 13 h et 18 h')
})

test('ensurePermission signale un navigateur sans notifications', async () => {
  delete globalThis.Notification
  assert.equal(await ensurePermission(), 'unsupported')
})

test('ensurePermission demande l’autorisation quand elle n’est pas encore choisie', async () => {
  let asked = 0
  globalThis.Notification = {
    permission: 'default',
    requestPermission: async () => {
      asked++
      return 'granted'
    },
  }

  assert.equal(await ensurePermission(), 'granted')
  assert.equal(asked, 1)
})

test('ensurePermission ne redemande pas une autorisation déjà tranchée', async () => {
  let asked = 0
  globalThis.Notification = {
    permission: 'denied',
    requestPermission: async () => {
      asked++
      return 'granted'
    },
  }

  assert.equal(await ensurePermission(), 'denied')
  assert.equal(asked, 0)
})

test('announceReminder renvoie false sans autorisation', () => {
  globalThis.Notification = Object.assign(function () {}, { permission: 'denied' })
  assert.equal(announceReminder({ id: 1, label: 'Docker', startDate: '2026-10-01', endDate: '2026-10-02' }), false)
})

test('announceReminder notifie « aujourd’hui » pour une tâche en cours', () => {
  const sent = []
  globalThis.Notification = class {
    static permission = 'granted'
    constructor(title, options) {
      sent.push({ title, options })
    }
  }
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  assert.equal(announceReminder({ id: 3, label: 'Docker', startDate: iso, endDate: iso }), true)

  assert.equal(sent[0].title, 'Rappel : Docker')
  assert.equal(sent[0].options.body, "À réaliser aujourd'hui")
  assert.equal(sent[0].options.tag, 'task-3')
})

test('announceReminder indique la période pour une tâche future', () => {
  const sent = []
  globalThis.Notification = class {
    static permission = 'granted'
    constructor(title, options) {
      sent.push({ title, options })
    }
  }

  announceReminder({ id: 4, label: 'Rendu', startDate: '2099-03-01', endDate: '2099-03-05' })

  assert.match(sent[0].options.body, /^À réaliser du 1 mars au 5 mars$/)
})

test('announceReminder renvoie false quand le navigateur refuse la notification', () => {
  globalThis.Notification = class {
    static permission = 'granted'
    constructor() {
      throw new TypeError('Illegal constructor')
    }
  }

  assert.equal(announceReminder({ id: 5, label: 'X', startDate: '2099-03-01', endDate: '2099-03-01' }), false)
})
