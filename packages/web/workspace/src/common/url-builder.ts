export function githubRepo(owner: string, repo: string) {
  return `https://github.com/${owner}/${repo}`;
}

export function githubCommit(repo: string, commit: string) {
  return `${repo}/commit/${commit}`;
}

export function githubRef(repo: string, ref: string) {
  return `${repo}/tree/${ref}`;
}

export function githubPr(repo: string, pr: number) {
  return `${repo}/pull/${pr}`;
}
