import { ApiError, messageFor } from './api'

export const escapeHtml = (str: unknown): string =>
  String(str).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )

// Mini moteur de templates : {{x}} (échappé), {{{x}}} (HTML brut), {{#x}}…{{/x}} (affiché si x est vrai, imbrication possible).
// Une seule passe pour les variables : un texte inséré n'est jamais ré-interprété comme un {{motif}}.
type TemplateData = Record<string, unknown>

const keepSections = (template: string, data: TemplateData): string =>
  template.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key: string, body: string) =>
    data[key] ? keepSections(body, data) : '',
  )

export const render = (template: string, data: object = {}): string => {
  const values = data as TemplateData
  return keepSections(template, values).replace(
    /\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g,
    (_, raw: string | undefined, escaped: string | undefined) => {
      const value = values[(raw ?? escaped) as string]
      if (value == null) return ''
      return raw ? String(value) : escapeHtml(value)
    },
  )
}

// querySelector qui échoue franchement (au lieu de renvoyer null) quand l'élément attendu n'existe pas
export function must<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector)
  if (!el) throw new Error(`Élément introuvable : ${selector}`)
  return el
}

// Clic sur un élément : remonte jusqu'au sélecteur voulu (ou null si le clic est ailleurs)
export const closestFrom = <T extends Element = HTMLElement>(target: EventTarget | null, selector: string): T | null =>
  target instanceof Element ? target.closest<T>(selector) : null

export function toast(message: string, isError = false): void {
  const el = document.createElement('div')
  el.className = `toast${isError ? ' is-error' : ''}`
  el.setAttribute('role', 'status')
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.classList.add('is-leaving'), 3000)
  setTimeout(() => el.remove(), 3500)
}

export async function submitForm(form: HTMLFormElement, action: () => Promise<void>): Promise<void> {
  const button = must<HTMLButtonElement>(form, 'button[type="submit"]')
  const label = button.textContent
  const alert = must<HTMLElement>(form, '.alert')

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
    const fields = err instanceof ApiError ? err.fields : {}
    for (const [name, message] of Object.entries(fields)) {
      const input = form.elements.namedItem(name)
      if (!(input instanceof Element)) continue
      input.setAttribute('aria-invalid', 'true')
      input.insertAdjacentHTML('afterend', `<p class="field-error">${escapeHtml(message)}</p>`)
    }
  } finally {
    button.disabled = false
    button.textContent = label
    form.closest('.auth')?.classList.remove('busy')
  }
}
