import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@lichess-org/chessground/assets/chessground.base.css'
import '@lichess-org/chessground/assets/chessground.brown.css'
import '@lichess-org/chessground/assets/chessground.cburnett.css'
import './skins_masks.css'
import '@fontsource-variable/figtree'
import '@fontsource-variable/bricolage-grotesque'
import './index.css'
import App from './App.tsx'
import { initSync } from './sync/client'
import { seedShopFromProgress } from './shop/seed'
import { lang, loadLocale, preferredLang } from './i18n'
import { localizeLessons } from './lessons/localize'
import { localizeData } from './i18n/data'
import { loadChatPack } from './bots/chat'
import { toInternal, toPublic } from './i18n/slugs'

let rendered = false
const render = () => {
  if (rendered) return
  rendered = true
  // Apres la synchro : la boutique relit son etat et credite la progression passee (une fois)
  seedShopFromProgress()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Premiere visite sur une adresse francaise : on bascule vers la langue du visiteur (choix enregistre ou navigateur)
const pref = preferredLang()
if (pref) window.location.replace(toPublic(toInternal(window.location.pathname), pref) + window.location.search + window.location.hash)
else {
  // On attend la synchro (2,5 s max) et le dictionnaire de la langue pour demarrer
  const sync = initSync((atStartup) => {
    if (atStartup && rendered) window.location.reload()
    else if (!atStartup) window.dispatchEvent(new Event('bettermove-remote'))
  })
  const locale = loadLocale()
    .then(() => {
      localizeData()
      return Promise.all([localizeLessons(lang()), loadChatPack(lang())])
    })
    .catch(() => undefined)
  Promise.race([Promise.all([sync, locale]), new Promise((r) => setTimeout(r, 2500))]).finally(() => locale.finally(render))
}
