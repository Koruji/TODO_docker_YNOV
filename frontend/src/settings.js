import { api } from './api.js'
import { render } from './utils.js'
import settingsTpl from './templates/pages/settings.html?raw'
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

const icons = { person, envelope, key, pencil, download, sheet, shield, chat, trash, chevron }

export function mountSettings(root, user, onLogout) {
  root.classList.add('home-settings')
  root.innerHTML = render(settingsTpl, { ...icons, username: user.username })
  root.querySelector('#logout').addEventListener('click', onLogout)

  api
    .me()
    .then((profile) => {
      if (!root.isConnected) return
      root.querySelector('#set-username').textContent = profile.username
      root.querySelector('#set-email').textContent = profile.email
    })
    .catch(() => {
      if (root.isConnected) root.querySelector('#set-email').textContent = 'Indisponible'
    })
}
