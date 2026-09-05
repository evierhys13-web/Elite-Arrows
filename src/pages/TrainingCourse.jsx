import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import Breadcrumbs from '../components/Breadcrumbs'
import { getCourse } from '../training/courses'
import { getCoach } from '../training/coaches'
import { getTrainingProgress } from '../training/progress'

export default function TrainingCourse() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const course = getCourse(courseId)

  if (!course) {
    return <div className="page"><p>Course not found. <Link to="/training">Back to Academy</Link></p></div>
  }

  const progress = getTrainingProgress(user?.id)
  const doneCount = course.lessons.filter(l => progress.completedLessons.includes(l.id)).length

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Darts Academy', path: '/training' }, { label: course.title }]} />

      <div className="card glass" style={{ padding: '28px', marginBottom: '24px', borderLeft: `4px solid ${course.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '2.6rem' }}>{course.icon}</div>
          <span style={{ fontSize: '0.72rem', fontWeight: 900, padding: '4px 12px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{course.level}</span>
        </div>
        <h1 className="page-title" style={{ margin: '12px 0 8px' }}>{course.title}</h1>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '16px' }}>{course.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{doneCount}/{course.lessons.length} lessons complete</span>
          <span style={{ fontSize: '0.8rem' }}>
            <strong style={{ color: course.color }}>{ course.lessons.reduce((a, l) => a + (l.minutes || 0), 0) } min total</strong>
          </span>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', marginTop: '14px' }}>
          <div style={{ width: `${course.lessons.length ? (doneCount / course.lessons.length) * 100 : 0}%`, height: '100%', background: course.color, borderRadius: '99px', transition: 'width 0.4s' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {course.lessons.map((lesson, i) => {
          const coach = getCoach(lesson.coachId)
          const isDone = progress.completedLessons.includes(lesson.id)
          return (
            <div key={lesson.id} className="card glass glass-hover" style={{ padding: '18px 20px', cursor: 'pointer', border: isDone ? '1px solid rgba(34,197,94,0.35)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }} onClick={() => navigate(`/training/lesson/${lesson.id}`)}>
              <div style={{ minWidth: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.05rem', background: isDone ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', color: isDone ? 'var(--success)' : 'var(--text-muted)' }}>
                {isDone ? '✓' : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{lesson.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {lesson.minutes} min • <span style={{ color: coach.accent }}>{coach.name}</span> • Verified
                </div>
              </div>
              <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>›</span>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: '28px', textAlign: 'center' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/training')}>← Back to Academy</button>
      </div>
    </div>
  )
}