import react from '@vitejs/plugin-react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServer, defineConfig, type Plugin } from 'vite'

const SITE = (process.env.VITE_SITE_URL ?? '').replace(/\/$/, '')
const GOOGLE = (process.env.VITE_GOOGLE_SITE_VERIFICATION ?? '').trim()
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const SOURCE = (process.env.VITE_SOURCE_URL ?? '').trim()

/** Page a referencer (voir src/seo/all.ts) */
interface Doc {
  path: string
  title: string
  description: string
  h1: string
  priority: number
  bodyHtml: string
  kind: 'page' | 'article' | 'lesson'
  lang: string
  key: string
}

const LOCALES: Record<string, string> = { fr: 'fr_FR', en: 'en_US', es: 'es_ES', pt: 'pt_PT', de: 'de_DE', ru: 'ru_RU' }

/** Fiche descriptive du site (donnees structurees), dans la langue de la page */
function appLd(lang: string) {
  const en = lang === 'en'
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'BetterMove',
    url: SITE ? `${SITE}${en ? '/en' : '/'}` : undefined,
    description: en
      ? 'Play chess for free against bots that play like humans, solve puzzles, take lessons and get your games analyzed. No ads.'
      : 'Joue aux échecs gratuitement contre des bots qui jouent comme des humains, résous des problèmes, suis des cours et fais analyser tes parties. Sans publicité.',
    sameAs: SOURCE ? [SOURCE] : undefined,
    applicationCategory: 'GameApplication',
    applicationSubCategory: en ? 'Chess' : 'Échecs',
    operatingSystem: 'Web',
    inLanguage: ['fr', 'en'],
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    license: 'https://www.gnu.org/licenses/gpl-3.0.html',
  }
}

/** Versions d'une meme page dans les autres langues (hreflang) ; x-default = francais (racine du site) */
function alternates(p: Doc, docs: Doc[]) {
  const same = docs.filter((d) => d.key === p.key)
  if (same.length < 2) return []
  const fr = same.find((d) => d.lang === 'fr')
  return [...same.map((d) => ({ lang: d.lang, href: SITE + d.path })), ...(fr ? [{ lang: 'x-default', href: SITE + fr.path }] : [])]
}

/** Charge la liste des pages depuis le code de l'app (TypeScript) au moment du build */
async function loadDocs(): Promise<Doc[]> {
  const server = await createServer({ configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } })
  try {
    const mod = await server.ssrLoadModule('/src/seo/build.ts')
    return mod.BUILD_DOCS as Doc[]
  } finally {
    await server.close()
  }
}

/** Contenu lisible par les moteurs avant le chargement de l'app (remplace par React au demarrage) */
function staticBody(p: Doc, docs: Doc[]) {
  const links = docs
    .filter((x) => x.kind === 'page' && x.lang === p.lang && x.priority >= 0.6 && x.path !== p.path)
    .map((x) => `<li><a href="${x.path}">${esc(x.h1)}</a></li>`)
    .join('')
  const tag = p.kind === 'page' ? 'main' : 'article'
  return `<main class="seo-static"><p class="seo-brand"><a href="${p.lang === 'fr' ? '/' : `/${p.lang}`}">♞ BetterMove</a></p><${tag === 'article' ? 'article' : 'section'}><h1>${esc(p.h1)}</h1>${p.bodyHtml}</${tag === 'article' ? 'article' : 'section'}><nav aria-label="Pages"><ul>${links}</ul></nav></main>`
}

/** En-tete propre a une page : titre, description, adresse canonique, apercu des liens */
function pageHtml(base: string, p: Doc, docs: Doc[]) {
  const url = `${SITE}${p.path}`
  let html = base
    .replace('<html lang="fr">', `<html lang="${p.lang}">`)
    .replace('<meta property="og:locale" content="fr_FR" />', `<meta property="og:locale" content="${LOCALES[p.lang] ?? 'fr_FR'}" />`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(p.description)}" />`)
    .replace('<div id="root"></div>', `<div id="root">${staticBody(p, docs)}</div>`)
  const head: string[] = []
  if (SITE) {
    head.push(`<link rel="canonical" href="${esc(url)}" />`, `<meta property="og:url" content="${esc(url)}" />`)
    for (const a of alternates(p, docs)) head.push(`<link rel="alternate" hreflang="${a.lang}" href="${esc(a.href)}" />`)
  }
  head.push(`<script type="application/ld+json">${JSON.stringify(appLd(p.lang))}</script>`)
  if (p.kind !== 'page') {
    const ld = {
      '@context': 'https://schema.org',
      '@type': p.kind === 'article' ? 'Article' : 'LearningResource',
      headline: p.h1,
      name: p.h1,
      description: p.description,
      inLanguage: p.lang,
      url: SITE ? url : undefined,
      isAccessibleForFree: true,
      publisher: { '@type': 'Organization', name: 'BetterMove', url: SITE ? `${SITE}/` : undefined },
      ...(p.kind === 'lesson'
        ? { learningResourceType: 'Lesson', educationalLevel: p.lang === 'en' ? 'Beginner to intermediate' : 'Débutant à intermédiaire', about: p.lang === 'en' ? 'Chess' : 'Échecs' }
        : {}),
    }
    head.push(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`)
  }
  if (head.length) html = html.replace('</head>', `${head.map((h) => `    ${h}\n`).join('')}  </head>`)
  // Les pages autres que l'accueil gardent leur propre titre dans les apercus (l'accueil sert aux invitations)
  if (p.path !== '/')
    html = html
      .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(p.title)}" />`)
      .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(p.description)}" />`)
  return html
}

function seo(): Plugin {
  let outDir = 'dist'
  return {
    name: 'seo',
    configResolved: (c) => {
      outDir = c.build.outDir
    },
    transformIndexHtml: (html) => {
      let out = html.replaceAll('__SITE_URL__', SITE)
      const extra = [
        GOOGLE ? `<meta name="google-site-verification" content="${esc(GOOGLE)}" />` : '',
      ]
        .filter(Boolean)
        .map((l) => `    ${l}\n`)
        .join('')
      out = out.replace('</head>', `${extra}  </head>`)
      return out
    },
    // Apres le build : une page HTML par adresse publique, le plan du site et robots.txt
    async closeBundle() {
      const docs = await loadDocs()
      const base = readFileSync(join(outDir, 'index.html'), 'utf8')
      for (const p of docs) {
        const html = pageHtml(base, p, docs)
        if (p.path === '/') writeFileSync(join(outDir, 'index.html'), html)
        else {
          // /apprendre/problemes -> apprendre/problemes.html (servi sans redirection par nginx : try_files $uri.html)
          const file = join(outDir, `${p.path}.html`)
          mkdirSync(join(file, '..'), { recursive: true })
          writeFileSync(file, html)
        }
      }
      const robots = ['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /admin', 'Disallow: /compte/']
      if (SITE) {
        const today = new Date().toISOString().slice(0, 10)
        const urls = docs
          .map((p) => {
            const alt = alternates(p, docs)
              .map((a) => `<xhtml:link rel="alternate" hreflang="${a.lang}" href="${esc(a.href)}"/>`)
              .join('')
            return `  <url><loc>${esc(SITE + p.path)}</loc>${alt}<lastmod>${today}</lastmod><priority>${p.priority.toFixed(1)}</priority></url>`
          })
          .join('\n')
        writeFileSync(
          join(outDir, 'sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
        )
        robots.push('', `Sitemap: ${SITE}/sitemap.xml`)
      }
      writeFileSync(join(outDir, 'robots.txt'), robots.join('\n') + '\n')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seo()],
  server: {
    // En dev, /api part vers l'API (docker compose ou npm run dev dans server/)
    proxy: { '/api': 'http://localhost:3001' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:3001' },
  },
})
