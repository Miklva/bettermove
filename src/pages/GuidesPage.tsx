// Guides : liste et lecture des articles (/guides et /guides/<slug>)
import { ARTICLES as FR_ARTICLES } from '../seo/articles';
import { EN_ARTICLES } from '../seo/en';
import { hrefOf, navigate, usePath, segmentsOf } from '../router';
import { lang, t } from '../i18n';

// Guides dans la langue de la page (francais si pas encore traduits) ; slug = adresse interne francaise
const articles = () =>
  lang() === 'en' ? EN_ARTICLES.map((a) => ({ ...a, slug: a.frSlug })) : FR_ARTICLES;

const go = (path: string) => {
  navigate(path);
  window.scrollTo(0, 0);
};

export function GuidesPage() {
  const segs = segmentsOf(usePath());
  const ARTICLES = articles();
  const article = ARTICLES.find((a) => a.slug === segs[1]);

  if (!article)
    return (
      <div className="legal guides">
        <div className="card legal-doc">
          <h1>{t('📖 Guides')}</h1>
          <p className="muted">{t('Les réponses aux questions que se posent tous les joueurs, du premier coup au classement Elo.')}</p>
          <div className="guides-list">
            {ARTICLES.map((a) => (
              <a
                key={a.slug}
                className="guide-card"
                href={hrefOf(`/guides/${a.slug}`)}
                onClick={(e) => {
                  e.preventDefault();
                  go(`/guides/${a.slug}`);
                }}
              >
                <strong>{a.h1}</strong>
                <span className="muted small">{a.description}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    );

  const others = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);
  return (
    <div className="legal guides">
      <article className="card legal-doc">
        <a
          className="link-btn small"
          href={hrefOf('/guides')}
          onClick={(e) => {
            e.preventDefault();
            go('/guides');
          }}
        >
          {t('← Tous les guides')}
        </a>
        <h1>{article.h1}</h1>
        <p className="guide-intro">{article.intro}</p>
        {article.sections.map((s) => (
          <section key={s.h2}>
            <h2>{s.h2}</h2>
            {s.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.list && (
              <ul>
                {s.list.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <button className="btn primary big guide-cta" onClick={() => go(article.cta.path)}>
          {article.cta.label} →
        </button>
      </article>
      <div className="card legal-doc guides-more">
        <h2>{t('À lire aussi')}</h2>
        <div className="guides-list">
          {others.map((a) => (
            <a
              key={a.slug}
              className="guide-card"
              href={hrefOf(`/guides/${a.slug}`)}
              onClick={(e) => {
                e.preventDefault();
                go(`/guides/${a.slug}`);
              }}
            >
              <strong>{a.h1}</strong>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
