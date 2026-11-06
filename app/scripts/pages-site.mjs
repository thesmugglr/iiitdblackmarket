// Where a GitHub Pages repository is served. A repository named <owner>.github.io is the owner's root site
// (https://<owner>.github.io/, base path "/"); any other repository is a project site under /<name>/.
export function pagesSite(repo) {
  const match = /^([\w.-]+)\/([\w.-]+)$/.exec(repo ?? '')
  if (!match) throw new Error('Expected <owner/repo>, for example iiitdblackmarket/iiitdblackmarket.github.io')
  const [, owner, name] = match
  const rootSite = name.toLowerCase() === `${owner.toLowerCase()}.github.io`
  const base = rootSite ? '/' : `/${name}/`
  return { owner, name, rootSite, base, url: rootSite ? `https://${name.toLowerCase()}/` : `https://${owner.toLowerCase()}.github.io/${name}/` }
}
