import { useEffect, useRef, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { db, doc, setDoc, storage, ref, uploadString, uploadBytes, uploadBytesResumable, getDownloadURL, collection, getDocs } from '../firebase'
import { useToast } from '../context/ToastContext'
import { logResultSubmitted } from '../utils/analytics'
import UserSearchSelect from '../components/UserSearchSelect'

const INITIAL_RESULT_FORM = {
  gameType: 'Friendly',
  opponent: '',
  yourScore: '',
  opponentScore: '',
  bestOf: '3',
  firstTo: '3',
  your180s: '',
  opponent180s: '',
  yourHighestCheckout: '',
  opponentHighestCheckout: '',
  yourDoubleSuccess: '',
  opponentDoubleSuccess: '',
  proofImage: '',
  proofImageBlob: null,
  proofImage2: '',
  proofImageBlob2: null,
  proofVideo: '',
  proofVideoFile: null,
  highlightUrl: '',
  isHighlight: false,
  highlightTitle: '',
  season: '',
  partner: '',
  opponent2: '',
  yourScore2: '',
  opponentScore2: '',
  yourDuoId: '',
  yourAvg: '',
  opponentAvg: ''
}

export default function SubmitResult() {
  const { user, getAllUsers, getFixtures, getResults, getCups, updateResults, updateFixtures, addTokens, triggerDataRefresh, notifyAdmins, adminData, getSeasons, searchUsers } = useAuth()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const cameraInputRef = useRef(null)
  const uploadInputRef = useRef(null)
  const [formData, setFormData] = useState(INITIAL_RESULT_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submittedFixtureId, setSubmittedFixtureId] = useState(null)
  const [openLeagueDuos, setOpenLeagueDuos] = useState([])

  // Background upload states
  const [isUploadingProof, setIsUploadingProof] = useState(false)
  const [proofUrl, setUploadedProofUrl] = useState('')
  const [proofVideoUrl, setUploadedVideoUrl] = useState('')
  const [uploadError, setUploadError] = useState('')
  const currentUploadTaskId = useRef(null)

  const fixtureIdParam = searchParams.get('fixtureId')
  const opponentParam = searchParams.get('opponent')
  const gameTypeParam = searchParams.get('gameType')
  const seasonParam = searchParams.get('season')

  const allUsers = getAllUsers()
  const allFixtures = getFixtures()
  const allResults = getResults()
  const seasons = getSeasons()

  const isLocked = new Date() < new Date("2026-07-01T00:00:00")
  const isAdmin = user?.isAdmin || user?.isTournamentAdmin || user?.isCupAdmin
  const isOpenLeague = formData.gameType === 'Open League Singles' || formData.gameType === 'Open League Doubles'

  // Robust season detection
  const getDefaultSeason = () => {
    return formData.season || searchParams.get('season') || adminData?.currentSeason || 'Season 1'
  }

  const currentSeasonLabel = getDefaultSeason()
  const targetSeasonDoc = seasons.find(s => s.name === currentSeasonLabel)

  const playersWithDivisions = useMemo(() => {
    if (!allUsers) return []
    const staged = targetSeasonDoc?.stagedDivisions || {}
    return allUsers.map(u => {
      const uid = String(u.id)
      const sDiv = staged[uid] || staged[u.id]
      return {
        ...u,
        effectiveDiv: sDiv || u.division || 'Unassigned'
      }
    })
  }, [allUsers, targetSeasonDoc])

  const userEffectiveDiv = useMemo(() => {
    if (!user) return 'Unassigned'
    return playersWithDivisions.find(u => String(u.id) === String(user.id))?.effectiveDiv || 'Unassigned'
  }, [playersWithDivisions, user])

  const availablePlayers = useMemo(() => {
    if (!user) return []
    return playersWithDivisions.filter(u => String(u.id) !== String(user.id))
  }, [playersWithDivisions, user])

  const opponentOptions = useMemo(() => {
    if (!user) return []
    return formData.gameType === 'League'
      ? availablePlayers.filter(u => u.effectiveDiv === userEffectiveDiv)
      : formData.gameType === 'Champions League'
        ? availablePlayers.filter(u => u.superLeagueDivision === 'Champions')
        : availablePlayers
  }, [availablePlayers, formData.gameType, userEffectiveDiv])

  const effectiveDivision = useMemo(() => {
    if (!user) return 'Unassigned'
    return formData.gameType === 'Champions League'
      ? 'Champions'
      : userEffectiveDiv
  }, [formData.gameType, userEffectiveDiv, user])

  useEffect(() => {
    const fetchDuos = async () => {
      try {
        const snap = await getDocs(collection(db, 'openLeagueDuos'))
        setOpenLeagueDuos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (e) {
        console.error("Failed to fetch duos", e)
      }
    }
    fetchDuos()
  }, [])

  useEffect(() => {
    if (!formData.season && adminData?.currentSeason) {
      setFormData(prev => ({ ...prev, season: adminData.currentSeason }))
    }
  }, [adminData?.currentSeason])

  const userSubmittedResults = allResults
    .filter(result => (
      String(result.submittedBy || '') === String(user.id) ||
      String(result.player1Id || '') === String(user.id) ||
      String(result.player2Id || '') === String(user.id)
    ))
    .filter(result => ['pending', 'approved', 'rejected'].includes(String(result.status || '').toLowerCase()))
    .sort((a, b) => new Date(b.submittedAt || b.updatedAt || b.approvedAt || b.date || 0) - new Date(a.submittedAt || a.updatedAt || a.approvedAt || a.date || 0))
    .slice(0, 5)

  const getFixturePlayerIds = (fixture) => {
    const player1Id = fixture.player1Id || fixture.player1
    const player2Id = fixture.player2Id || fixture.player2
    return { player1Id, player2Id }
  }

  const getFixtureOpponentId = (fixture) => {
    const { player1Id, player2Id } = getFixturePlayerIds(fixture)
    if (String(player1Id) === String(user.id)) return player2Id
    if (String(player2Id) === String(user.id)) return player1Id
    return null
  }

  const cupFixtures = useMemo(() => {
    if (!getCups || typeof getCups !== 'function') return []
    const cupsData = getCups()
    if (!Array.isArray(cupsData)) return []

    return allFixtures.filter((fixture) => {
      if (!fixture.cupId) return false
      const status = String(fixture.status).toLowerCase()
      if (['approved', 'result_submitted', 'completed'].includes(status)) return false

      // Only show fixtures for cups that actually exist
      const cupExists = cupsData.some(c => String(c.id) === String(fixture.cupId))
      if (!cupExists) return false

      const { player1Id, player2Id } = getFixturePlayerIds(fixture)
      if (isAdmin) return true
      return String(player1Id) === String(user.id) || String(player2Id) === String(user.id)
    })
  }, [allFixtures, getCups, user.id, isAdmin])

  const getDisplayName = (profile, fallback = 'Unknown player') => (
    profile?.username || profile?.name || profile?.displayName || profile?.email || fallback
  )

  const currentUserName = getDisplayName(user, 'You')

  const selectedFixture = fixtureIdParam && String(fixtureIdParam) !== String(submittedFixtureId)
    ? allFixtures.find((fixture) => String(fixture.id) === String(fixtureIdParam))
    : null

  const isFixtureResultSent = selectedFixture && (
    allResults.some(r => String(r.fixtureId || '') === String(selectedFixture.id) && String(r.status).toLowerCase() !== 'rejected')
  )

  useEffect(() => {
    if (isFixtureResultSent) {
      setError('A result has already been submitted for this fixture.')
    }
  }, [isFixtureResultSent])

  useEffect(() => {
    if (selectedFixture) {
      if (selectedFixture.cupId) {
        // For Cup matches, the "opponent" field stores the FIXTURE ID
        setFormData((prev) => ({
          ...prev,
          gameType: 'Cup',
          opponent: String(selectedFixture.id),
          bestOf: selectedFixture.bestOf ? selectedFixture.bestOf.toString() : prev.bestOf,
          firstTo: selectedFixture.firstTo ? selectedFixture.firstTo.toString() : prev.firstTo,
          yourAvg: '',
          opponentAvg: ''
        }))
      } else {
        const opponentId = getFixtureOpponentId(selectedFixture)
        setFormData((prev) => ({
          ...prev,
          gameType: selectedFixture.gameType || 'Friendly',
          opponent: opponentId || '',
          bestOf: selectedFixture.bestOf ? selectedFixture.bestOf.toString() : prev.bestOf,
          firstTo: selectedFixture.firstTo ? selectedFixture.firstTo.toString() : prev.firstTo
        }))
      }
    } else if (opponentParam || gameTypeParam) {
      setFormData(prev => ({
        ...prev,
        opponent: opponentParam || prev.opponent,
        gameType: gameTypeParam || prev.gameType,
        bestOf: gameTypeParam === 'League' ? '8' : prev.bestOf,
        firstTo: gameTypeParam === 'League' ? '5' : prev.firstTo
      }))
    }
  }, [selectedFixture, opponentParam, gameTypeParam, user.id])

  const checkExistingLeagueMatch = (opponentId) => {
    const existingMatches = allResults.filter(r => {
      const isSameSeason = r.season === currentSeasonLabel
      const isLeagueGame = r.gameType === 'League'
      const sameDivision = r.division === effectiveDivision
      const isBetweenPlayers = (String(r.player1Id) === String(user.id) && String(r.player2Id) === String(opponentId)) ||
                                 (String(r.player2Id) === String(user.id) && String(r.player1Id) === String(opponentId))
      const isNotRejected = String(r.status).toLowerCase() !== 'rejected'
      return isSameSeason && isLeagueGame && sameDivision && isBetweenPlayers && isNotRejected
    })
    
    return existingMatches.length > 0 ? existingMatches[0] : null
  }

  const userDuos = useMemo(() => {
    if (!user) return []
    return openLeagueDuos.filter(d =>
      String(d.p1Id) === String(user.id) ||
      String(d.p2Id) === String(user.id)
    )
  }, [openLeagueDuos, user])

  const detectedUserDuo = userDuos.length > 0 ? userDuos[0] : null

  useEffect(() => {
    if (formData.gameType === 'Open League Doubles' && !formData.yourDuoId) {
      if (detectedUserDuo) {
        setFormData(prev => ({ ...prev, yourDuoId: detectedUserDuo.id }))
      }
    }
  }, [formData.gameType, detectedUserDuo])

  const getDuoDisplayName = (duo) => {
    if (!duo) return 'Unknown Duo'
    const u1 = allUsers.find(u => String(u.id) === String(duo.p1Id))
    const u2 = allUsers.find(u => String(u.id) === String(duo.p2Id))

    const playersStr = (u1 && u2) ? `(${u1.username} & ${u2.username})` : ''

    if (duo.teamName) return `${duo.teamName} ${playersStr}`

    if (duo.captainId) {
      const cap = allUsers.find(u => String(u.id) === String(duo.captainId))
      if (cap) return `${cap.username}'s Team ${playersStr}`
    }

    return u1 && u2 ? `${u1.username} & ${u2.username}` : `Unnamed Team (${duo.id})`
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setSubmitted(false)
    setSuccessMessage('')
    if (name === 'opponent' || name === 'gameType') {
      setError('')
    }
    if (name === 'gameType') {
      if (value === 'League') {
        setFormData(prev => ({
          ...prev,
          opponent: availablePlayers.find(p => p.id === prev.opponent)?.division === user.division ? prev.opponent : '',
          bestOf: '8',
          firstTo: '5'
        }))
      } else if (value === 'Champions League') {
        setFormData(prev => ({
          ...prev,
          opponent: availablePlayers.find(p => p.id === prev.opponent)?.superLeagueDivision === user.superLeagueDivision ? prev.opponent : '',
          bestOf: '11',
          firstTo: '6'
        }))
      } else if (value === 'Open League Singles' || value === 'Open League Doubles') {
        setFormData(prev => ({
          ...prev,
          bestOf: '9',
          firstTo: '5'
        }))
      } else if (value === 'Cup') {
        setFormData(prev => ({ ...prev, opponent: '', bestOf: '3', firstTo: '2' }))
      } else if (value === 'Playoff') {
        setFormData(prev => ({ ...prev, bestOf: '3', firstTo: '2' }))
      } else {
        setFormData(prev => ({ ...prev, bestOf: '3', firstTo: '2' }))
      }
    }
  }

  const handleImageUpload = (e, index = 1) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image is too large. Please pick a smaller one.')
        return
      }

      setUploadError('')
      if (index === 1) {
        setUploadedProofUrl('')
        setUploadedVideoUrl('')
      }
      setUploadProgress(0)

      // 1. Instant local preview
      const reader = new FileReader()
      reader.onloadend = () => {
        const image = new Image()
        image.onload = async () => {
          const canvas = document.createElement('canvas')
          const maxDimension = 800 // Optimized for Firestore storage
          const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
          canvas.width = Math.max(1, Math.round(image.width * scale))
          canvas.height = Math.max(1, Math.round(image.height * scale))

          const ctx = canvas.getContext('2d')
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

          let quality = 0.50
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality)

          // Ensure it's under 400KB to safely fit in Firestore 1MB document
          while (compressedDataUrl.length > 400000 && quality > 0.15) {
            quality -= 0.1
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
          }

          const fieldName = index === 1 ? 'proofImage' : 'proofImage2'
          const blobName = index === 1 ? 'proofImageBlob' : 'proofImageBlob2'

          setFormData(prev => ({
            ...prev,
            [fieldName]: compressedDataUrl,
            [blobName]: null,
            ...(index === 1 ? { proofVideo: '', proofVideoFile: null } : {})
          }))

          setIsUploadingProof(false) // No more background upload for images
          setSuccessMessage(index === 1 ? 'Image 1 ready!' : 'Image 2 ready!')
        }
        image.src = reader.result
      }
      reader.readAsDataURL(file)
    }
  }

  const handleVideoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setError('Video must be less than 20MB.')
        return
      }

      setUploadError('')
      setUploadedProofUrl('')
      setUploadedVideoUrl('')
      setIsUploadingProof(true)
      setUploadProgress(1)

      const videoUrl = URL.createObjectURL(file)
      setFormData(prev => ({
        ...prev,
        proofVideo: videoUrl,
        proofVideoFile: file,
        proofImage: '',
        proofImageBlob: null
      }))

      const resultId = Date.now().toString()
      const storageRef = ref(storage, `results/${resultId}_video.mp4`)
      currentUploadTaskId.current = resultId

      const uploadTask = uploadBytesResumable(storageRef, file)
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(Math.max(1, Math.round(progress)))
        },
        (err) => {
          setUploadError("Video upload failed.")
          setIsUploadingProof(false)
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref)
          setUploadedVideoUrl(url)
          setIsUploadingProof(false)
        }
      )
    }
  }

  const clearProofInputs = () => {
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }

  const removeVideo = () => {
    if (formData.proofVideo && formData.proofVideo.startsWith('blob:')) {
      URL.revokeObjectURL(formData.proofVideo)
    }
    setFormData(prev => ({ ...prev, proofVideo: '', proofVideoFile: null }))
    setUploadedVideoUrl('')
    setUploadProgress(0)
    setIsUploadingProof(false)
    clearProofInputs()
  }

  const removeImage = (index = 1) => {
    const fieldName = index === 1 ? 'proofImage' : 'proofImage2'
    const blobName = index === 1 ? 'proofImageBlob' : 'proofImageBlob2'
    setFormData(prev => ({ ...prev, [fieldName]: '', [blobName]: null }))
    if (index === 1) {
      setUploadedProofUrl('')
      setIsUploadingProof(false)
    }
    clearProofInputs()
  }

  const resetFormAfterSuccessfulSubmit = (fixtureId = null) => {
    if (fixtureId) {
      setSubmittedFixtureId(String(fixtureId))
    }
    setFormData({
      ...INITIAL_RESULT_FORM,
      season: adminData?.currentSeason || 'Season 1'
    })
    clearProofInputs()
    if (typeof window !== 'undefined' && window.location.pathname.includes('submit-result')) {
      window.history.replaceState(null, '', '/submit-result')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    
    if (isOpenLeague && isLocked && !isAdmin) {
      setError('Open League matches cannot be submitted until 1st July 2026.')
      return
    }

    if (!formData.opponent) {
      setError('Please select an opponent')
      return
    }
    
    if (!formData.yourScore || !formData.opponentScore) {
      setError('Please enter both scores')
      return
    }

    if (formData.gameType === 'Cup') {
      if (!formData.yourAvg || !formData.opponentAvg) {
        setError('3-dart average is required for Cup matches.')
        return
      }
    }

    if (formData.gameType === 'Open League Doubles') {
      if (!formData.yourDuoId) {
        setError('Please select your duo.')
        return
      }
      if (!formData.opponent) {
        setError('Please select the opposing duo.')
        return
      }
      if (!formData.proofImage || !formData.proofImage2) {
        setError('Two pieces of proof are required for Open League Doubles.')
        return
      }
    } else if (!formData.proofImage && !formData.proofVideo) {
      setError('Proof of result (screenshot, photo, or video) is required for all match submissions.')
      return
    }
    
    const opponentDuo = formData.gameType === 'Open League Doubles' ? openLeagueDuos.find(d => d.id === formData.opponent) : null

    // Find Your Duo using the dropdown selection
    const yourDuo = formData.gameType === 'Open League Doubles' ? openLeagueDuos.find(d => d.id === formData.yourDuoId) : null

    const opponentUser = !opponentDuo ? playersWithDivisions.find(u => String(u.id) === String(formData.opponent)) : null

    const submitterName = getDisplayName(user, 'You')
    const opponentName = opponentDuo ? getDuoDisplayName(opponentDuo) : getDisplayName(opponentUser, formData.opponent || 'Selected opponent')
    
    if (formData.gameType === 'League' && opponentUser) {
      if (opponentUser.effectiveDiv !== userEffectiveDiv) {
        setError('League results can only be submitted against players in your division.')
        return
      }

      const existingMatch = checkExistingLeagueMatch(opponentUser.id)
      if (existingMatch) {
        setError(`You've already played ${opponentName} in a league match this season. Only one league match per opponent is allowed.`)
        return
      }
    }

    if (formData.gameType === 'League' && (formData.bestOf !== '8' || formData.firstTo !== '5')) {
      setError('League games must be Best of 8 (First to 5 legs)')
      return
    }

    if (formData.gameType === 'Champions League') {
      if (formData.bestOf !== '11' || formData.firstTo !== '6') {
        setError('Champions League games must be First to 6 legs (Best of 11)')
        return
      }
      if (parseInt(formData.yourScore) === parseInt(formData.opponentScore)) {
        setError('Draws are not permitted in the Champions League. A winner must be decided.')
        return
      }
    }

    let cupFixture = null
    let cupId = null
    let matchId = null
    if (formData.gameType === 'Cup') {
      // Find the fixture either by the specific ID (new dropdown mode) or by opponent search (fallback)
      cupFixture = allFixtures.find(f => String(f.id) === String(formData.opponent)) ||
                   cupFixtures.find(f => getFixtureOpponentId(f) === formData.opponent)

      if (!cupFixture) {
        setError('Please select a valid cup match')
        return
      }
      if (cupFixture) {
        cupId = cupFixture.cupId
        matchId = cupFixture.matchId
      }
    }

    const matchingResults = allResults.filter((result) => {
      if (formData.gameType === 'Cup' && cupId && matchId) {
        return result.cupId === cupId && result.matchId === matchId && String(result.status).toLowerCase() !== 'rejected'
      }

      if (selectedFixture?.id) {
        return String(result.fixtureId || '') === String(selectedFixture.id) && String(result.status).toLowerCase() !== 'rejected'
      }

      if (formData.gameType === 'Open League Doubles') {
        const yourDuoIds = String(formData.yourDuoId)
        const opponentDuoIds = String(formData.opponent)
        return (String(result.player1Id) === String(yourDuoIds.split('_')[0]) && String(result.player3Id) === String(opponentDuoIds.split('_')[0])) ||
               (String(result.player3Id) === String(yourDuoIds.split('_')[0]) && String(result.player1Id) === String(opponentDuoIds.split('_')[0]))
      }

      const isSameSeason = result.season === currentSeasonLabel
      const isSameType = result.gameType === formData.gameType
      const isBetweenPlayers = (String(result.player1Id) === String(user.id) && String(result.player2Id) === String(formData.opponent)) ||
                                 (String(result.player2Id) === String(user.id) && String(result.player1Id) === String(formData.opponent))
      const isNotRejected = String(result.status).toLowerCase() !== 'rejected'
      return isSameSeason && isSameType && isBetweenPlayers && isNotRejected
    })

    if (formData.gameType === 'Champions League') {
      if (matchingResults.length >= 2) {
        setError(`You've already played ${opponentName} 2 times in the Champions League this season. No more matches allowed.`)
        return
      }
    } else if (formData.gameType === 'League' && matchingResults.length >= 1) {
       setError(`A ${formData.gameType} result for this matchup has already been submitted and is currently ${matchingResults[0].status}.`)
       return
    }

    try {
      setIsSubmitting(true)

      const opponentDuo = formData.gameType === 'Open League Doubles' ? openLeagueDuos.find(d => d.id === formData.opponent) : null

      // Find Your Duo using the dropdown selection
      const yourDuo = formData.gameType === 'Open League Doubles' ? openLeagueDuos.find(d => d.id === formData.yourDuoId) : null

      const opponentUser = !opponentDuo ? allUsers.find(u => u.id === formData.opponent) : null

      const submitterName = getDisplayName(user, 'You')
      const opponentName = opponentDuo ? getDuoDisplayName(opponentDuo) : getDisplayName(opponentUser, formData.opponent || 'Selected opponent')

      const fixtureForResult = cupFixture || selectedFixture

      // Determine correct player names/IDs for Cup matches (especially if admin is submitting)
      let finalPlayer1Name = submitterName
      let finalPlayer1Id = user.id
      let finalPlayer2Name = opponentName
      let finalPlayer2Id = opponentUser?.id || formData.opponent

      if (formData.gameType === 'Cup' && fixtureForResult) {
          const p1Id = fixtureForResult.player1Id || fixtureForResult.player1
          const p2Id = fixtureForResult.player2Id || fixtureForResult.player2
          const p1 = allUsers.find(u => String(u.id) === String(p1Id))
          const p2 = allUsers.find(u => String(u.id) === String(p2Id))

          finalPlayer1Id = p1Id
          finalPlayer1Name = getDisplayName(p1, 'Player 1')
          finalPlayer2Id = p2Id
          finalPlayer2Name = getDisplayName(p2, 'Player 2')
      }

      // Helper for creating the document structure
      const createResultDoc = (s1, s2, idSuffix = '', proofOverride = null) => {
        const resId = resultId + idSuffix
        const docData = {
          id: resId,
          firestoreId: resId,
          player1: finalPlayer1Name,
          player1Id: finalPlayer1Id,
          player2: finalPlayer2Name,
          player2Id: finalPlayer2Id,
          score1: parseInt(s1),
          score2: parseInt(s2),
          division: effectiveDivision,
          gameType: formData.gameType,
          season: formData.season || adminData?.currentSeason || 'Season 1',
          date: new Date().toISOString().split('T')[0],
          submittedAt: new Date().toISOString(),
          bestOf: formData.bestOf,
          firstTo: formData.firstTo,
          player1Stats: {
            '180s': parseInt(formData.your180s) || 0,
            highestCheckout: parseInt(formData.yourHighestCheckout) || 0,
            doubleSuccess: parseFloat(formData.yourDoubleSuccess) || 0,
            avg: parseFloat(formData.yourAvg) || 0
          },
          player2Stats: {
            '180s': parseInt(formData.opponent180s) || 0,
            highestCheckout: parseInt(formData.opponentHighestCheckout) || 0,
            doubleSuccess: parseFloat(formData.opponentDoubleSuccess) || 0,
            avg: parseFloat(formData.opponentAvg) || 0
          },
          status: 'pending',
          submittedBy: user.id,
          proofImage: proofOverride || finalProofUrl || '',
          proofImage2: formData.proofImage2 || '',
          proofVideo: finalVideoUrl || '',
          ...(fixtureForResult?.id && { fixtureId: fixtureForResult.id }),
          ...(cupId && { cupId, matchId }),
          ...(cupFixture?.cupName && { cupName: cupFixture.cupName }),
          ...(cupFixture?.startScore && { startScore: cupFixture.startScore })
        }

        if (formData.gameType === 'Open League Doubles') {
          const duo1 = yourDuo
          const duo2 = opponentDuo

          const p1 = allUsers.find(u => String(u.id) === String(duo1?.p1Id))
          const p2 = allUsers.find(u => String(u.id) === String(duo1?.p2Id))
          const p3 = allUsers.find(u => String(u.id) === String(duo2?.p1Id))
          const p4 = allUsers.find(u => String(u.id) === String(duo2?.p2Id))

          docData.player1 = getDuoDisplayName(duo1)
          docData.player2 = getDuoDisplayName(duo2)

          docData.player1Id = p1?.id || duo1?.p1Id
          docData.player2Id = p2?.id || duo1?.p2Id
          docData.player3Id = p3?.id || duo2?.p1Id
          docData.player3 = getDisplayName(p3, 'Opponent 3')
          docData.player4Id = p4?.id || duo2?.p2Id
          docData.player4 = getDisplayName(p4, 'Opponent 4')
        }

        return docData
      }

      // Use either the Storage URL (for videos) or the Base64 data (for images)
      // Images are now saved directly in Firestore for immediate submission.
      let finalProofUrl = proofUrl || formData.proofImage
      let finalVideoUrl = proofVideoUrl

      // Videos are too large for Firestore, so we MUST wait for them specifically
      if (!finalProofUrl && formData.proofVideoFile && !finalVideoUrl) {
        setSuccessMessage('Finishing video upload...')
        let videoWait = 0
        const videoCheck = async () => {
          return new Promise((resolve) => {
            const interval = setInterval(() => {
              videoWait++
              if (proofVideoUrl || videoWait > 40) { // 20s
                clearInterval(interval)
                resolve()
              }
            }, 500)
          })
        }
        await videoCheck()
        finalVideoUrl = proofVideoUrl
        if (!finalVideoUrl) {
          throw new Error("Video upload is taking too long. Use a photo for an instant submission.")
        }
      }

      if (!finalProofUrl && !finalVideoUrl) {
        throw new Error("Match proof is required. Please select a photo or video.")
      }

      setSuccessMessage('Saving match results...')

      const resultId = Date.now().toString()
      const currentResults = [...allResults]

      let finalResultObj;
      if (formData.gameType === 'Open League Doubles') {
        finalResultObj = createResultDoc(formData.yourScore, formData.opponentScore)
        await setDoc(doc(db, 'results', finalResultObj.id), finalResultObj)
        currentResults.push(finalResultObj)
      } else {
        finalResultObj = createResultDoc(formData.yourScore, formData.opponentScore)
        await setDoc(doc(db, 'results', finalResultObj.id), finalResultObj)
        currentResults.push(finalResultObj)
      }

      setSuccessMessage('Done!')

      // Background updates
      if (formData.isHighlight || finalVideoUrl || formData.highlightUrl) {
        const highlightId = `hl_${resultId}`
        setDoc(doc(db, 'highlights', highlightId), {
          id: highlightId,
          userId: user.id,
          username: submitterName,
          title: formData.highlightTitle || `${formData.gameType} Highlight vs ${opponentName}`,
          videoUrl: finalVideoUrl || formData.highlightUrl || '',
          imageUrl: finalProofUrl || '',
          resultId: resultId,
          likes: 0,
          createdAt: new Date().toISOString(),
          type: formData.your180s > 0 ? '180' : 'High Checkout'
        }).catch(() => {})
      }

      try {
        updateResults(currentResults)
      } catch (e) {}

      const fixtureToUpdate = cupFixture || selectedFixture
      if (fixtureToUpdate) {
        const updatedFixtures = [...getFixtures()]
        const fixtureIndex = updatedFixtures.findIndex((fixture) => String(fixture.id) === String(fixtureToUpdate.id))
        if (fixtureIndex !== -1) {
          updatedFixtures[fixtureIndex] = {
            ...updatedFixtures[fixtureIndex],
            status: 'result_submitted',
            resultId,
            updatedAt: new Date().toISOString()
          }
          updateFixtures(updatedFixtures)
          setDoc(doc(db, 'fixtures', updatedFixtures[fixtureIndex].id.toString()), updatedFixtures[fixtureIndex], { merge: true }).catch(() => {})
        }
      }

      if (typeof triggerDataRefresh === 'function') {
        triggerDataRefresh('results')
        triggerDataRefresh('fixtures')
      }

      logResultSubmitted(formData.gameType, user.division)
      setSubmitted(true)
      setError('')
      resetFormAfterSuccessfulSubmit(fixtureToUpdate?.id)
      showToast?.('Result submitted!', 'success')

      setTimeout(() => {
        if (window.history.length > 1) navigate(-1)
        else navigate('/home')
      }, 1000)

      notifyAdmins(
        'New Result Pending',
        `${submitterName} submitted a result: ${finalResultObj.player1} ${finalResultObj.score1}-${finalResultObj.score2} ${finalResultObj.player2}`,
        { type: 'result_submitted', resultId: finalResultObj.id, url: '/admin?tab=results' }
      ).catch(() => {})

      if (parseInt(formData.yourScore) > parseInt(formData.opponentScore)) {
        addTokens(50).catch(() => {})
      }
    } catch (e) {
      console.error('FATAL: Error submitting result:', e)
      setError('Error submitting result: ' + (e.message || 'Please try again.'))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getOpponentStatus = (opponentId) => {
    if (formData.gameType === 'Friendly') return null
    const existingMatch = checkExistingLeagueMatch(opponentId)
    if (existingMatch) {
      return { played: true, result: existingMatch }
    }
    return { played: false }
  }

  const getResultStatusDisplay = (status) => {
    const normalized = String(status || 'pending').toLowerCase()
    if (normalized === 'approved') return { label: 'Approved', color: 'var(--success)' }
    if (normalized === 'rejected') return { label: 'Rejected', color: 'var(--error)' }
    return { label: 'Pending admin approval', color: 'var(--warning)' }
  }

  if (submitted) {
    return (
      <div className="page" style={{ maxWidth: '600px', margin: '100px auto', textAlign: 'center' }}>
        <div className="card glass animate-bounce-in" style={{ padding: '40px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>✅</div>
          <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '16px' }}>Result Submitted!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
            Your match result has been sent for admin approval.
            You will be redirected shortly...
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/home')}>Go to Home</button>
            <button className="btn btn-secondary" onClick={() => navigate('/table')}>View Standings</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', padding: '15px' }}>
      <div className="page-header" style={{ marginBottom: '25px', textAlign: 'center' }}>
        <h1 className="page-title" style={{ fontSize: '1.8rem', color: 'var(--accent-cyan)' }}>Submit Match Result</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Enter the details of your recent match for league or friendly play.</p>
      </div>

      <div className="card" style={{ padding: '25px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <form className="submit-result-form" onSubmit={handleSubmit} style={{ maxWidth: 'none' }}>
          <div className="form-group" style={{ marginBottom: '25px' }}>
            <label style={{ fontWeight: '600', marginBottom: '10px', display: 'block' }}>Match Type</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['Friendly', 'League', 'Champions League', 'Cup', 'Playoff', 'Open League Singles', 'Open League Doubles'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={`btn ${formData.gameType === type ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleChange({ target: { name: 'gameType', value: type } })}
                  style={{ flex: 1, minWidth: '120px' }}
                >
                  {type === 'Cup' ? 'Cup Match' : type}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '25px' }}>
            <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Season</label>
            <select
              name="season"
              value={formData.season}
              onChange={handleChange}
              className="glass"
              style={{ width: '100%', padding: '12px', borderRadius: '8px' }}
            >
              {seasons.map(s => <option key={s.id} value={s.name}>{s.name} {s.isArchived ? '(Archived)' : s.name === adminData?.currentSeason ? '(Active)' : ''}</option>)}
              {!seasons.find(s => s.name === 'Season 1') && <option value="Season 1">Season 1</option>}
            </select>
          </div>

          {error && (
            <div style={{ 
              padding: '12px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#ef4444',
              marginBottom: '20px',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div style={{
              padding: '12px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid var(--success)',
              borderRadius: '8px',
              color: 'var(--success)',
              marginBottom: '20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              textAlign: 'center'
            }}>
              {successMessage}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '30px',
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border)'
          }} className="match-players-grid">
            <div style={{ textAlign: 'center' }}>
              <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                {formData.gameType === 'Open League Doubles' ? 'Home Team (Your Duo)' : 'You'}
              </label>
              <div style={{ display: 'grid', gap: '8px' }}>
                {formData.gameType === 'Open League Doubles' ? (
                  <select
                    name="yourDuoId"
                    value={formData.yourDuoId}
                    onChange={handleChange}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <option value="">Select Your Duo</option>
                    {userDuos.map(d => (
                      <option key={d.id} value={d.id}>{getDuoDisplayName(d)}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    border: '1px solid var(--border)',
                    color: 'var(--accent-cyan)'
                  }}>
                    {currentUserName}
                  </div>
                )}
              </div>
            </div>

            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>VS</div>

            <div style={{ textAlign: 'center' }}>
              <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                {formData.gameType === 'Cup' ? 'Select Match' : formData.gameType === 'Open League Doubles' ? 'Away Team (Opposing Duo)' : 'Opponent'}
              </label>
              <div style={{ display: 'grid', gap: '8px' }}>
                {formData.gameType === 'Cup' ? (
                  <select
                    name="opponent"
                    value={formData.opponent}
                    onChange={handleChange}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-primary)', border: '2px solid var(--accent-cyan)', color: 'var(--text)', fontWeight: 800 }}
                  >
                    <option value="">Choose your match...</option>
                    {cupFixtures.sort((a,b) => (a.cupName || '').localeCompare(b.cupName || '')).map(f => {
                      const cupsData = (typeof getCups === 'function') ? getCups() : []
                      const cup = Array.isArray(cupsData) ? cupsData.find(c => String(c.id) === String(f.cupId)) : null

                      const p1Id = f.player1Id || f.player1
                      const p2Id = f.player2Id || f.player2
                      const p1 = allUsers.find(u => String(u.id) === String(p1Id))
                      const p2 = allUsers.find(u => String(u.id) === String(p2Id))

                      const getRoundNameShort = (round) => {
                        if (round === 0) return 'Groups'
                        return `R${round}`
                      }

                      const label = `${cup?.name?.substring(0, 15) || 'Cup'} - ${getRoundNameShort(f.round)}: ${p1?.username || '?'} vs ${p2?.username || '?'}`

                      return (
                        <option key={f.id} value={f.id}>
                          {label}
                        </option>
                      )
                    })}
                  </select>
                ) : formData.gameType === 'Open League Doubles' ? (
                  <select
                    name="opponent"
                    value={formData.opponent}
                    onChange={handleChange}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <option value="">Select Away Duo</option>
                    {openLeagueDuos.filter(d => d.id !== formData.yourDuoId).map(d => (
                      <option key={d.id} value={d.id}>{getDuoDisplayName(d)}</option>
                    ))}
                  </select>
                ) : (
                  <UserSearchSelect
                    users={opponentOptions}
                    selectedId={formData.opponent}
                    onSelect={id => handleChange({ target: { name: 'opponent', value: id } })}
                    placeholder="Search by name or DartCounter..."
                    label=""
                    onQueryChange={searchUsers}
                  />
                )}
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div className="form-group">
              <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                {formData.gameType === 'Open League Doubles' ? 'Home Team Legs' : 'Your Legs Won'}
              </label>
              <input
                type="number"
                name="yourScore"
                value={formData.yourScore}
                onChange={handleChange}
                min="0"
                required
                style={{ fontSize: '1.2rem', textAlign: 'center', padding: '15px' }}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                {formData.gameType === 'Open League Doubles' ? 'Away Team Legs' : 'Opponent Legs Won'}
              </label>
              <input
                type="number"
                name="opponentScore"
                value={formData.opponentScore}
                onChange={handleChange}
                min="0"
                required
                style={{ fontSize: '1.2rem', textAlign: 'center', padding: '15px' }}
                placeholder="0"
              />
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '30px',
            padding: '20px',
            background: 'var(--bg-secondary)',
            borderRadius: '12px'
          }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem' }}>Best of (legs)</label>
              <select name="bestOf" value={formData.bestOf} onChange={handleChange} style={{ background: 'var(--bg-primary)' }}>
                <option value="1">Best of 1</option>
                <option value="3">Best of 3</option>
                <option value="5">Best of 5</option>
                <option value="7">Best of 7</option>
                <option value="8">Best of 8</option>
                <option value="9">Best of 9</option>
                <option value="11">Best of 11</option>
                <option value="13">Best of 13</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem' }}>First to (legs)</label>
              <input
                type="number"
                name="firstTo"
                value={formData.firstTo}
                onChange={handleChange}
                min="1"
                style={{ background: 'var(--bg-primary)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div style={{
              padding: '20px',
              background: 'rgba(77, 168, 218, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(77, 168, 218, 0.2)'
            }}>
              <h4 style={{ marginBottom: '15px', color: 'var(--accent-cyan)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Your Stats</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>180s</label>
                  <input
                    type="number"
                    name="your180s"
                    value={formData.your180s}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>3-Dart Average</label>
                  <input
                    type="number"
                    step="0.01"
                    name="yourAvg"
                    value={formData.yourAvg}
                    onChange={handleChange}
                    min="0"
                    placeholder="0.00"
                    required={formData.gameType === 'Cup'}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Highest Checkout</label>
                  <input
                    type="number"
                    name="yourHighestCheckout"
                    value={formData.yourHighestCheckout}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                  />
                </div>
                {formData.gameType !== 'Open League Doubles' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem' }}>Checkout Success %</label>
                    <input
                      type="number"
                      name="yourDoubleSuccess"
                      value={formData.yourDoubleSuccess}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}>
              <h4 style={{ marginBottom: '15px', color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Opponent Stats</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>180s</label>
                  <input
                    type="number"
                    name="opponent180s"
                    value={formData.opponent180s}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>3-Dart Average</label>
                  <input
                    type="number"
                    step="0.01"
                    name="opponentAvg"
                    value={formData.opponentAvg}
                    onChange={handleChange}
                    min="0"
                    placeholder="0.00"
                    required={formData.gameType === 'Cup'}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Highest Checkout</label>
                  <input
                    type="number"
                    name="opponentHighestCheckout"
                    value={formData.opponentHighestCheckout}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                  />
                </div>
                {formData.gameType !== 'Open League Doubles' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem' }}>Checkout Success %</label>
                    <input
                      type="number"
                      name="opponentDoubleSuccess"
                      value={formData.opponentDoubleSuccess}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '30px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '600', display: 'block', marginBottom: '12px' }}>
              {formData.gameType === 'Open League Doubles' ? 'Proof of Result 1' : 'Proof of Result (Photo/Screenshot/Video)'}
              {isUploadingProof && <span style={{ marginLeft: '10px', color: 'var(--accent-cyan)', fontSize: '0.8rem' }}>• Uploading: {uploadProgress}%</span>}
            </label>
            
            {!formData.proofImage && !formData.proofVideo ? (
              <div
                className="result-proof-picker"
                style={{ 
                  border: '2px dashed var(--border)', 
                  borderRadius: '12px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-secondary)',
                  width: '100%',
                  color: 'var(--text)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {isUploadingProof && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }}>
                    <div className="spinner" style={{ marginBottom: '10px' }}></div>
                    <div style={{ color: '#fff', fontSize: '0.9rem' }}>Uploading {uploadProgress}%</div>
                  </div>
                )}
                <div className="result-proof-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <div className="result-proof-native-button result-proof-camera" style={{ flex: 1, minWidth: '120px' }}>
                    <span style={{ fontSize: '0.85rem' }}>📷 Photo</span>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      aria-label="Take Photo"
                      onClick={(e) => { e.currentTarget.value = '' }}
                      onChange={(e) => handleImageUpload(e, 1)}
                      className="result-proof-input"
                      disabled={isUploadingProof}
                    />
                  </div>
                  <div className="result-proof-native-button result-proof-upload" style={{ flex: 1, minWidth: '120px' }}>
                    <span style={{ fontSize: '0.85rem' }}>📁 Image</span>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*"
                      aria-label="Upload Screenshot"
                      onClick={(e) => { e.currentTarget.value = '' }}
                      onChange={(e) => handleImageUpload(e, 1)}
                      className="result-proof-input"
                      disabled={isUploadingProof}
                    />
                  </div>
                  {formData.gameType !== 'Open League Doubles' && (
                    <div className="result-proof-native-button result-proof-video" style={{ flex: 1, minWidth: '120px', background: 'var(--accent-primary)' }}>
                      <span style={{ fontSize: '0.85rem' }}>🎬 Video</span>
                      <input
                        type="file"
                        accept="video/*"
                        aria-label="Upload Video"
                        onClick={(e) => { e.currentTarget.value = '' }}
                        onChange={handleVideoUpload}
                        className="result-proof-input"
                        disabled={isUploadingProof}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : formData.proofImage ? (
              <div style={{ position: 'relative', textAlign: 'center' }}>
                {isUploadingProof && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    zIndex: 10
                  }}>
                    <div className="spinner" style={{ marginBottom: '10px' }}></div>
                    <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>{uploadProgress < 100 ? `Sending ${uploadProgress}%` : 'Nearly Done...'}</div>
                  </div>
                )}
                <img
                  src={formData.proofImage} 
                  alt="Proof" 
                  style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', border: '1px solid var(--border)', opacity: isUploadingProof ? 0.5 : 1 }}
                />
                {!isUploadingProof && (
                  <button
                    type="button"
                    onClick={() => removeImage(1)}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                      fontSize: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ) : (
              <div style={{ position: 'relative', textAlign: 'center' }}>
                {isUploadingProof && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    zIndex: 10
                  }}>
                    <div className="spinner" style={{ marginBottom: '10px' }}></div>
                    <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>Uploading {uploadProgress}%</div>
                  </div>
                )}
                <video
                  src={formData.proofVideo}
                  controls
                  style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', border: '1px solid var(--border)', opacity: isUploadingProof ? 0.5 : 1 }}
                />
                {!isUploadingProof && (
                  <button
                    type="button"
                    onClick={() => removeVideo()}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                      fontSize: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {formData.gameType === 'Open League Doubles' && (
              <div style={{ marginTop: '20px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: '600', display: 'block', marginBottom: '12px' }}>
                  Proof of Result 2
                </label>
                {!formData.proofImage2 ? (
                  <div
                    className="result-proof-picker"
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: '12px',
                      padding: '30px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'var(--bg-secondary)',
                      width: '100%',
                      color: 'var(--text)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="result-proof-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <div className="result-proof-native-button result-proof-camera" style={{ flex: 1, minWidth: '120px' }}>
                        <span style={{ fontSize: '0.85rem' }}>📷 Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          aria-label="Take Photo"
                          onClick={(e) => { e.currentTarget.value = '' }}
                          onChange={(e) => handleImageUpload(e, 2)}
                          className="result-proof-input"
                        />
                      </div>
                      <div className="result-proof-native-button result-proof-upload" style={{ flex: 1, minWidth: '120px' }}>
                        <span style={{ fontSize: '0.85rem' }}>📁 Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          aria-label="Upload Screenshot"
                          onClick={(e) => { e.currentTarget.value = '' }}
                          onChange={(e) => handleImageUpload(e, 2)}
                          className="result-proof-input"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ position: 'relative', textAlign: 'center' }}>
                    <img
                      src={formData.proofImage2}
                      alt="Proof 2"
                      style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', border: '1px solid var(--border)' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(2)}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        fontSize: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )}

            {uploadError && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px', textAlign: 'center' }}>⚠️ {uploadError}</div>}
          </div>

          <div className="card glass" style={{ marginBottom: '30px', padding: '20px', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <input
                type="checkbox"
                id="isHighlight"
                checked={formData.isHighlight}
                onChange={(e) => setFormData(prev => ({ ...prev, isHighlight: e.target.checked }))}
                style={{ width: '20px', height: '20px' }}
              />
              <label htmlFor="isHighlight" style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>Add to my Highlight Reel 🎬</label>
            </div>
            {formData.isHighlight && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <input
                  placeholder="Highlight Title (e.g. My first 180!)"
                  value={formData.highlightTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, highlightTitle: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                />
                <input
                  placeholder="Video URL (YouTube/TikTok/Spotify) - Optional"
                  value={formData.highlightUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, highlightUrl: e.target.value }))}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                />
              </div>
            )}
          </div>

          <button 
            type="submit"
            className={`btn ${submitted ? 'btn-success' : 'btn-primary'} btn-block`}
            disabled={submitted || isSubmitting}
            style={{
              padding: '20px',
              fontSize: '1.1rem',
              fontWeight: '700',
              borderRadius: '12px',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '80px',
              transition: 'all 0.3s ease'
            }}
          >
            {isSubmitting ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}></div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '1rem', lineHeight: 1.2 }}>
                      {uploadProgress > 0 && uploadProgress < 100 ? `Sending Video... ${uploadProgress}%` : 'Saving Results...'}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: '400', marginTop: '2px' }}>
                      {successMessage || (uploadProgress > 0 ? 'This may take a moment' : 'Finalizing match data')}
                    </div>
                  </div>
                </div>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${uploadProgress}%`,
                      height: '100%',
                      background: 'var(--accent-cyan)',
                      boxShadow: '0 0 10px var(--accent-cyan)',
                      transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}></div>
                  </div>
                )}
              </div>
            ) : submitted ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.5rem' }}>✅</span>
                <span>Submitted Successfully!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>🚀</span>
                <span>Submit Match Result</span>
              </div>
            )}
          </button>

          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '15px' }}>
            Results are sent to admins for approval
          </p>
        </form>
      </div>

      {userSubmittedResults.length > 0 && (
        <div className="card" style={{ marginTop: '30px', padding: '20px' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Your Recent Submissions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {userSubmittedResults.map(result => {
              const statusDisplay = getResultStatusDisplay(result.status)
              const proofUploaded = Boolean(result.proofImage || result.hasProofImage)
              return (
                <div
                  key={result.id || result.firestoreId}
                  style={{
                    padding: '15px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                      {result.player1} <span style={{ color: 'var(--accent-cyan)' }}>{result.score1}-{result.score2}</span> {result.player2}
                    </span>
                    <span style={{
                      color: statusDisplay.color,
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '4px 8px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '4px'
                    }}>
                      {statusDisplay.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <span>{result.gameType} • {result.date}</span>
                    <span>{proofUploaded ? '🖼️ Proof Attached' : '❌ No Proof'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
