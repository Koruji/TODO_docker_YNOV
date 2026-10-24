import { messageFor } from './api.js'

export const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Mini moteur de templates : {{x}} (échappé), {{{x}}} (HTML brut), {{#x}}…{{/x}} (affiché si x est vrai, imbrication possible).
// Une seule passe pour les variables : un texte inséré n'est jamais ré-interprété comme un {{motif}}.
const keepSections = (template, data) =>
  template.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, body) => (data[key] ? keepSections(body, data) : ''))

export const render = (template, data = {}) =>
  keepSections(template, data).replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (_, raw, escaped) => {
    const value = data[raw ?? escaped]
    if (value == null) return ''
    return raw ? String(value) : escapeHtml(value)
  })

export function toast(message, isError = false) {
  const el = document.createElement('div')
  el.className = `toast${isError ? ' is-error' : ''}`
  el.setAttribute('role', 'status')
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.classList.add('is-leaving'), 3000)
  setTimeout(() => el.remove(), 3500)
}

export async function submitForm(form, action) {
  const button = form.querySelector('button[type="submit"]')
  const label = button.textContent
  const alert = form.querySelector('.alert')

  alert.hidden = true
  form.querySelectorAll('.field-error').forEach((el) => el.remove())
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'))

  button.disabled = true
  button.textContent = 'Un instant…'
  form.closest('.auth')?.classList.add('busy')
  try {
    await action()
  } catch (err) {
    alert.textContent = messageFor(err)
    alert.hidden = false
    for (const [name, message] of Object.entries(err.fields ?? {})) {
      const input = form.elements[name]
      if (!input?.setAttribute) continue
      input.setAttribute('aria-invalid', 'true')
      input.insertAdjacentHTML('afterend', `<p class="field-error">${escapeHtml(message)}</p>`)
    }
  } finally {
    button.disabled = false
    button.textContent = label
    form.closest('.auth')?.classList.remove('busy')
  }
}
