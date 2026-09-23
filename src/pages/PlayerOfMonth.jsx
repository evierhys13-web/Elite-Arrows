import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContextInternal'
import { db, collection, getDocs, doc, setDoc, deleteDoc } from '../firebase'
import { useToast } from '../context/ToastContext'

const DIVISIONS = ['Elite', 'Emerald', 'Diamond', 'Platinum']

const monthKeyFor = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const shiftMonths = (date, offset) => {
  const d = new Date(date.getFullYear(), date.getMonth() + offset, 1)
  return d
}

export default function PlayerOfMonth() {
  const { user, getAllUsers } = useAuth()
  const { showToast } = useToast()
  const [allUsers, setAllUsers] = useState([])
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [votes, setVotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [votingFor, setVotingFor] = useState(null)

  const monthKey = monthKeyFor(monthDate)
  const isCurrentMonth = monthKey === monthKeyFor(new Date())

  const loadUsers = useCallback(() => {
    const users = getAllUsers()
    setAllUsers(users)
  }, [getAllUsers])

  useEffect(() => { loadUsers() }, [loadUsers])

  useEffect(() => {
    let active = true
    setLoading(true)
    getDocs(collection(db, 'playerOfMonthVotes'))
      .then((snap) => {
        if (!active) return
        const monthVotes = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((v) => String(v.monthKey) === monthKey)
        setVotes(monthVotes)
      })
      .catch(() => {
        if (active) setVotes([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [monthKey])

  const divisionVotes = useMemo(() => {
    return DIVISIONS.map((division) => {
      const divisionUsers = allUsers.filter((u) => String(u.division) === division)
      const divisionVotes = votes.filter((v) => String(v.division) === division)
      const tally = {}
      divisionVotes.forEach((v) => {
        const key = String(v.nomineeId)
        tally[key] = (tally[key] || 0) + 1
      })
      const rows = divisionUsers
        .map((u) => ({
          user: u,
          votes: tally[String(u.id)] || 0
        }))
        .sort((a, b) => b.votes - a.votes)
      const myVote = divisionVotes.find((v) => String(v.voterId) === String(user?.id))
      const leader = rows[0] && rows[0].votes > 0 ? rows[0] : null
      return { division, rows, myVote, leader }
    })
  }, [allUsers, votes, user])

  const handleVote = async (division, nomineeId, e) => {
    e.stopPropagation()
    if (!user?.id) return showToast('You need to be signed in to vote', 'error')
    if (!isCurrentMonth) return showToast('Voting is only open for the current month', 'error')
    if (String(nomineeId) === String(user.id)) return showToast('You cannot vote for yourself', 'error')

    setVotingFor(`${division}_${nomineeId}`)
    try {
      const voteId = `${monthKey}_${division}_${user.id}`
      await setDoc(doc(db, 'playerOfMonthVotes', voteId), {
        monthKey,
        division,
        voterId: user.id,
        nomineeId,
        createdAt: new Date().toISOString()
      })
      showToast('Vote cast!', 'success')
      const snap = await getDocs(collection(db, 'playerOfMonthVotes'))
      setVotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((v) => String(v.monthKey) === monthKey))
    } catch (err) {
      showToast('Could not cast your vote: ' + err.message, 'error')
    } finally {
      setVotingFor(null)
    }
  }

  const handleRemoveVote = async (division) => {
    if (!user?.id || !isCurrentMonth) return
    try {
      const voteId = `${monthKey}_${division}_${user.id}`
      await deleteDoc(doc(db, 'playerOfMonthVotes', voteId))
      showToast('Vote removed', 'success')
      setVotes((prev) => prev.filter((v) => String(v.id) !== String(voteId)))
    } catch (err) {
      showToast('Could not remove vote: ' + err.message, 'error')
    }
  }

  return (
    <div className="page-container">
      <h1 className="page-title">Player of the Month</h1>
      <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
        Members vote for the player of the month in each division - the standings leader isn't automatically the winner.
      </p>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setMonthDate(shiftMonths(monthDate, -1))}>◀ Previous</button>
        <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
          {monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          {isCurrentMonth && <span style={{ fontSize: '0.75rem', marginLeft: '8px', color: 'var(--success)' }}>(voting open)</span>}
        </span>
        {!isCurrentMonth && (
          <button className="btn btn-primary btn-sm" onClick={() => setMonthDate(new Date())}>Current month</button>
        )}
      </div>

      {loading ? (
        <div className="glass" style={{ padding: '32px', textAlign: 'center' }}>Loading votes...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {divisionVotes.map(({ division, rows, myVote, leader }) => (
            <div key={division} className="card glass">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>{division}</h3>
                {leader && (
                  <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                    🏆 {leader.user.username || 'Leader'}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                {rows.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No players in this division yet.</p>}
                {rows.map(({ user: p, votes: count }) => {
                  const isMine = String(p.id) === String(user?.id)
                  const isMyVote = myVote && String(myVote.nomineeId) === String(p.id)
                  const isVoting = votingFor === `${division}_${p.id}`
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.2)',
                        border: isMyVote ? '1px solid var(--accent-cyan)' : '1px solid transparent'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.username || p.nickname || 'Unknown'}</span>
                        {isMine && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(you)</span>}
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{count} ⚡</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {isMyVote ? (
                          <button className="btn btn-secondary btn-sm" onClick={(e) => handleRemoveVote(division, e)}>
                            Remove
                          </button>
                        ) : (
                          !isMine && isCurrentMonth && (
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={isVoting || !!myVote}
                              onClick={(e) => handleVote(division, p.id, e)}
                            >
                              {isVoting ? '...' : 'Vote'}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '14px', lineHeight: 1.5 }}>
                {isCurrentMonth ? (
                  myVote ? 'You have voted for this division. Remove your vote to pick someone else.' : 'Pick your player of the month for this division (one vote per member).'
                ) : 'Voting closed for this month.'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}