import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@lichess-org/chessground/assets/chessground.base.css'
import '@lichess-org/chessground/assets/chessground.brown.css'
import '@lichess-org/chessground/assets/chessground.cburnett.css'
import './skins_masks.css'
import './index.css'
import App from './App.tsx'
import { initSync } from './sync/client'
import { seedShopFromProgress } from './shop/seed'

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

// On attend la synchro (2,5 s max) pour demarrer avec les donnees les plus recentes du serveur
const sync = initSync((atStartup) => {
  if (atStartup && rendered) window.location.reload()
  else if (!atStartup) window.dispatchEvent(new Event('bettermove-remote'))
})
Promise.race([sync, new Promise((r) => setTimeout(r, 2500))]).finally(render)
