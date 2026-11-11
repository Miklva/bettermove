// Publie une version de BetterMove sur le depot PUBLIC, en un seul commit propre.
// Le depot prive (origin) garde tout l'historique de dev ; le public ne recoit que les versions.
//
// Utilisation (depuis la branche main, tout commite) :
//   npm run release -- 1.2.0
//   npm run release -- 1.2.0 "Ce qui change dans cette version"
//
// La premiere fois : git remote add public https://github.com/Miklva/bettermove.git
import { execFileSync } from 'node:child_process';

// git lance sans passer par un shell : rien a echapper (le ^ de HEAD^{tree} casse sous Windows avec cmd.exe)
const git = (args, opts = {}) => String(execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts }) ?? '').trim();
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

const version = process.argv[2];
const notes = process.argv[3] ?? '';
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) fail('Donne un numero de version, ex. : npm run release -- 1.2.0');

// Verifications
const remotes = git(['remote']).split('\n');
if (!remotes.includes('public')) fail('Remote "public" absent. Lance : git remote add public https://github.com/Miklva/bettermove.git');
if (git(['status', '--porcelain'])) fail('Il reste des changements non commites. Commite-les avant de publier.');
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') fail(`Tu es sur la branche "${branch}". Publie depuis main.`);

// Dernier etat du depot public (s'il a deja une version)
git(['fetch', 'public', '--tags'], { stdio: ['ignore', 'inherit', 'inherit'] });
let parent = '';
try {
  parent = git(['rev-parse', '--verify', '-q', 'public/main']);
} catch {
  parent = '';
}
const tag = `v${version}`;
let tagExists = false;
try {
  git(['rev-parse', '--verify', '-q', `refs/tags/${tag}`]);
  tagExists = true;
} catch {
  tagExists = false;
}
if (tagExists) fail(`La version ${tag} existe deja.`);

// Un seul commit : l'arbre de main, avec pour parent la version publique precedente
const tree = git(['rev-parse', 'HEAD^{tree}']);
const msg = `BetterMove ${version}${notes ? `\n\n${notes}` : ''}`;
const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-F', '-'], { input: msg, stdio: ['pipe', 'pipe', 'inherit'] });

git(['tag', '-a', tag, commit, '-m', `BetterMove ${version}`]);
git(['push', 'public', `${commit}:refs/heads/main`], { stdio: ['ignore', 'inherit', 'inherit'] });
git(['push', 'public', tag], { stdio: ['ignore', 'inherit', 'inherit'] });
git(['push', 'origin', tag], { stdio: ['ignore', 'inherit', 'inherit'] });

console.log(`\n✓ BetterMove ${version} publie sur le depot public (${commit.slice(0, 7)}).`);
console.log('  Sur le serveur : cd ~/bettermove && git pull && sudo docker compose up -d --build\n');
