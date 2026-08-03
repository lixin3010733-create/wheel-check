// 轮子分析：根据搜索结果判断"该直接用现成的 / 参考改造 / 自己造"
import type { GitHubRepo } from './github'
import { scoreRepo } from './keywords'

export type Verdict = 'use' | 'reference' | 'build'

export interface AnalysisResult {
  verdict: Verdict
  verdictLabel: string
  verdictDetail: string
  dupScore: number // 0-100，重复度/成熟度
  bestRepo: GitHubRepo | null
  relevant: GitHubRepo[]
}

const STARS = {
  use: 3000, // 成熟现成轮子
  reference: 500, // 可用参考
}

export function analyze(repos: GitHubRepo[], keywords: string[]): AnalysisResult {
  // 过滤掉 archived 的
  const alive = repos.filter((r) => !r.archived)

  // 计算相关度，取相关度>=1 的仓库
  const scored = alive
    .map((repo) => ({ repo, score: scoreRepo(repo, keywords) }))
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score || b.repo.stargazers_count - a.repo.stargazers_count)

  const relevant = scored.map((x) => x.repo)
  const bestRepo = relevant[0] ?? null
  const bestStars = bestRepo?.stargazers_count ?? 0
  const bestScore = scored[0]?.score ?? 0

  let verdict: Verdict
  if (bestRepo && bestStars >= STARS.use && bestScore >= 1) {
    verdict = 'use'
  } else if (bestRepo && bestStars >= STARS.reference && bestScore >= 1) {
    verdict = 'reference'
  } else if (bestRepo && bestStars >= 100) {
    verdict = 'reference'
  } else {
    verdict = 'build'
  }

  // 重复度：综合最相关仓库的 star 和匹配度打分
  let dupScore = 0
  if (bestRepo) {
    dupScore = Math.min(
      100,
      Math.round(Math.log10(bestStars + 1) * 14 + bestScore * 8 + (bestRepo.updated_at ? 5 : 0)),
    )
  }

  const labelMap: Record<Verdict, string> = {
    use: '有现成的轮子，直接用',
    reference: '有可参考的实现',
    build: '值得自己造',
  }

  const detailMap: Record<Verdict, string> = {
    use: `已找到 star ${bestStars} 的高度相关项目 ${bestRepo?.full_name}。建议直接使用或 fork 改造，把精力花在业务上。`,
    reference: `找到 ${relevant.length} 个相关项目，最佳为 ${bestRepo?.full_name}（star ${bestStars}）。可以参考其架构与实现，也可以直接用，但可能需要按你的需求改造。`,
    build: relevant.length
      ? `只有 ${relevant.length} 个弱相关项目，最接近的 star 仅 ${bestStars}，成熟度不足。建议自己造，可借鉴少量思路。`
      : '没有找到高度相关的项目。这是一个相对空白的领域，自己造轮子机会大。',
  }

  return {
    verdict,
    verdictLabel: labelMap[verdict],
    verdictDetail: detailMap[verdict],
    dupScore,
    bestRepo,
    relevant: relevant.slice(0, 10),
  }
}
