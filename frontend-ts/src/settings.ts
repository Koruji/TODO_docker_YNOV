import { api, ApiError, messageFor } from './api'
import { closestFrom, must, render, submitForm, toast } from './utils'
import type { FieldErrors, User, UserUpdateRequest } from './types'
import settingsTpl from './templates/pages/settings.html?raw'
import editSheetTpl from './templates/pages/edit-sheet.html?raw'
import confirmSheetTpl from './templates/pages/confirm-sheet.html?raw'
import editFieldTpl from './templates/pages/edit-field.html?raw'
import person from 'bootstrap-icons/icons/person.svg?raw'
import envelope from 'bootstrap-icons/icons/envelope.svg?raw'
import key from 'bootstrap-icons/icons/key.svg?raw'
import pencil from 'bootstrap-icons/icons/pencil.svg?raw'
import download from 'bootstrap-icons/icons/download.svg?raw'
import sheet from 'bootstrap-icons/icons/file-earmark-spreadsheet.svg?raw'
import shield from 'bootstrap-icons/icons/shield-check.svg?raw'
import chat from 'bootstrap-icons/icons/chat-dots.svg?raw'
import trash from 'bootstrap-icons/icons/trash.svg?raw'
import chevron from 'bootstrap-icons/icons/chevron-right.svg?raw'
import close from 'bootstrap-icons/icons/x-lg.svg?raw'

const icons = { person, envelope, key, pencil, download, sheet, shield, chat, trash, chevron, close }

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

type Mode = 'delete' | 'username' | 'email' | 'password'

interface EditorField {
  name: string
  label: string
  type: string
  autocomplete: string
  hint?: string
  value?: string
  maxlength?: number
}

interface Editor {
  title: string
  submit?: string
  done?: string
  danger?: boolean
  fields: (profile?: User) => EditorField[]
}

const EDITORS: Record<Mode, Editor> = {
  delete: {
    title: 'Confirme avec ton mot de passe',
    submit: 'Supprimer définitivement',
    danger: true,
    fields: () => [{ name: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'current-password', hint: 'Cette action est définitive.' }],
  },
  username: {
    title: "Modifier le nom d'utilisateur",
    done: "Nom d'utilisateur modifié",
    fields: (p) => [{ name: 'username', label: "Nouveau nom d'utilisateur", type: 'text', autocomplete: 'username', value: p?.username, maxlength: 50 }],
  },
  email: {
    title: "Modifier l'adresse e-mail",
    done: 'Adresse e-mail modifiée',
    fields: (p) => [{ name: 'email', label: 'Nouvelle adresse e-mail', type: 'email', autocomplete: 'email', value: p?.email }],
  },
  password: {
    title: 'Modifier le mot de passe',
    done: 'Mot de passe modifié',
    fields: () => [
      { name: 'currentPassword', label: 'Mot de passe actuel', type: 'password', autocomplete: 'current-password' },
      { name: 'newPassword', label: 'Nouveau mot de passe', type: 'password', autocomplete: 'new-password', hint: `${PASSWORD_MIN} à ${PASSWORD_MAX} caractères` },
      { name: 'confirmPassword', label: 'Confirmer le nouveau mot de passe', type: 'password', autocomplete: 'new-password' },
    ],
  },
}

// Champs du formulaire d'édition : seuls ceux du mode en cours existent réellement dans la page
interface EditElements extends HTMLFormControlsCollection {
  username: HTMLInputElement
  email: HTMLInputElement
  password: HTMLInputElement
  currentPassword: HTMLInputElement
  newPassword: HTMLInputElement
  confirmPassword: HTMLInputElement
}

const invalid = (fields: FieldErrors): ApiError => new ApiError(400, 'Validation failed', fields)

// Vérifie le format côté navigateur
function validate(mode: Mode, f: EditElements): void {
  if (mode === 'username') {
    const name = f.username.value.trim()
    if (!name) throw invalid({ username: "Le nom d'utilisateur est obligatoire." })
    if (name.length > 50) throw invalid({ username: '50 caractères maximum.' })
  } else if (mode === 'email') {
    if (!EMAIL_FORMAT.test(f.email.value.trim())) throw invalid({ email: 'Adresse e-mail invalide (exemple : nom@domaine.fr).' })
  } else if (mode === 'delete') {
    if (!f.password.value) throw invalid({ password: 'Saisis ton mot de passe pour confirmer.' })
  } else {
    const errors: FieldErrors = {}
    const next = f.newPassword.value
    if (!f.currentPassword.value) errors.currentPassword = 'Saisis ton mot de passe actuel.'
    if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) errors.newPassword = `Le mot de passe doit faire entre ${PASSWORD_MIN} et ${PASSWORD_MAX} caractères.`
    else if (next === f.currentPassword.value) errors.newPassword = "Le nouveau mot de passe doit être différent de l'actuel."
    if (f.confirmPassword.value !== next) errors.confirmPassword = 'Les deux mots de passe ne correspondent pas.'
    if (Object.keys(errors).length) throw invalid(errors)
  }
}

interface SettingsHandlers {
  onLogout: () => void
  onProfile: (updated: User) => void
}

// Page Paramètres : seules la section « Fiche perso » et la suppression du compte sont branchées.
// Le nom et l'email affichés viennent du profil de l'utilisateur connecté (GET /users/me).
export function mountSettings(root: HTMLElement, user: User, { onLogout, onProfile }: SettingsHandlers): void {
  root.classList.add('home-settings')
  root.innerHTML = render(settingsTpl, { ...icons, username: user.username }) + render(editSheetTpl, icons) + render(confirmSheetTpl, icons)

  const $ = <T extends Element = HTMLElement>(sel: string): T => must<T>(root, sel)
  const dialog = $<HTMLDialogElement>('#edit-sheet')
  const confirmDialog = $<HTMLDialogElement>('#confirm-sheet')
  const submit = $<HTMLButtonElement>('#edit-submit')
  const form = $<HTMLFormElement>('#edit-form')
  let profile: User | null = null
  let mode: Mode | null = null

  const showProfile = (): void => {
    if (!profile) return
    $('#set-username').textContent = profile.username
    $('#set-email').textContent = profile.email
  }

  api
    .me()
    .then((p) => {
      profile = p
      if (root.isConnected) showProfile()
    })
    .catch(() => {
      if (root.isConnected) $('#set-email').textContent = 'Indisponible'
    })

  async function openEditor(next: Mode): Promise<void> {
    try {
      if (next !== 'delete') profile ??= await api.me() // la suppression n'a pas besoin du profil
    } catch (err) {
      return toast(messageFor(err), true)
    }
    mode = next
    const editor = EDITORS[next]
    const fields = editor.fields(profile ?? undefined)
    $('#edit-title').textContent = editor.title
    submit.textContent = editor.submit ?? 'Valider la modification'
    submit.className = `btn ${editor.danger ? 'btn-danger' : 'btn-primary'}`
    must(form, '.alert').hidden = true
    $('#edit-fields').innerHTML = fields.map((f) => render(editFieldTpl, f)).join('')
    dialog.showModal()
    ;(form.elements.namedItem(fields[0].name) as HTMLInputElement).focus()
  }

  root.addEventListener('click', (e) => {
    if (e.target === dialog || e.target === confirmDialog) return (e.target as HTMLDialogElement).close() // clic sur le fond
    const button = closestFrom<HTMLButtonElement>(e.target, 'button')
    if (!button) return
    if (button.dataset.edit) openEditor(button.dataset.edit as Mode)
    else if (button.hasAttribute('data-delete')) confirmDialog.showModal() // 1re popup : confirmation
    else if (button.id === 'confirm-delete') {
      confirmDialog.close()
      openEditor('delete') // 2e popup : mot de passe
    } else if (button.hasAttribute('data-close')) button.closest('dialog')?.close()
    else if (button.id === 'logout') onLogout()
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    submitForm(form, async () => {
      const current = mode
      if (!current) return
      const f = form.elements as EditElements
      validate(current, f)

      if (current === 'delete') {
        try {
          await api.deleteAccount(f.password.value)
        } catch (err) {
          if (err instanceof Error && err.message === 'Current password is incorrect') throw invalid({ password: 'Mot de passe incorrect.' })
          throw err
        }
        dialog.close()
        onLogout() // le compte n'existe plus : on efface la session et on retourne à la connexion
        toast('Ton compte a été supprimé')
        return
      }

      if (current === 'password') {
        try {
          await api.changePassword({ currentPassword: f.currentPassword.value, newPassword: f.newPassword.value })
        } catch (err) {
          if (err instanceof Error && err.message === 'Current password is incorrect') throw invalid({ currentPassword: 'Mot de passe actuel incorrect.' })
          throw err
        }
      } else if (profile) {
        // PUT /users/me attend le profil complet : on renvoie ce qui ne change pas
        const body: UserUpdateRequest = { username: profile.username, email: profile.email, profilePicture: profile.profilePicture }
        body[current] = f[current].value.trim()
        profile = await api.updateMe(body)
        showProfile()
        onProfile(profile)
      }

      dialog.close()
      toast(EDITORS[current].done ?? '')
    })
  })
}
