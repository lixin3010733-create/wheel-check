import { useState } from 'react'
import './App.css'
import { extractKeywords, buildSearchQuery, isMethodQuestion } from './lib/keywords'
import { searchRepos, isRateLimitedError } from './lib/github'
import { analyze, type AnalysisResult, type Verdict } from './lib/analyze'

type Status = 'idle' | 'loading' | 'done' | 'error'

const EXAMPLES = [
  '一个 X(推特) 舆情监控工具',
  '在线商城 + 购物车 + 支付',
  '简历生成器',
  '团队看板项目管理',
  'H5 抽奖活动页',
  'AI 智能客服机器人',
  '思维导图编辑器',
  '外卖点餐小程序',
]

const VERDICT_META: Record<Verdict, { color: string; bg: string; icon: string }> = {
  use: { color: '#16a34a', bg: '#f0fdf4', icon: '✅' },
  reference: { color: '#d97706', bg: '#fffbeb', icon: '🔍' },
  build: { color: '#dc2626', bg: '#fef2f2', icon: '🔨' },
}

function formatStars(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : '-'
}

function App() {
  const [input, setInput] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem('gh_token') ?? '')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [methodAdvice, setMethodAdvice] = useState<string | null>(null)

  const saveToken = (v: string) => {
    setToken(v)
    if (v) localStorage.setItem('gh_token', v)
    else localStorage.removeItem('gh_token')
  }

  const run = async () => {
    if (!input.trim()) return
    setStatus('loading')
    setErrorMsg('')
    setAnalysis(null)
    setMethodAdvice(null)

    // 方法论/问题型需求：GitHub 上没有"轮子"可参考，直接给建议，不调用搜索
    if (isMethodQuestion(input)) {
      setStatus('done')
      setMethodAdvice(input.trim())
      return
    }

    const kws = extractKeywords(input)
    setKeywords(kws)
    const q = buildSearchQuery(kws)
    setQuery(q)

    try {
      const { items, remaining } = await searchRepos(q, { token: token || undefined })
      setRemaining(remaining)
      setAnalysis(analyze(items, kws))
      setStatus('done')
    } catch (e) {
      setStatus('error')
      if (isRateLimitedError(e)) {
        const secs = Math.max(0, Math.ceil((e.resetAt - Date.now()) / 1000))
        setErrorMsg(
          `GitHub API 限速了，${Math.ceil(secs / 60)} 分钟后恢复。配置 GitHub Token（Settings → Developer settings → Personal access tokens）可提升限额到 30次/分钟。`,
        )
      } else {
        setErrorMsg(e instanceof Error ? e.message : '请求失败，请重试')
      }
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run()
  }

  return (
    <div className="page">
      <header className="header">
        <div className="logo">🛞</div>
        <div>
          <h1>Github 防重复造轮子</h1>
          <p className="subtitle">开工之前，先搜一下 GitHub —— 别重复造轮子</p>
        </div>
      </header>

      <main>
        <section className="card input-card">
          <label className="label" htmlFor="idea">描述你的项目想法</label>
          <textarea
            id="idea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="例如：我想做一个 X(推特) 舆情监控工具，自动采集关键词推文并做情感分析"
            rows={3}
          />
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button key={ex} className="chip" onClick={() => setInput(ex)}>
                {ex}
              </button>
            ))}
          </div>
          <div className="actions">
            <input
              className="token-input"
              type="password"
              value={token}
              onChange={(e) => saveToken(e.target.value)}
              placeholder="GitHub Token（可选，提升限速）"
            />
            <button className="primary" onClick={run} disabled={status === 'loading' || !input.trim()}>
              {status === 'loading' ? '搜索中…' : '检查有没有现成的轮子'}
            </button>
          </div>
          {remaining !== null && (
            <p className="hint">本小时剩余 API 配额：{remaining} 次（未配 Token 约 10 次/小时）</p>
          )}
        </section>

        {status === 'error' && (
          <section className="card error">
            <strong>⚠️ {errorMsg}</strong>
          </section>
        )}

        {status === 'loading' && (
          <section className="card loading">
            <span className="spinner" />
            正在搜索 GitHub… 关键词：{keywords.join(', ') || query}
          </section>
        )}

        {status === 'done' && methodAdvice && (
          <section className="card method-card">
            <div className="method-icon">💡</div>
            <div>
              <h2>这个问题不需要找"轮子"</h2>
              <p>
                你输入的是「<strong>{methodAdvice}</strong>」，这是一个<strong>方法论/习惯类</strong>问题，
                不是"要做一个软件"。GitHub 上没有现成的开源项目能直接解决它，硬装工具反而适得其反。
              </p>
              <p className="hint">
                建议：把这类问题拆成「我要做一个 XX 工具来辅助」再来搜，例如把"避免玩手机"改成"做一个 AI 结对编程提醒工具"，工具就能帮你找对应的开源方案了。
              </p>
            </div>
          </section>
        )}

        {status === 'done' && analysis && (
          <>
            <section className={`card verdict verdict-${analysis.verdict}`}>
              <div className="verdict-icon">{VERDICT_META[analysis.verdict].icon}</div>
              <div className="verdict-body">
                <h2 style={{ color: VERDICT_META[analysis.verdict].color }}>
                  {analysis.verdictLabel}
                </h2>
                <p>{analysis.verdictDetail}</p>
                <p className="hint">
                  搜索关键词：<code>{keywords.join(' / ')}</code>
                </p>
                {analysis.bestRepo && (
                  <a className="best-repo" href={analysis.bestRepo.html_url} target="_blank" rel="noreferrer">
                    最佳候选：{analysis.bestRepo.full_name} ★ {formatStars(analysis.bestRepo.stargazers_count)}
                  </a>
                )}
              </div>
              <div className="dup-score">
                <div className="ring" style={{ '--score': `${analysis.dupScore}%` } as React.CSSProperties}>
                  <span>{analysis.dupScore}</span>
                </div>
                <p>重复度</p>
              </div>
            </section>

            {analysis.relevant.length > 0 && (
              <section className="card">
                <h3>相关项目（{analysis.relevant.length}）</h3>
                <ul className="repo-list">
                  {analysis.relevant.map((repo) => (
                    <li key={repo.id} className="repo">
                      <a href={repo.html_url} target="_blank" rel="noreferrer" className="repo-name">
                        {repo.full_name}
                      </a>
                      <span className="repo-stars">★ {formatStars(repo.stargazers_count)}</span>
                      {repo.language && <span className="repo-lang">{repo.language}</span>}
                      <span className="repo-license">{repo.license?.spdx_id ?? ''}</span>
                      <span className="repo-updated">{formatDate(repo.updated_at)} 更新</span>
                      <p className="repo-desc">{repo.description || '无描述'}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {analysis.relevant.length === 0 && (
              <section className="card">
                <h3>相关项目</h3>
                <p>没有找到与你的想法直接匹配的项目。</p>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p>数据来源：GitHub Search API（无需登录）。输入中文会自动转换为英文关键词搜索。</p>
      </footer>
    </div>
  )
}

export default App
