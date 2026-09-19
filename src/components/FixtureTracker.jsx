import { useMemo, useState } from 'react'
import { db, doc, setDoc, deleteDoc } from '../firebase'

const norm = (s) => String(s || '').toLowerCase().trim()

const STATUS_STYLES = {
  pending: { background: 'rgba(0, 212, 255, 0.12)', color: 'var(--accent-cyan)', borderColor: 'rgba(0, 212, 255, 0.35)' },
  accepted: { background: 'rgba(0, 212, 255, 0.12)', color: 'var(--accent-cyan)', borderColor: 'rgba(0, 212, 255, 0.35)' },
  proposed: { background: 'rgba(255, 170, 0, 0.14)', color: '#ffb14e', borderColor: 'rgba(255, 170, 0, 0.4)' },
  countered: { background: 'rgba(255, 170, 0, 0.14)', color: '#ffb14e', borderColor: 'rgba(255, 170, 0, 0.4)' },
  result_submitted: { background: 'rgba(255, 193, 7, 0.15)', color: '#ffd54f', borderColor: 'rgba(255, 193, 7, 0.45)' },
  approved: { background: 'rgba(76, 175, 80, 0.15)', color: '#81c784', borderColor: 'rgba(76, 175, 80, 0.4)' },
  completed: { background: 'rgba(76, 175, 80, 0.15)', color: '#81c784', borderColor: 'rgba(76, 175, 80, 0.4)' },
  rejected: { background: 'rgba(244, 67, 54, 0.15)', color: '#e57373', borderColor: 'rgba(244, 67, 54, 0.4)' },
  cancelled: { background: 'rgba(128, 128, 128, 0.12)', color: '#aaa', borderColor: 'rgba(128, 128, 128, 0.3)' }
}

export default function FixtureTracker({
  user,
  allPlayers,
  allFixtures,
  allResults,
  adminData,
  updateFixtures,
  notifyUser,
  triggerDataRefresh,
  showToast,
  onReviewResults,
  onOpenSubmitResult
}) {
  const [competitionFilter, setCompetitionFilter] = useState('all')
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [setDateFor, setSetDateFor] = useState(null)
  const [dateVal, setDateVal] = useState('')
  const [timeVal, setTimeVal] = useState('')
  const [forfeitFor, setForfeitFor] = useState(null)
  const [winner, setWinner] = useState('')
  const [busyId, setBusyId] = useState('')

  const logAudit = async (action, details) => {
    try {
      await setDoc(doc(db, 'auditLogs', `fix_${Date.now()}_${Math.floor(Math.random() * 10000)}`), {
        adminId: user?.id || 'unknown',
        adminName: user?.username || 'unknown',
        action,
        details,
        timestamp: new Date().toISOString()
      })
    } catch (e) { console.error('Audit log failed', e) }
  }

  const findUser = (idOrName) => {
    const s = String(idOrName || '')
    if (!s) return null
    return allPlayers.find(u =>
      String(u.id) === s ||
      (u.username && norm(u.username) === norm(s)) ||
      (u.nickname && norm(u.nickname) === norm(s))
    ) || null
  }

  const fixtures = useMemo(() => {
    return allFixtures
      .filter(f => !f._deleted)
      .map(f => {
        const p1 = findUser(f.player1Id || f.player1)
        const p2 = findUser(f.player2Id || f.player2)
        if (!p1 || !p2) return null
        const gt = norm(f.gameType)
        const isCup = !!f.cupId || gt === 'cup'
        const isPlayoff = gt.includes('playoff') || gt.includes('play-off') || gt === 'playoffs'
        const isFriendly = gt.includes('friendly')
        const competition = isCup ? 'Cup' : isPlayoff ? 'Playoff' : isFriendly ? 'Friendly' : 'League'
        const status = norm(f.status) || 'pending'
        return {
          id: f.id,
          raw: f,
          p1,
          p2,
          competition,
          cupName: f.cupName || '',
          season: f.season || '',
          division: f.division && f.division !== 'Unassigned' ? f.division : (p1.division && p1.division !== 'Unassigned' ? p1.division : (p2.division || 'Unassigned')),
          status,
          createdAt: f.createdAt,
          scheduledDate: f.fixtureDate || '',
          scheduledTime: f.fixtureTime || '',
          proposedDate: f.proposedDate || '',
          proposedTime: f.proposedTime || '',
          proposedBy: f.proposedBy || '',
          counterDate: f.counterDate || ''
        }
      })
      .filter(Boolean)
  }, [allFixtures, allPlayers])

  const resultForFixture = (fixture) => {
    const hit = allResults.find(r => r.fixtureId && String(r.fixtureId) === String(fixture.id))
    if (hit) return hit
    if (fixture.competition === 'League' || fixture.competition === 'Friendly') {
      const p1 = fixture.p1.id
      const p2 = fixture.p2.id
      return allResults.find(r =>
        norm(r.status) === 'approved' &&
        !r.cupId &&
        String(r.gameType || '').toLowerCase().includes('league') &&
        (
          (String(r.player1Id) === String(p1) && String(r.player2Id) === String(p2)) ||
          (String(r.player1Id) === String(p2) && String(r.player2Id) === String(p1))
        ) &&
        (!fixture.season || !r.season || String(r.season) === String(fixture.season))
      ) || null
    }
    return null
  }

  const divisions = useMemo(() => {
    const set = new Set()
    allPlayers.forEach(u => { if (u.division && u.division !== 'Unassigned') set.add(u.division) })
    fixtures.forEach(f => { if (f.division && f.division !== 'Unassigned') set.add(f.division) })
    return Array.from(set).sort()
  }, [allPlayers, fixtures])

  const isOverdue = (f) => {
    if (!f.scheduledDate) return false
    const d = new Date(`${f.scheduledDate}T23:59:59`)
    if (isNaN(d.getTime())) return false
    return d.getTime() < Date.now()
  }

  const analyze = (f) => {
    const result = resultForFixture(f)
    const isDone = ['approved', 'completed', 'rejected'].includes(f.status)
    const submitted = f.status === 'result_submitted' || (result && !['approved', 'rejected'].includes(norm(result.status)))
    const conflict = ['proposed', 'countered'].includes(f.status)
    const due = f.status === 'accepted' && isOverdue(f) && !result
    const futureClean = f.status === 'accepted' && !isOverdue(f) && !result
    const open = ['pending', 'accepted'].includes(f.status) && !result
    const priority = submitted ? 0 : conflict ? 1 : due ? 2 : futureClean ? 3 : open ? 4 : 5
    return { result, isDone, submitted, conflict, due, futureClean, open, priority }
  }

  const queue = useMemo(() => {
    return fixtures
      .map(f => ({ f, a: analyze(f) }))
      .filter(x => !x.a.isDone)
      .sort((x, y) => x.a.priority - y.a.priority || String(x.f.createdAt || '').localeCompare(String(y.f.createdAt || '')))
  }, [fixtures, allResults])

  const playedCount = fixtures.reduce((n, f) => n + (f.status === 'approved' || f.status === 'completed' || (resultForFixture(f) && norm(resultForFixture(f).status) === 'approved') ? 1 : 0), 0)

  const counts = useMemo(() => {
    const toPlay = queue.filter(x => x.a.priority <= 4).length
    const conflicts = queue.filter(x => x.a.conflict).length
    const awaiting = queue.filter(x => x.a.submitted).length
    const overdue = queue.filter(x => x.a.due).length
    return { toPlay, conflicts, awaiting, overdue }
  }, [queue])

  const filtered = useMemo(() => {
    let list = fixtures
    if (competitionFilter !== 'all') list = list.filter(f => f.competition === competitionFilter)
    if (divisionFilter !== 'all') list = list.filter(f => f.division === divisionFilter)
    if (statusFilter !== 'all') list = list.filter(f => f.status === statusFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(f => f.p1.username.toLowerCase().includes(s) || f.p2.username.toLowerCase().includes(s) || f.cupName.toLowerCase().includes(s))
    }
    return list
  }, [fixtures, competitionFilter, divisionFilter, statusFilter, search])

  const updateFixture = async (fixture, updates) => {
    const updatedFixture = { ...fixture.raw, ...updates, updatedAt: new Date().toISOString() }
    await setDoc(doc(db, 'fixtures', String(fixture.id)), updatedFixture, { merge: true })
    const list = [...allFixtures]
    const idx = list.findIndex(x => String(x.id) === String(fixture.id))
    if (idx !== -1) list[idx] = updatedFixture
    else list.push(updatedFixture)
    updateFixtures(list)
    return updatedFixture
  }

  const handleRemind = async (fixture) => {
    if (busyId) return
    setBusyId(`r_${fixture.id}`)
    try {
      const dateTxt = fixture.scheduledDate ? ` on ${fixture.scheduledDate}` : (fixture.proposedDate ? ` (proposed: ${fixture.proposedDate})` : '')
      const msg = `Your ${fixture.competition} match vs ` + `{opp}` + ` is due${dateTxt}. Arrange a time to play!`
      await notifyUser(fixture.p1.id, 'Fixture Reminder', msg.replace('{opp}', fixture.p2.username), 'fixture_reminder', { fixtureId: fixture.id })
      await notifyUser(fixture.p2.id, 'Fixture Reminder', msg.replace('{opp}', fixture.p1.username), 'fixture_reminder', { fixtureId: fixture.id })
      await logAudit('FIXTURE_REMIND', `Reminded ${fixture.p1.username} & ${fixture.p2.username} re: ${fixture.competition} fixture (${fixture.id})`)
      showToast('Reminder sent to both players', 'success')
    } catch (e) { showToast('Remind failed: ' + e.message, 'error') }
    setBusyId('')
  }

  const handleSetDate = async () => {
    if (!setDateFor) return
    if (!dateVal) return showToast('Pick an agreed date', 'error')
    if (busyId) return
    setBusyId(`d_${setDateFor.id}`)
    try {
      await updateFixture(setDateFor, { status: 'accepted', fixtureDate: dateVal, fixtureTime: timeVal || '', acceptedBy: user?.username || 'admin', acceptedAt: new Date().toISOString() })
      await logAudit('FIXTURE_DATE', `Admin set date ${dateVal}${timeVal ? ' ' + timeVal : ''} for ${setDateFor.p1.username} vs ${setDateFor.p2.username}`)
      showToast('Fixture date set', 'success')
      setSetDateFor(null); setDateVal(''); setTimeVal('')
    } catch (e) { showToast('Failed: ' + e.message, 'error') }
    setBusyId('')
  }

  const handleApplyForfeit = async () => {
    if (!forfeitFor) return
    if (!winner) return showToast('Select the forfeit winner', 'error')
    if (busyId) return
    setBusyId(`f_${forfeitFor.id}`)
    const fixture = forfeitFor
    const winIsP1 = String(winner) === String(fixture.p1.id)
    const winnerP = winIsP1 ? fixture.p1 : fixture.p2
    const loserP = winIsP1 ? fixture.p2 : fixture.p1
    const resultId = `admin_${Date.now()}`
    const targetSeason = fixture.season || adminData?.currentSeason || 'Season 1'
    try {
      const newMatch = {
        id: resultId,
        player1: fixture.p1.username,
        player1Id: fixture.p1.id,
        player2: fixture.p2.username,
        player2Id: fixture.p2.id,
        score1: winIsP1 ? 1 : 0,
        score2: winIsP1 ? 0 : 1,
        gameType: 'League',
        status: 'approved',
        season: targetSeason,
        division: fixture.competition === 'Cup' ? '' : (fixture.p1.division || ''),
        date: new Date().toISOString().split('T')[0],
        submittedAt: new Date().toISOString(),
        submittedBy: 'admin',
        forfeit: true,
        forfeitWinner: winnerP.id,
        forfeitNote: `${winnerP.username} wins by forfeit`,
        player1Stats: {},
        player2Stats: {}
      }
      await setDoc(doc(db, 'results', resultId), newMatch)
      await updateFixture(fixture, { status: 'approved', resultId, score1: newMatch.score1, score2: newMatch.score2 })
      await logAudit('FIXTURE_FORFEIT', `Forfeit: ${winnerP.username} def ${loserP.username} (${fixture.competition}${fixture.season ? ' ' + fixture.season : ''})`)
      triggerDataRefresh('all')
      showToast(`${winnerP.username} wins by forfeit - 3 points awarded`, 'success')
      setForfeitFor(null); setWinner('')
    } catch (e) { showToast('Forfeit failed: ' + e.message, 'error') }
    setBusyId('')
  }

  const handleRemove = async (fixture) => {
    if (!window.confirm(`Delete this ${fixture.competition} fixture between ${fixture.p1.username} and ${fixture.p2.username}?`)) return
    if (busyId) return
    setBusyId(`x_${fixture.id}`)
    try {
      await deleteDoc(doc(db, 'fixtures', String(fixture.id)))
      updateFixtures(allFixtures.filter(x => String(x.id) !== String(fixture.id)))
      await logAudit('FIXTURE_DELETE', `Deleted ${fixture.competition} fixture: ${fixture.p1.username} vs ${fixture.p2.username}`)
      showToast('Fixture deleted', 'success')
    } catch (e) { showToast('Delete failed: ' + e.message, 'error') }
    setBusyId('')
  }

  const coverage = useMemo(() => {
    const currentSeason = adminData?.currentSeason || ''
    return divisions.map(div => {
      const roster = allPlayers.filter(u => u.division === div)
      const rows = roster.map(u => {
        const resultsFor = allResults.filter(r =>
          norm(r.status) === 'approved' &&
          !r.cupId &&
          String(r.gameType || '').toLowerCase().includes('league') &&
          (!currentSeason || !r.season || String(r.season) === String(currentSeason)) &&
          (String(r.player1Id) === String(u.id) || String(r.player2Id) === String(u.id))
        )
        const played = resultsFor.length
        const opponentsPlayed = new Set(resultsFor.map(r => String(r.player1Id) === String(u.id) ? r.player2Id : r.player1Id))
        const scheduled = fixtures.filter(f =>
          f.division === div &&
          !['approved', 'completed', 'rejected'].includes(f.status) &&
          (String(f.p1.id) === String(u.id) || String(f.p2.id) === String(u.id))
        )
        const scheduledOpponents = new Set(scheduled.map(f => String(f.p1.id) === String(u.id) ? f.p2.id : f.p1.id))
        const owed = Math.max(0, roster.length - 1 - opponentsPlayed.size)
        const open = roster.filter(m => m.id !== u.id && !opponentsPlayed.has(m.id)).filter(m => !scheduledOpponents.has(m.id)).length
        return { user: u, played, scheduled: scheduled.length, owed, open }
      }).filter(r => r)
      return { div, roster: rows }
    })
  }, [divisions, allPlayers, allResults, fixtures, adminData])

  const cardStyle = { textAlign: 'center' }

  const actionBtn = (onClick, label, variant = 'btn-secondary', busy = false) => (
    <button
      className={`btn ${variant} btn-sm`}
      onClick={onClick}
      disabled={!!busyId}
      style={{ whiteSpace: 'nowrap', opacity: busyId ? 0.5 : 1 }}
    >
      {busy ? '...' : label}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass" style={{ padding: '16px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: '120px', marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--text-muted)' }}>Competition</label>
            <select value={competitionFilter} onChange={e => setCompetitionFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="all">All</option>
              <option value="League">League</option>
              <option value="Cup">Cup</option>
              <option value="Playoff">Playoff</option>
              <option value="Friendly">Friendly</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '140px', marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--text-muted)' }}>Division</label>
            <select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="all">All Divisions</option>
              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--text-muted)' }}>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="proposed">Proposed</option>
              <option value="countered">Countered</option>
              <option value="result_submitted">Result Submitted</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="form-group" style={{ flexGrow: 1, minWidth: '180px', marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--text-muted)' }}>Search</label>
            <input placeholder="Player or cup..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <div className="glass" style={cardStyle}><div style={{ fontSize: 26, fontWeight: 800 }}>{counts.toPlay}</div><div style={{ color: 'var(--text-muted)', fontSize: 13 }}>To Play</div></div>
        <div className="glass" style={cardStyle}><div style={{ fontSize: 26, fontWeight: 800, color: counts.conflicts ? 'var(--accent-cyan)' : 'inherit' }}>{counts.conflicts}</div><div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Scheduling Conflicts</div></div>
        <div className="glass" style={cardStyle}><div style={{ fontSize: 26, fontWeight: 800, color: counts.awaiting ? '#ffd54f' : 'inherit' }}>{counts.awaiting}</div><div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Awaiting Review</div></div>
        <div className="glass" style={cardStyle}><div style={{ fontSize: 26, fontWeight: 800, color: counts.overdue ? '#e57373' : 'inherit' }}>{counts.overdue}</div><div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Overdue</div></div>
        <div className="glass" style={cardStyle}><div style={{ fontSize: 26, fontWeight: 800 }}>{playedCount}</div><div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Played</div></div>
      </div>

      <div className="glass" style={{ padding: '16px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Needs Attention</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Fixtures not yet completed, worst first</span>
        </div>
        {queue.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>No outstanding fixtures. All clear!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {queue.map(({ f, a }) => {
              const dateTxt = f.scheduledDate ? `${f.scheduledDate}${f.scheduledTime ? ' ' + f.scheduledTime : ''}` : (f.counterDate || f.proposedDate || '')
              return (
                <div key={f.id} className="glass" style={{ padding: '12px', borderRadius: '10px', border: a.overdue ? '1px solid rgba(229, 115, 115, 0.5)' : (a.conflict ? '1px dashed rgba(255, 170, 0, 0.5)' : '1px solid transparent') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '180px' }}>
                      <strong>{f.p1.username}</strong> vs <strong>{f.p2.username}</strong>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {f.competition}{f.cupName ? ` · ${f.cupName}` : ''}{f.division !== 'Unassigned' ? ` · ${f.division}` : ''}
                      </div>
                    </div>
                    <span className="btn btn-sm" style={{ ...(STATUS_STYLES[f.status] || STATUS_STYLES.pending), border: '1px solid', cursor: 'default', padding: '4px 10px', fontSize: 11 }}>
                      {f.status.replace('_', ' ')}
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: '150px' }}>
                      {dateTxt ? <>📅 {dateTxt}</> : <span style={{ color: a.conflict ? '#ffb14e' : '#aaa' }}>{a.conflict ? 'agreeing a date' : 'no date yet'}</span>}
                      {a.overdue && <div style={{ color: '#e57373', fontWeight: 700 }}>⚠ Overdue - no result</div>}
                      {a.result && a.submitted && <div style={{ color: '#ffd54f' }}>Result pending review</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {a.submitted && onReviewResults && actionBtn(() => onReviewResults(), 'Review', 'btn-primary', busyId === `r_${f.id}`)}
                      {actionBtn(() => handleRemind(f), 'Remind', 'btn-secondary', busyId === `r_${f.id}`)}
                      {!a.submitted && actionBtn(() => { setSetDateFor(f); setDateVal(f.scheduledDate || ''); setTimeVal(f.scheduledTime || '') }, 'Set Date', 'btn-secondary', busyId === `d_${f.id}`)}
                      {!a.submitted && f.competition !== 'Cup' && actionBtn(() => { setForfeitFor(f); setWinner('') }, 'Forfeit', 'btn-danger', busyId === `f_${f.id}`)}
                      {!a.submitted && onOpenSubmitResult && actionBtn(() => onOpenSubmitResult(f), 'Result', 'btn-secondary', busyId === `o_${f.id}`)}
                      {!a.submitted && (a.conflict || a.open) && actionBtn(() => handleRemove(f), 'Delete', 'btn-secondary', busyId === `x_${f.id}`)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="glass" style={{ padding: '16px', borderRadius: '12px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>All Fixtures ({filtered.length})</h3>
        {filtered.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>No fixtures match the current filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Players</th><th>Competition</th><th>Division</th><th>Status</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))).map(f => {
                  const dateTxt = f.scheduledDate ? `${f.scheduledDate}${f.scheduledTime ? ' ' + f.scheduledTime : ''}` : (f.counterDate || f.proposedDate || '—')
                  return (
                    <tr key={f.id}>
                      <td style={{ padding: '8px' }}>{f.p1.username} vs {f.p2.username}</td>
                      <td style={{ padding: '8px' }}>{f.competition}{f.cupName ? ` · ${f.cupName}` : ''}</td>
                      <td style={{ padding: '8px' }}>{f.division}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ ...(STATUS_STYLES[f.status] || STATUS_STYLES.pending), border: '1px solid', borderRadius: '6px', padding: '2px 8px', fontSize: 11 }}>
                          {f.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>{dateTxt}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {coverage.map(({ div, roster }) => (
        <div className="glass" key={div} style={{ padding: '16px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{div} · Fixture Coverage</h3>
          {roster.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No players assigned.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th>Player</th><th>Played</th><th>Scheduled</th><th>Owed</th></tr>
                </thead>
                <tbody>
                  {roster.map(({ user: u, played, scheduled, owed }) => (
                    <tr key={u.id}>
                      <td style={{ padding: '8px' }}>{u.username}</td>
                      <td style={{ padding: '8px' }}>{played}</td>
                      <td style={{ padding: '8px' }}>{scheduled}</td>
                      <td style={{ padding: '8px', color: owed > 0 ? '#ffb14e' : '#81c784' }}>{owed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {setDateFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass" style={{ padding: '20px', borderRadius: '14px', width: '100%', maxWidth: '360px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Set Fixture Date</h3>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '12px' }}>{setDateFor.p1.username} vs {setDateFor.p2.username}</div>
            <div className="form-group"><label>Date</label><input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} /></div>
            <div className="form-group"><label>Time (optional)</label><input type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)} /></div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setSetDateFor(null); setDateVal(''); setTimeVal('') }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSetDate} disabled={!dateVal}>{busyId ? '...' : 'Save Date'}</button>
            </div>
          </div>
        </div>
      )}

      {forfeitFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass" style={{ padding: '20px', borderRadius: '14px', width: '100%', maxWidth: '380px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Apply Forfeit</h3>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '12px' }}>{forfeitFor.p1.username} vs {forfeitFor.p2.username} · winner gets 3 points</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[forfeitFor.p1, forfeitFor.p2].map(u => (
                <button
                  key={u.id}
                  className={`btn btn-sm ${String(winner) === String(u.id) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setWinner(u.id)}
                >
                  {u.username}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setForfeitFor(null); setWinner('') }}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleApplyForfeit} disabled={!winner}>{busyId ? '...' : 'Confirm Forfeit'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}