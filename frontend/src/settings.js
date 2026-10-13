import { api, ApiError, messageFor } from './api.js'
import { render, submitForm, toast } from './utils.js'
import settingsTpl from './templates/pages/settings.html?raw'
import editSheetTpl from './templates/pages/edit-sheet.html?raw'
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

// Ce que la popup demande, selon ce qu'on modifie
const EDITORS = {
  username: {
    title: "Modifier le nom d'utilisateur",
    done: "Nom d'utilisateur modifié",
    fields: (p) => [{ name: 'username', label: "Nouveau nom d'utilisateur", type: 'text', autocomplete: 'username', value: p.username, maxlength: 50 }],
  },
  email: {
    title: "Modifier l'adresse e-mail",
    done: 'Adresse e-mail modifiée',
    fields: (p) => [{ name: 'email', label: 'Nouvelle adresse e-mail', type: 'email', autocomplete: 'email', value: p.email }],
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

const invalid = (fields) => new ApiError(400, 'Validation failed', fields)

// Vérifie le format côté navigateur ; le backend revérifie de toute façon
function validate(mode, f) {
  if (mode === 'username') {
    const name = f.username.value.trim()
    if (!name) throw invalid({ username: "Le nom d'utilisateur est obligatoire." })
    if (name.length > 50) throw invalid({ username: '50 caractères maximum.' })
  } else if (mode === 'email') {
    if (!EMAIL_FORMAT.test(f.email.value.trim())) throw invalid({ email: 'Adresse e-mail invalide (exemple : nom@domaine.fr).' })
  } else {
    const errors = {}
    const next = f.newPassword.value
    if (!f.currentPassword.value) errors.currentPassword = 'Saisis ton mot de passe actuel.'
    if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) errors.newPassword = `Le mot de passe doit faire entre ${PASSWORD_MIN} et ${PASSWORD_MAX} caractères.`
    else if (next === f.currentPassword.value) errors.newPassword = "Le nouveau mot de passe doit être différent de l'actuel."
    if (f.confirmPassword.value !== next) errors.confirmPassword = 'Les deux mots de passe ne correspondent pas.'
    if (Object.keys(errors).length) throw invalid(errors)
  }
}

// Page Paramètres : seule la section « Fiche perso » est branchée.
// Le nom et l'email affichés viennent du profil de l'utilisateur connecté (GET /users/me).
export function mountSettings(root, user, { onLogout, onProfile }) {
  root.classList.add('home-settings')
  root.innerHTML = render(settingsTpl, { ...icons, username: user.username }) + render(editSheetTpl, icons)

  const $ = (sel) => root.querySelector(sel)
  const dialog = $('#edit-sheet')
  const form = $('#edit-form')
  let profile = null
  let mode = null

  const showProfile = () => {
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

  async function openEditor(next) {
    try {
      profile ??= await api.me()
    } catch (err) {
      return toast(messageFor(err), true)
    }
    mode = next
    $('#edit-title').textContent = EDITORS[mode].title
    form.querySelector('.alert').hidden = true
    $('#edit-fields').innerHTML = EDITORS[mode].fields(profile).map((f) => render(editFieldTpl, f)).join('')
    dialog.showModal()
    form.elements[EDITORS[mode].fields(profile)[0].name].focus()
  }

  root.addEventListener('click', (e) => {
    if (e.target === dialog) return dialog.close() // clic sur le fond
    const button = e.target.closest('button')
    if (!button) return
    if (button.dataset.edit) openEditor(button.dataset.edit)
    else if (button.hasAttribute('data-close')) dialog.close()
    else if (button.id === 'logout') onLogout()
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    submitForm(form, async () => {
      validate(mode, form.elements)

      if (mode === 'password') {
        try {
          await api.changePassword({ currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value })
        } catch (err) {
          if (err.message === 'Current password is incorrect') throw invalid({ currentPassword: 'Mot de passe actuel incorrect.' })
          throw err
        }
      } else {
        // PUT /users/me attend le profil complet : on renvoie ce qui ne change pas
        const body = { username: profile.username, email: profile.email, profilePicture: profile.profilePicture }
        body[mode] = form.elements[mode].value.trim()
        profile = await api.updateMe(body)
        showProfile()
        onProfile(profile)
      }

      dialog.close()
      toast(EDITORS[mode].done)
    })
  })
}
