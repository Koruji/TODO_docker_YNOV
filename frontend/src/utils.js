import { messageFor } from './api.js'

export const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

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
