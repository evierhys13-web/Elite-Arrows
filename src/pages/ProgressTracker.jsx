import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Breadcrumbs from '../components/Breadcrumbs'
import { saveProgressLog, fetchProgressLogs, deleteProgressLog } from '../utils/progressService'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

export default function ProgressTracker() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState('avg3')

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Daily',
    avg3: '',
    avg9: '',
    checkoutRate: '',
    highestCheckout: '',
    count180: '',
    isPublic: false
  })

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

  const handleSubmit = async (e) => {
    e.preventDefault()

    const logData = {
      ...formData,
      avg3: parseFloat(formData.avg3) || 0,
      avg9: parseFloat(formData.avg9) || 0,
      checkoutRate: parseFloat(formData.checkoutRate) || 0,
      highestCheckout: parseInt(formData.highestCheckout) || 0,
      count180: parseInt(formData.count180) || 0
    }

    const success = await saveProgressLog(user.id, logData)
    if (success) {
      showToast('Progress entry saved!', 'success')
      setShowModal(false)
      loadLogs()
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        type: 'Daily',
        avg3: '',
        avg9: '',
        checkoutRate: '',
        highestCheckout: '',
        count180: '',
        isPublic: false
      })
    } else {
      showToast('Failed to save entry', 'error')
    }
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
    { id: 'avg3', label: '3-Dart Avg', color: 'var(--accent-cyan)' },
    { id: 'avg9', label: '9-Dart Avg', color: '#fbbf24' },
    { id: 'checkoutRate', label: 'Checkout %', color: '#22c55e' },
    { id: 'highestCheckout', label: 'Highest CO', color: '#f87171' },
    { id: 'count180', label: '180s', color: '#818cf8' }
  ]

  return (
    <div className="page animate-fade-in">
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Progress Tracker' }]} />

      <div className="page-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title text-gradient">Progress Tracker</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track and visualize your personal darting journey.</p>
        </div>
        <button className="btn btn-primary glass" onClick={() => setShowModal(true)}>
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
                className={`btn btn-sm ${selectedMetric === m.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedMetric(m.id)}
                style={{ borderRadius: '99px', whiteSpace: 'nowrap' }}
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
              No data available. Add your first entry to see the graph!
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
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{log.avg3}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{log.checkoutRate}%</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{log.highestCheckout}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{log.count180}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button
                      className="btn btn-sm btn-danger glass"
                      onClick={() => handleDelete(log.id)}
                      style={{ padding: '4px 8px' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
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
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="text-gradient" style={{ margin: 0 }}>Add Progress Entry</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Date</label>
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
                <button type="submit" className="btn btn-primary btn-block">Save Entry</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
