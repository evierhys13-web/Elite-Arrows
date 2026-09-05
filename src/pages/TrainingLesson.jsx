import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContextInternal'
import Breadcrumbs from '../components/Breadcrumbs'
import { getLesson } from '../training/courses'
import { getCoach } from '../training/coaches'
import { getTrainingProgress, toggleLessonDone } from '../training/progress'

export default function TrainingLesson() {
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const lesson = getLesson(lessonId)

  if (!lesson) {
    return <div className="page"><p>Lesson not found. <Link to="/training">Back to Academy</Link></p></div>
  }

  const coach = getCoach(lesson.coachId)
  const progress = getTrainingProgress(user?.id)
  const isDone = progress.completedLessons.includes(lesson.id)
  const lessonIndex = lesson.course.lessons.findIndex(l => l.id === lesson.id) + 1
  const totalLessons = lesson.course.lessons.length

  const markDone = () => {
    toggleLessonDone(user?.id, lesson.id)
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/home' }, { label: 'Darts Academy', path: '/training' }, { label: lesson.course.title, path: `/training/course/${lesson.course.id}` }, { label: lesson.title }]} />

      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Link to={`/training/course/${lesson.course.id}`} style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>← {lesson.course.title}</Link>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lesson {lessonIndex} of {totalLessons}</span>
      </div>

      <h1 className="page-title" style={{ fontSize: '1.9rem', marginBottom: '6px' }}>{lesson.title}</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.6' }}>{lesson.summary}</p>

      {/* Coach + verification bar */}
      <div className="card glass" style={{ padding: '14px 18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', borderLeft: `3px solid ${coach.accent}` }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Lesson by</div>
          <div style={{ fontWeight: 900, color: coach.accent }}>{coach.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{coach.role}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--success)', fontWeight: 800 }}>✓ Verified source</span>
          <span>{lesson.sources.join(' • ')}</span>
          <span style={{ fontSize: '0.68rem' }}>{lesson.minutes} min read</span>
        </div>
      </div>

      {/* Lesson content */}
      {lesson.sections.map(section => (
        <div key={section.heading} style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)', marginBottom: '10px' }}>{section.heading}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={i} style={{ color: 'var(--text-secondary)', lineHeight: '1.75', marginBottom: '12px' }}>{p}</p>
          ))}
        </div>
      ))}

      {/* Key points */}
      <div className="card glass" style={{ padding: '20px', margin: '28px 0', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)' }}>
        <h3 style={{ color: 'var(--success)', marginBottom: '12px', fontSize: '1rem' }}>Key Takeaways</h3>
        <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          {lesson.keyPoints.map((k, i) => <li key={i} style={{ fontSize: '0.92rem' }}>{k}</li>)}
        </ul>
      </div>

      {/* Complete button */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '32px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${isDone ? 'btn-secondary' : 'btn-primary'}`}
          style={{ minWidth: '220px' }}
          onClick={markDone}
        >
          {isDone ? '✓ Completed — tap to undo' : 'Mark Lesson Complete'}
        </button>
        {lessonIndex < totalLessons && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              toggleLessonDone(user?.id, lesson.id)
              const next = lesson.course.lessons[lessonIndex]
              if (next) navigate(`/training/lesson/${next.id}`)
            }}
          >
            Mark done & continue
          </button>
        )}
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', paddingBottom: '24px' }}>
        Content verified against published coaching material and reviewed by the Elite Arrows Academy team.
      </div>
    </div>
  )
}