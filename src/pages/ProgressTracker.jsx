import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Breadcrumbs from '../components/Breadcrumbs'
import { saveProgressLog, fetchProgressLogs, deleteProgressLog } from '../utils/progressService'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function ProgressTracker() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedMetric, setSelectedMetric] = useState('avg3')

  const initialFormData = {
    date: new Date().toISOString().split('T')[0],
    type: 'Daily',
    gameType: '501',
    legFormatType: 'Best of',
    legs: '3',
    avg3: '',
    avg9: '',
    checkoutRate: '',
    highestCheckout: '',
    count180: '',
    isPublic: false,
    weeklyData: DAYS_OF_WEEK.map(day => ({ day, avg3: '', avg9: '', checkoutRate: '', highestCheckout: '', count180: '' }))
  }

  const [formData, setFormData] = useState(initialFormData)

  useEffect(() => {
    if (user?.id) {
      loadLogs()
    }
  }, [user?.id])

  const loadLogs = async () => {
    setLoading(true)
    const data = await fetchProgressLogs(user.id)
    setLogs(data)
    setLoading(false)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleWeeklyInputChange = (index, field, value) => {
    const updatedWeekly = [...formData.weeklyData]
    updatedWeekly[index] = { ...updatedWeekly[index], [field]: value }

    // Auto-calculate weekly averages if this is a Weekly Summary
    if (formData.type === 'Weekly') {
      const activeDays = updatedWeekly.filter(d => d.avg3 || d.avg9 || d.checkoutRate)
      const count = activeDays.length || 1

      const sumAvg3 = activeDays.reduce((acc, d) => acc + (parseFloat(d.avg3) || 0), 0)
      const sumAvg9 = activeDays.reduce((acc, d) => acc + (parseFloat(d.avg9) || 0), 0)
      const sumCO = activeDays.reduce((acc, d) => acc + (parseFloat(d.checkoutRate) || 0), 0)
      const maxCO = Math.max(...updatedWeekly.map(d => parseInt(d.highestCheckout) || 0))
      const total180s = updatedWeekly.reduce((acc, d) => acc + (parseInt(d.count180) || 0), 0)

      setFormData(prev => ({
        ...prev,
        weeklyData: updatedWeekly,
        avg3: (sumAvg3 / count).toFixed(1),
        avg9: (sumAvg9 / count).toFixed(1),
        checkoutRate: (sumCO / count).toFixed(1),
        highestCheckout: maxCO,
        count180: total180s
      }))
    } else {
      setFormData(prev => ({ ...prev, weeklyData: updatedWeekly }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const logData = {
        ...formData,
        avg3: parseFloat(formData.avg3) || 0,
        avg9: parseFloat(formData.avg9) || 0,
        checkoutRate: parseFloat(formData.checkoutRate) || 0,
        highestCheckout: parseInt(formData.highestCheckout) || 0,
        count180: parseInt(formData.count180) || 0
      }

      const savedLog = await saveProgressLog(user.id, logData, editingId)
      showToast(editingId ? 'Progress updated!' : 'Progress entry saved!', 'success')
      setShowModal(false)
      setEditingId(null)

      // Update local state immediately to avoid waiting for fetch
      if (editingId) {
        setLogs(prev => prev.map(l => l.id === editingId ? savedLog : l))
      } else {
        setLogs(prev => [savedLog, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
      }

      loadLogs() // Still refresh from server to sync serverTimestamp
      setFormData(initialFormData)
    } catch (error) {
      console.error('Save failed:', error)
      showToast('Failed to save entry: ' + (error.message || 'Unknown error'), 'error')
    }
  }

  const handleEdit = (log) => {
    setEditingId(log.id)
    setFormData({
      ...initialFormData,
      ...log,
      weeklyData: log.weeklyData || initialFormData.weeklyData
    })
    setShowModal(true)
  }

  const handleDelete = async (logId) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      const success = await deleteProgressLog(logId)
      if (success) {
        showToast('Entry deleted', 'success')
        setLogs(prev => prev.filter(l => l.id !== logId))
      } else {
        showToast('Failed to delete entry', 'error')
      }
    }
  }

  const chartData = useMemo(() => {
    return [...logs].reverse().map(log => ({
      date: new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: log[selectedMetric],
      fullDate: log.date
    }))
  }, [logs, selectedMetric])

  const metrics = [
    { id: 'avg3', label: '3-Dart Avg', color: '#22c55e' },
    { id: 'avg9', label: '9-Dart Avg', color: '#3b82f6' },
    { id: 'checkoutRate', label: 'Checkout %', color: '#fbbf24' },
    { id: 'highestCheckout', label: 'Highest CO', color: '#a855f7' },
    { id: 'count180', label: '180s', color: '#ef4444' }
  ]

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Progress Tracker' }]} />

      <div className="page-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title text-gradient">Progress Tracker</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track and visualize your personal darting journey.</p>
        </div>
        <button className="btn btn-primary glass" onClick={() => { setEditingId(null); setFormData(initialFormData); setShowModal(true); }}>
          + Add Entry
        </button>
      </div>

      <div className="card glass" style={{ marginBottom: '32px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="card-title">Performance Trends</h3>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {metrics.map(m => (
              <button
                key={m.id}
                className={`btn btn-sm ${selectedMetric === m.id ? '' : 'btn-secondary'}`}
                onClick={() => setSelectedMetric(m.id)}
                style={{
                  borderRadius: '99px',
                  whiteSpace: 'nowrap',
                  background: selectedMetric === m.id ? m.color : 'rgba(255,255,255,0.05)',
                  borderColor: m.color,
                  color: selectedMetric === m.id ? '#000' : 'white',
                  fontWeight: selectedMetric === m.id ? 800 : 400
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '350px', width: '100%' }}>
          {logs.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: metrics.find(m => m.id === selectedMetric)?.color }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={metrics.find(m => m.id === selectedMetric)?.color}
                  strokeWidth={3}
                  dot={{ r: 4, fill: metrics.find(m => m.id === selectedMetric)?.color, strokeWidth: 2, stroke: 'var(--bg-primary)' }}
                  name={metrics.find(m => m.id === selectedMetric)?.label}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              {loading ? 'Loading performance data...' : 'No data available. Add your first entry to see the graph!'}
            </div>
          )}
        </div>
      </div>

      <div className="card glass" style={{ padding: '24px' }}>
        <h3 className="card-title" style={{ marginBottom: '20px' }}>Entry History</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Type</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Format</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>Avg</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>CO %</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>Best CO</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>180s</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{log.date}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)'
                    }}>
                      {log.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {log.type !== 'Weekly' ? `${log.gameType || '501'} • ${log.legFormatType === 'Best of' ? 'Bo' : 'Ft'} ${log.legs || 3}` : '-'}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', color: '#22c55e' }}>{log.avg3}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{log.checkoutRate}%</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{log.highestCheckout}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{log.count180}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-secondary glass" onClick={() => handleEdit(log)}>Edit</button>
                      <button className="btn btn-sm btn-danger glass" onClick={() => handleDelete(log.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ zIndex: 1000 }}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: formData.type === 'Weekly' ? '900px' : '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="text-gradient" style={{ margin: 0 }}>{editingId ? 'Edit Progress Entry' : 'Add Progress Entry'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>{formData.type === 'Weekly' ? 'Week Starting' : 'Date'}</label>
                  <input
                    className="glass"
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select className="glass" name="type" value={formData.type} onChange={handleInputChange}>
                    <option value="Daily">Daily Log</option>
                    <option value="Weekly">Weekly Summary</option>
                    <option value="Session">Individual Session</option>
                  </select>
                </div>
              </div>

              {formData.type !== 'Weekly' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div className="form-group">
                    <label>Game Type</label>
                    <select className="glass" name="gameType" value={formData.gameType} onChange={handleInputChange}>
                      <option value="301">301</option>
                      <option value="501">501</option>
                      <option value="701">701</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Format</label>
                    <select className="glass" name="legFormatType" value={formData.legFormatType} onChange={handleInputChange}>
                      <option value="Best of">Best of</option>
                      <option value="First to">First to</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Legs</label>
                    <input
                      className="glass"
                      type="number"
                      name="legs"
                      value={formData.legs}
                      onChange={handleInputChange}
                      min="1"
                    />
                  </div>
                </div>
              )}

              {formData.type === 'Weekly' ? (
                <div className="card" style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
                  <h4 style={{ marginBottom: '16px', color: 'var(--accent-cyan)' }}>Weekly Performance Table</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Day</th>
                          <th style={{ textAlign: 'center', padding: '8px' }}>3-Dart Avg</th>
                          <th style={{ textAlign: 'center', padding: '8px' }}>9-Dart Avg</th>
                          <th style={{ textAlign: 'center', padding: '8px' }}>CO %</th>
                          <th style={{ textAlign: 'center', padding: '8px' }}>Best CO</th>
                          <th style={{ textAlign: 'center', padding: '8px' }}>180s</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.weeklyData.map((dayData, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '8px', fontWeight: 'bold', fontSize: '0.8rem' }}>{dayData.day}</td>
                            <td style={{ padding: '4px' }}>
                              <input
                                className="glass"
                                style={{ textAlign: 'center', padding: '6px' }}
                                type="number" step="0.1"
                                value={dayData.avg3}
                                onChange={(e) => handleWeeklyInputChange(idx, 'avg3', e.target.value)}
                              />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input
                                className="glass"
                                style={{ textAlign: 'center', padding: '6px' }}
                                type="number" step="0.1"
                                value={dayData.avg9}
                                onChange={(e) => handleWeeklyInputChange(idx, 'avg9', e.target.value)}
                              />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input
                                className="glass"
                                style={{ textAlign: 'center', padding: '6px' }}
                                type="number" step="0.1"
                                value={dayData.checkoutRate}
                                onChange={(e) => handleWeeklyInputChange(idx, 'checkoutRate', e.target.value)}
                              />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input
                                className="glass"
                                style={{ textAlign: 'center', padding: '6px' }}
                                type="number"
                                value={dayData.highestCheckout}
                                onChange={(e) => handleWeeklyInputChange(idx, 'highestCheckout', e.target.value)}
                              />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input
                                className="glass"
                                style={{ textAlign: 'center', padding: '6px' }}
                                type="number"
                                value={dayData.count180}
                                onChange={(e) => handleWeeklyInputChange(idx, 'count180', e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Calculated totals will update automatically above the save button.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label>3-Dart Average</label>
                      <input
                        className="glass"
                        type="number"
                        step="0.01"
                        name="avg3"
                        placeholder="e.g. 55.5"
                        value={formData.avg3}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>9-Dart Average</label>
                      <input
                        className="glass"
                        type="number"
                        step="0.01"
                        name="avg9"
                        placeholder="e.g. 65.2"
                        value={formData.avg9}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label>Checkout %</label>
                      <input
                        className="glass"
                        type="number"
                        step="0.1"
                        name="checkoutRate"
                        placeholder="20.5"
                        value={formData.checkoutRate}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Best CO</label>
                      <input
                        className="glass"
                        type="number"
                        name="highestCheckout"
                        placeholder="170"
                        max="170"
                        value={formData.highestCheckout}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>180 Count</label>
                      <input
                        className="glass"
                        type="number"
                        name="count180"
                        placeholder="0"
                        value={formData.count180}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.type === 'Weekly' && (
                <div style={{ padding: '12px', background: 'rgba(77, 168, 218, 0.1)', borderRadius: '8px', border: '1px dashed var(--accent-primary)' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weekly Avg</div>
                        <div style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{formData.avg3 || '0.0'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weekly CO%</div>
                        <div style={{ fontWeight: 'bold', color: 'var(--success)' }}>{formData.checkoutRate || '0.0'}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total 180s</div>
                        <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{formData.count180 || '0'}</div>
                      </div>
                   </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  name="isPublic"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={handleInputChange}
                />
                <label htmlFor="isPublic" style={{ cursor: 'pointer', margin: 0 }}>Make this entry public</label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary btn-block">{editingId ? 'Update Entry' : 'Save Entry'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
