// GitHub Search API 封装

export interface GitHubRepo {
  id: number
  full_name: string
  html_url: string
  name: string
  description: string | null
  stargazers_count: number
  forks_count: number
  language: string | null
  topics: string[]
  updated_at: string
  created_at: string
  archived: boolean
  license: { spdx_id: string | null } | null
  owner: { login: string; avatar_url: string }
}

const API_BASE = 'https://api.github.com'

export class RateLimitError extends Error {
  remaining: number
  resetAt: number
  constructor(remaining: number, resetAt: number) {
    super('GitHub API 速率限制')
    this.remaining = remaining
    this.resetAt = resetAt
  }
}

// 搜索仓库，按 star 排序。token 可选，提供后限速更宽。
export async function searchRepos(
  query: string,
  options: { perPage?: number; token?: string } = {},
): Promise<{ items: GitHubRepo[]; remaining: number; resetAt: number }> {
  const perPage = options.perPage ?? 30
  const url = `${API_BASE}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const res = await fetch(url, { headers })

  const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? 0)
  const resetAt = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000

  if (res.status === 403) {
    throw new RateLimitError(remaining, resetAt)
  }
  if (!res.ok) {
    throw new Error(`GitHub API 请求失败: HTTP ${res.status}`)
  }

  const data = (await res.json()) as { items?: GitHubRepo[] }
  return { items: data.items ?? [], remaining, resetAt }
}

// 判断是否已到限速
export function isRateLimitedError(e: unknown): e is RateLimitError {
  return e instanceof RateLimitError
}
