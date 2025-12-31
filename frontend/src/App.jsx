import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { FiSettings, FiFile, FiFolder, FiSave, FiShare2, FiSearch, FiMaximize, FiChevronDown, FiGlobe, FiShuffle, FiArrowUp, FiArrowDown, FiPlay, FiSquare, FiHelpCircle, FiImage, FiDroplet, FiUpload, FiAward, FiX, FiMoon, FiSun } from 'react-icons/fi'
import './App.css'
import CanvasWheel from './components/CanvasWheel'
import AdminPanel from './components/AdminPanel'
import { getSpinFiles } from './services/api'

function App() {
  // Initialize names as empty array - will be populated from uploaded file or dummy data
  const [names, setNames] = useState([])
  const [results, setResults] = useState([])
  const [activeTab, setActiveTab] = useState('entries')
  const [namesText, setNamesText] = useState('')
  const [spinFiles, setSpinFiles] = useState([])
  const [selectedSpinFile, setSelectedSpinFile] = useState(null)
  const [showOpenDropdown, setShowOpenDropdown] = useState(false)
  const [loadingSpinFiles, setLoadingSpinFiles] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [nameToTicketMap, setNameToTicketMap] = useState({}) // Map names to ticket numbers for backend matching
  const [nameToIndexMap, setNameToIndexMap] = useState({}) // Map names to their index in the names array
  const [ticketToNameMap, setTicketToNameMap] = useState({}) // Map ticket numbers to names
  const [ticketToIndexMap, setTicketToIndexMap] = useState({}) // Map ticket numbers to index in names array (for fast removal)
  const [currentPage, setCurrentPage] = useState('admin') // 'admin' or 'wheel'
  const [spinCount, setSpinCount] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('spinCount')
    return saved ? parseInt(saved, 10) : 0
  }) // Track number of spins
  const [winners, setWinners] = useState(() => {
    // Load winners from localStorage on mount
    try {
      const saved = localStorage.getItem('winnersList')
      return saved ? JSON.parse(saved) : []
    } catch (e) {
      return []
    }
  }) // Winners ladder - stores all winners with spin number
  const [showWinnersList, setShowWinnersList] = useState(false) // Show winners list modal
  const [allSpinFiles, setAllSpinFiles] = useState([]) // All available spin files
  const [currentFileIndex, setCurrentFileIndex] = useState(0) // Current file being used
  const [showEndScreen, setShowEndScreen] = useState(false) // End screen flag
  const [hardcodedWinners, setHardcodedWinners] = useState(['', '']) // Hardcoded winners for spin 1-2
  const [finalRotation, setFinalRotation] = useState(0) // Single rotation value - the only source of truth
  const [isSpinning, setIsSpinning] = useState(false)
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [showWinner, setShowWinner] = useState(false)
  const [winner, setWinner] = useState(null)
  const wheelContainerRef = useRef(null)
  const [popupPosition, setPopupPosition] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
  const [spinMode, setSpinMode] = useState(() => localStorage.getItem('spinMode') || 'random') // 'random' or 'fixed' (legacy)
  const [spinModes, setSpinModes] = useState(() => {
    // Per-spin mode configuration: { 1: 'random', 2: 'fixed', 3: 'random', ... }
    const saved = localStorage.getItem('spinModes')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        return {}
      }
    }
    return {}
  })
  const [showCustomize, setShowCustomize] = useState(false)
  const [customizeTab, setCustomizeTab] = useState('during-spin')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [centerImage, setCenterImage] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('centerImage')
    return saved || null
  })
  const [centerImageSize, setCenterImageSize] = useState(() => {
    const saved = localStorage.getItem('centerImageSize')
    return saved || 'M'
  })
  const centerImageInputRef = useRef(null)
  const [theme, setTheme] = useState(() => {
    // Load theme from localStorage, default to 'normal'
    const saved = localStorage.getItem('theme')
    return saved || 'normal'
  }) // Theme: 'night', 'normal', 'light'

  const [settings, setSettings] = useState({
    sound: 'Ticking sound',
    volume: 50,
    displayDuplicates: true,
    spinSlowly: false,
    showTitle: true,
    spinTime: 3,
    maxNamesVisible: 1000,
    afterSpinSound: 'Subdued applause',
    afterSpinVolume: 50,
    animateWinningEntry: false,
    launchConfetti: true,
    autoRemoveWinner: false,
    displayPopup: true,
    popupMessage: 'We have a winner!',
    displayRemoveButton: true,
    playClickSoundOnRemove: false,
    oneColorPerSection: true,
    wheelBackgroundImage: false,
    selectedTheme: '',
    colorPalettes: [true, true, true, true, true, false, false, false],
    centerImage: '',
    imageSize: 'S',
    pageBackgroundColor: false,
    displayColorGradient: true,
    contours: false,
    wheelShadow: true,
    pointerChangesColor: true
  })
  const wheelRef = useRef(null)
  const winnerProcessedRef = useRef(false)
  const animationFrameRef = useRef(null)
  const animationCompletedRef = useRef(false) // Track if animation is completed
  const isFrozenRef = useRef(false) // Track if wheel is frozen
  const fixedBatchRef = useRef(null) // Store the batch used for fixed winner rotation
  const randomBatchRef = useRef(null) // Store the batch used for random spin (to ensure consistency)
  const [browserZoom, setBrowserZoom] = useState(1) // Track browser zoom level
  const wheelWrapperRef = useRef(null) // Ref for wheel wrapper to apply inverse scaling
  
  // State for displayed names (100 entries at a time)
  const [displayedNames, setDisplayedNames] = useState([])
  // State to track fixed winner name for current spin (so it appears in every batch)
  const [fixedWinnerName, setFixedWinnerName] = useState(null)

  // Detect browser zoom level and apply inverse scaling to keep wheel fixed size
  useEffect(() => {
    const detectZoom = () => {
      // Method: Use a test element to measure actual zoom
      const testElement = document.createElement('div')
      testElement.style.width = '100px'
      testElement.style.position = 'absolute'
      testElement.style.visibility = 'hidden'
      testElement.style.top = '-9999px'
      document.body.appendChild(testElement)
      const actualWidth = testElement.offsetWidth
      document.body.removeChild(testElement)
      const detectedZoom = actualWidth / 100
      
      // Apply inverse scaling to wheel-wrapper to maintain fixed visual size
      if (wheelWrapperRef.current) {
        const inverseScale = 1 / detectedZoom
        wheelWrapperRef.current.style.transform = `scale(${inverseScale})`
        wheelWrapperRef.current.style.transformOrigin = 'center center'
      }
    }
    
    // Detect zoom on mount and resize
    detectZoom()
    
    // Listen for zoom changes (resize event fires on zoom in most browsers)
    window.addEventListener('resize', detectZoom)
    
    // Also check periodically for zoom changes (some browsers don't fire resize on zoom)
    const zoomCheckInterval = setInterval(detectZoom, 500)
    
    return () => {
      window.removeEventListener('resize', detectZoom)
      clearInterval(zoomCheckInterval)
    }
  }, [])

  // Audio Context for zero-latency synthetic sounds
  const audioContextRef = useRef(null)

  // Initialize Audio Context on user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
    }
    window.addEventListener('click', initAudio)
    window.addEventListener('keydown', initAudio)
    return () => {
      window.removeEventListener('click', initAudio)
      window.removeEventListener('keydown', initAudio)
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [])

  // 1. Synthetic "Click" Sound (Zero Latency)
  // Short, sharp white noise burst + sine wave for a physical "click" sound
  const playClickSound = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const t = ctx.currentTime

    // Filtered Noise for "Texture"
    const bufferSize = ctx.sampleRate * 0.01 // 10ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.5, t)
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.01)
    noise.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start(t)

    // High Sine Beep for "Impact"
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(800, t)
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.05)
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.05)
  }, [])

  // 2. Synthetic "Fanfare" Sound (Win)
  const playFanfare = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const t = ctx.currentTime
    // Simple major chord arpeggio
    const freqs = [523.25, 659.25, 783.99, 1046.50] // C Major

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f

      // Staggered entrance
      const start = t + i * 0.1
      const dur = 0.8

      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.2, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur)
    })
  }, [])

  // Continuous slow rotation - only when not spinning and not frozen
  useEffect(() => {
    // Cancel any existing slow rotation animation
    if (animationFrameRef.current && !isSpinning) {
      // Don't cancel if spinning animation is active
      return
    }

    // Stop slow rotation when spinning, when winner is found, when pop-up is shown, or when frozen
    if (isSpinning || winner || showWinner || isFrozenRef.current) {
      return
    }

    let lastTime = performance.now()
    const slowRotationFrameRef = { current: null }

    const animateSlow = (currentTime) => {
      // Check if we should stop (conditions may have changed)
      if (isSpinning || winner || showWinner || isFrozenRef.current) {
        slowRotationFrameRef.current = null
        return
      }

      const delta = currentTime - lastTime
      lastTime = currentTime

      // Update finalRotation smoothly - very slow and smooth for organic, elegant look
      // Reduced to 0.3 degrees per 50ms = 6 degrees per second (very slow and smooth)
      // This matches the smooth, organic feel of the spin animation
      setFinalRotation(prev => (prev + (0.3 * delta / 50)) % 360)

      slowRotationFrameRef.current = requestAnimationFrame(animateSlow)
    }

    slowRotationFrameRef.current = requestAnimationFrame(animateSlow)
    return () => {
      if (slowRotationFrameRef.current) {
        cancelAnimationFrame(slowRotationFrameRef.current)
        slowRotationFrameRef.current = null
      }
    }
  }, [isSpinning, winner, showWinner])

  // Debounce timer for textarea updates
  const textareaUpdateTimerRef = useRef(null)

  // Update names array in real-time as user types in textarea (with debouncing for large lists)
  const handleNamesTextChange = (e) => {
    const text = e.target.value
    setNamesText(text)

    // Clear previous timer
    if (textareaUpdateTimerRef.current) {
      clearTimeout(textareaUpdateTimerRef.current)
    }

    // Parse textarea content into names array (split by newlines, filter empty lines)
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    // For large lists, debounce the update to improve performance
    if (lines.length > 500) {
      // Debounce for large lists (>500 entries)
      textareaUpdateTimerRef.current = setTimeout(() => {
        setNames(lines)
      }, 300) // 300ms delay
    } else {
      // Immediate update for small lists
      setNames(lines)
    }
  }

  const removeName = (nameToRemove) => {
    // Remove the name from textarea
    const lines = namesText.split('\n').filter(line => line.trim() !== nameToRemove)
    const newText = lines.join('\n')
    setNamesText(newText)
    setNames(lines.filter(line => line.trim().length > 0))
  }

  const shuffleNames = () => {
    const shuffled = [...names].sort(() => Math.random() - 0.5)
    setNames(shuffled)
    // Update textarea to match shuffled names
    setNamesText(shuffled.join('\n'))
  }

  const sortNames = () => {
    const sorted = [...names].sort((a, b) => {
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })
    setNames(sorted)
    // Update textarea to match sorted names
    setNamesText(sorted.join('\n'))
  }

  const spinWheel = useCallback(async () => {
    if (isSpinning || names.length === 0) return

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Clear frozen state when starting new spin
    isFrozenRef.current = false
    animationCompletedRef.current = false
    winnerProcessedRef.current = false
    fixedBatchRef.current = null // Clear fixed batch ref
    randomBatchRef.current = null // Clear random batch ref
    // Clear fixed winner name when starting new spin
    setFixedWinnerName(null)

    setIsSpinning(true)

    // Get current rotation - this is the ONLY rotation value
    const startRotation = finalRotation
    let lastTickRotation = startRotation // Track last rotation for sound sync

    // Duration: 15000ms (15s) - Smooth 15 second spin
    const duration = 15000

    // Calculate total rotation: 3-5 full rotations (1080-1800 degrees) - Reduced for slower, more organic feel
    const minRotations = 3
    const maxRotations = 5
    const spins = minRotations + Math.random() * (maxRotations - minRotations)
    const totalRotationDegrees = spins * 360

    // Increment spin count
    const currentSpinNumber = spinCount + 1
    setSpinCount(currentSpinNumber)
    
    // Reload spinModes from localStorage to ensure we have latest values
    const savedSpinModes = localStorage.getItem('spinModes')
    let currentSpinModes = {}
    if (savedSpinModes) {
      try {
        currentSpinModes = JSON.parse(savedSpinModes)
      } catch (e) {
        console.error('Failed to parse spinModes:', e)
        currentSpinModes = spinModes // Fallback to state
      }
    } else {
      currentSpinModes = spinModes // Use state if localStorage is empty
    }
    
    // Determine mode for this spin
    // Check per-spin mode first (try both string and number keys), then fall back to global mode
    // spinModes keys are stored as strings in localStorage, so try both formats
    const modeForThisSpin = currentSpinModes[String(currentSpinNumber)] || 
                            currentSpinModes[currentSpinNumber] || 
                            spinMode || 
                            'random'
    const shouldUseFixedWinner = modeForThisSpin === 'fixed'
    
    console.log('Spin mode check:', {
      currentSpinNumber,
      spinModesFromState: spinModes,
      spinModesFromStorage: currentSpinModes,
      modeForThisSpin,
      shouldUseFixedWinner,
      spinCount
    })
    
    // Get fixed winner from localStorage for this specific spin
    let targetWinnerIndex = null
    let fixedWinnerForSpin = null
    let winnerForThisSpin = null // Declare in outer scope so it's accessible in animate function
    
    if (shouldUseFixedWinner) {
      // Get selected winners from localStorage
      const savedSelectedWinners = localStorage.getItem('selectedWinners')
      if (savedSelectedWinners) {
        try {
          const selectedWinners = JSON.parse(savedSelectedWinners)
          // Find winner for this specific spin number (handle both string and number comparisons)
          winnerForThisSpin = selectedWinners.find(w => 
            w.spin === currentSpinNumber || 
            Number(w.spin) === currentSpinNumber ||
            String(w.spin) === String(currentSpinNumber)
          )
          
          console.log('Selected winners lookup:', {
            currentSpinNumber,
            selectedWinners,
            winnerForThisSpin,
            allSpins: selectedWinners.map(w => ({ spin: w.spin, type: typeof w.spin }))
          })
          
          if (winnerForThisSpin) {
            fixedWinnerForSpin = winnerForThisSpin.winnerId || winnerForThisSpin.name || winnerForThisSpin.ticketNumber
            
            console.log('Looking for fixed winner:', {
              winnerForThisSpin,
              fixedWinnerForSpin,
              winnerId: winnerForThisSpin.winnerId,
              name: winnerForThisSpin.name,
              ticketNumber: winnerForThisSpin.ticketNumber
            })
            
            // Find the index of this winner in the names array
            // Try multiple matching strategies - prioritize exact matches
            console.log('Starting fixed winner search:', {
              namesLength: names.length,
              winnerForThisSpin,
              winnerId: winnerForThisSpin.winnerId,
              winnerName: winnerForThisSpin.name,
              winnerTicket: winnerForThisSpin.ticketNumber,
              nameToTicketMapSample: Object.entries(nameToTicketMap).slice(0, 10).map(([n, t]) => ({ name: n, ticket: t })),
              ticketToIndexMapSample: Object.entries(ticketToIndexMap).slice(0, 10).map(([t, i]) => ({ ticket: t, index: i }))
            })
            
            // FIRST: Match by NAME (primary method - name-based selection)
            // Extract base name from "Name (Ticket)" format if needed
            const winnerNameToMatch = winnerForThisSpin.name
            let winnerBaseName = winnerNameToMatch
            const winnerNameMatch = winnerNameToMatch.match(/^(.+?)\s*\(\d+\)$/)
            if (winnerNameMatch) {
              winnerBaseName = winnerNameMatch[1].trim()
            }
            
            // Search through names array - match by NAME first
            if (targetWinnerIndex === null) {
              for (let i = 0; i < names.length; i++) {
                const name = names[i]
                const ticketNumber = nameToTicketMap[name]
              
              // Extract base name from "Name (Ticket)" format if needed
              let baseName = name
              const nameMatch = name.match(/^(.+?)\s*\(\d+\)$/)
              if (nameMatch) {
                baseName = nameMatch[1].trim()
              }
              
              // Match by NAME (case-insensitive) - use FIRST match if multiple entries with same name
              const nameMatches = baseName.trim().toLowerCase() === winnerBaseName.trim().toLowerCase() ||
                                  name.trim().toLowerCase() === winnerNameToMatch.trim().toLowerCase()
              
              if (nameMatches) {
                // Found match by name - use first match (if multiple entries with same name, use first one)
                if (targetWinnerIndex === null) {
                  targetWinnerIndex = i
                  console.log('✅ MATCHED by NAME (first match):', { 
                    i, 
                  name,
                    baseName,
                    winnerName: winnerNameToMatch,
                    winnerBaseName,
                    ticketNumber
                  })
                  break // Use first match only
                }
              }
              
              // Also try matching by winnerId if available (for backward compatibility)
              if (winnerForThisSpin.winnerId) {
                const entryId = `${selectedSpinFile?.id || ''}-${i}`
                if (entryId === winnerForThisSpin.winnerId) {
                  if (targetWinnerIndex === null) {
                  targetWinnerIndex = i
                  console.log('Matched by winnerId (entryId):', { i, name, ticketNumber, winnerId: winnerForThisSpin.winnerId, entryId })
                  break
                }
                }
              }
              }
            }
            
            // Fallback: If name match not found, try ticket number (but name is primary)
            if (targetWinnerIndex === null && winnerForThisSpin.ticketNumber && ticketToIndexMap) {
                const normalizedWinnerTicket = String(winnerForThisSpin.ticketNumber).trim()
              const directIndex = ticketToIndexMap[normalizedWinnerTicket]
              
              if (directIndex !== undefined && directIndex !== null && directIndex >= 0 && directIndex < names.length) {
                targetWinnerIndex = directIndex
                console.log('✅ FALLBACK MATCH by ticketToIndexMap:', {
                  ticket: normalizedWinnerTicket,
                  index: directIndex,
                  name: names[directIndex],
                  note: 'Name match not found, using ticket as fallback'
                })
              }
            }
            
            console.log('Fixed winner lookup:', {
              currentSpinNumber,
              winnerForThisSpin,
              fixedWinnerForSpin,
              targetWinnerIndex,
              namesLength: names.length,
              namesSample: names.slice(0, 5)
            })
            
            // If still not found, try backend API as fallback (but prioritize frontend selection)
            // Only use backend if frontend localStorage doesn't have a selection
            if (targetWinnerIndex === null && selectedSpinFile && selectedSpinFile.id) {
              console.log('Frontend fixed winner not found, trying backend API as fallback')
      try {
        const result = await spinWheelAPI(selectedSpinFile.id)
                const backendWinner = result.winner
                
                console.log('Backend API returned winner:', backendWinner)
                
                if (backendWinner) {
                  // Try to match backend winner by ticket number first
                  for (let i = 0; i < names.length; i++) {
                    const name = names[i]
                    const ticketNumber = nameToTicketMap[name]
                    
                    // Match by ticket number (most reliable)
                    if (ticketNumber && String(ticketNumber).trim() === String(backendWinner).trim()) {
                      targetWinnerIndex = i
                      console.log('Matched backend winner by ticket:', { i, name, ticketNumber, backendWinner })
                      break
                    }
                  }
                  
                  // If ticket match failed, try by name
                  if (targetWinnerIndex === null) {
                    const winnerName = ticketToNameMap[backendWinner] || backendWinner
                    for (let i = 0; i < names.length; i++) {
                      const name = names[i]
                      if (String(name).trim().toLowerCase() === String(winnerName).trim().toLowerCase()) {
                        targetWinnerIndex = i
                        console.log('Matched backend winner by name:', { i, name, winnerName })
                        break
                      }
                    }
                  }
                  
                  // Last resort: use index map
                  if (targetWinnerIndex === null) {
                    const winnerName = ticketToNameMap[backendWinner] || backendWinner
                    if (nameToIndexMap[winnerName] !== undefined) {
                      targetWinnerIndex = nameToIndexMap[winnerName]
                      console.log('Matched backend winner by index map:', { targetWinnerIndex, winnerName })
                    }
                  }
                }
      } catch (error) {
                console.error('Failed to get winner from backend:', {
                  error: error.message,
                  status: error.status,
                  spinFileId: selectedSpinFile.id
                })
                // Continue without backend winner - use localStorage winner only
              }
            }
            
            // Final check: if still not found, log warning
            if (targetWinnerIndex === null && shouldUseFixedWinner) {
              console.error('CRITICAL: Fixed winner mode but no winner found!', {
                currentSpinNumber,
                winnerForThisSpin,
                selectedWinners: JSON.parse(localStorage.getItem('selectedWinners') || '[]'),
                namesLength: names.length,
                nameToTicketMapSample: Object.entries(nameToTicketMap).slice(0, 10)
              })
            }
          }
        } catch (error) {
          console.error('Failed to parse selected winners:', error)
        }
      }
    }
    
    // Set fixed winner name if found (so it appears in every batch)
    let fixedWinnerDisplayedIndex = null
    let finalDisplayedNamesForRotation = null
    
    if (targetWinnerIndex !== null && targetWinnerIndex >= 0 && shouldUseFixedWinner && names[targetWinnerIndex]) {
      const winnerName = names[targetWinnerIndex]
      setFixedWinnerName(winnerName)
      console.log('Fixed winner name set for batch inclusion:', winnerName)
      
      // CRITICAL: Synchronously prepare displayedNames with fixed winner BEFORE calculating rotation
      // This ensures the fixed winner is always in the batch and at a known position
      if (names.length > 100) {
        // Get current displayedNames
        let currentDisplayed = displayedNames.length > 0 ? [...displayedNames] : []
        
        // If fixed winner not in current displayed names, ensure it's added at a known position
        if (!currentDisplayed.includes(winnerName)) {
          // Remove winner if it exists elsewhere, then add at position 0 (first position)
          currentDisplayed = currentDisplayed.filter(n => n !== winnerName)
          // Ensure we have exactly 100 entries with fixed winner at position 0
          if (currentDisplayed.length >= 99) {
            currentDisplayed = [winnerName, ...currentDisplayed.slice(0, 99)]
          } else {
            // If we don't have enough, fill with random entries
            const remainingNames = names.filter(name => name !== winnerName)
            const shuffled = [...remainingNames].sort(() => Math.random() - 0.5)
            currentDisplayed = [winnerName, ...shuffled.slice(0, 99)]
          }
        }
        
        // Ensure fixed winner is at position 0 (first position) for consistent rotation calculation
        const winnerIndexInCurrent = currentDisplayed.indexOf(winnerName)
        if (winnerIndexInCurrent !== 0 && winnerIndexInCurrent !== -1) {
          // Move winner to position 0
          currentDisplayed.splice(winnerIndexInCurrent, 1)
          currentDisplayed.unshift(winnerName)
          // Ensure we still have 100 entries
          if (currentDisplayed.length > 100) {
            currentDisplayed = currentDisplayed.slice(0, 100)
          }
        } else if (winnerIndexInCurrent === -1) {
          // Winner not found, add at position 0
          currentDisplayed = [winnerName, ...currentDisplayed.filter(n => n !== winnerName).slice(0, 99)]
        }
        
        // CRITICAL: Update state immediately and use this exact batch for rotation calculation
        // This ensures the wheel displays exactly what we calculate rotation for
        // Force fixed winner to position 0
        currentDisplayed = currentDisplayed.filter(n => n !== winnerName)
        currentDisplayed.unshift(winnerName)
        currentDisplayed = currentDisplayed.slice(0, 100)
        
        finalDisplayedNamesForRotation = currentDisplayed
        fixedWinnerDisplayedIndex = 0 // Always at position 0 for consistency
        
        // CRITICAL: Store this batch in a ref FIRST, before updating state
        // This ensures the batch is locked before any other code can change it
        fixedBatchRef.current = [...currentDisplayed]
        
        // Update state - this will be the batch shown on the wheel
        // Use setTimeout to ensure ref is set before state update triggers any effects
        setDisplayedNames(currentDisplayed)
        
        // Double-check: verify the batch is correct
        if (fixedBatchRef.current[0] !== winnerName) {
          console.error('CRITICAL: Fixed winner not at position 0 in stored batch!')
          fixedBatchRef.current = [winnerName, ...fixedBatchRef.current.filter(n => n !== winnerName).slice(0, 99)]
        }
        
        // Verify fixed winner is at position 0
        if (finalDisplayedNamesForRotation[0] !== winnerName) {
          console.error('CRITICAL: Fixed winner not at position 0 after force!', {
            position0: finalDisplayedNamesForRotation[0],
            winnerName,
            batch: finalDisplayedNamesForRotation.slice(0, 5)
          })
        } else {
          console.log('✅ Fixed winner confirmed at position 0:', {
            position0: finalDisplayedNamesForRotation[0],
            winnerName,
            batchLength: finalDisplayedNamesForRotation.length
          })
        }
      } else {
        // All names fit, use all names
        finalDisplayedNamesForRotation = [...names]
        fixedWinnerDisplayedIndex = targetWinnerIndex
        // Store this batch in ref
        fixedBatchRef.current = [...names]
      }
    }
    
    // Calculate final rotation
    let endRotation
    if (targetWinnerIndex !== null && targetWinnerIndex >= 0 && shouldUseFixedWinner && finalDisplayedNamesForRotation) {
      // Use the prepared displayedNames with fixed winner at known position
      const displayedNamesLength = finalDisplayedNamesForRotation.length
      const fixedSliceAngle = 360 / displayedNamesLength
      
      // Fixed winner is always at position 0 in finalDisplayedNamesForRotation
      // This ensures consistent rotation calculation
      const fixedWinnerPos = fixedWinnerDisplayedIndex !== null ? fixedWinnerDisplayedIndex : 0
      
      console.log('Calculating fixed winner rotation:', {
        targetWinnerIndex,
        fixedWinnerDisplayedIndex: fixedWinnerPos,
        fixedWinnerName: finalDisplayedNamesForRotation[fixedWinnerPos],
        sliceAngle: fixedSliceAngle,
        startRotation,
        totalRotationDegrees,
        displayedNamesLength,
        finalDisplayedNamesSample: finalDisplayedNamesForRotation.slice(0, 5)
      })
      
      // Pointer is at 0° (right side, pointing right)
      // In canvas, slices start at -90° (top), so slice i starts at: i * sliceAngle - 90°
      // Slice i center is at: (i * sliceAngle - 90 + sliceAngle/2) degrees
      // We want the center of the target slice to align with the pointer (0°)
      
      // Calculate the center angle of the target slice in the original wheel (before rotation)
      // Use fixedWinnerPos (position in displayedNames) - always 0 for consistency
      // Slices start at -90° (top), so slice i center is at: (i * sliceAngle - 90 + sliceAngle/2)
      // For position 0: center = (0 * sliceAngle - 90 + sliceAngle/2) = (-90 + sliceAngle/2)
      const sliceCenterAngle = (fixedWinnerPos * fixedSliceAngle - 90 + fixedSliceAngle / 2 + 360) % 360
      
      // When wheel rotates clockwise by R degrees:
      // - The canvas coordinate system rotates counter-clockwise by R (making wheel appear to rotate clockwise)
      // - A point that was at angle A in original wheel appears at angle (A - R) after rotation
      // - The pointer is fixed at 0° in screen coordinates
      // - What's at the pointer (0°) was originally at (360 - R) % 360 degrees
      // - To make slice center appear at pointer: (360 - endRotation) % 360 = sliceCenterAngle
      // - So: endRotation mod 360 = (360 - sliceCenterAngle) % 360
      
      // We want: endRotation = startRotation + totalRotationDegrees + adjustment
      // where (endRotation mod 360) = (360 - sliceCenterAngle) % 360
      
      // Calculate what the end rotation would be without adjustment
      const baseEndRotation = startRotation + totalRotationDegrees
      const baseEndRotationMod = ((baseEndRotation % 360) + 360) % 360
      
      // Calculate the target rotation mod 360 (inverse of sliceCenterAngle to match winner calculation)
      const targetRotationMod = (360 - sliceCenterAngle) % 360
      
      // Calculate adjustment needed to align slice center with pointer
      // We want: (baseEndRotation + adjustment) mod 360 = targetRotationMod
      // So: adjustment = (targetRotationMod - baseEndRotationMod + 360) % 360
      // But prefer the shorter path (adjustment between -180 and 180)
      let adjustment = targetRotationMod - baseEndRotationMod
      
      // Normalize adjustment to shortest path
      if (adjustment > 180) {
        adjustment -= 360
      } else if (adjustment < -180) {
        adjustment += 360
      }
      
      endRotation = baseEndRotation + adjustment
      
      // CRITICAL: Verify the calculation - (360 - endRotation) % 360 should equal sliceCenterAngle
      // This matches the winner calculation logic: pointerAngleInOriginal = (360 - R) % 360
      const verifyEndMod = ((endRotation % 360) + 360) % 360
      const verifyPointerAngle = (360 - verifyEndMod) % 360
      const verifyDiff = Math.abs(verifyPointerAngle - sliceCenterAngle)
      if (verifyDiff > 0.1 && verifyDiff < 359.9) {
        console.error('CRITICAL: Rotation calculation error!', {
          sliceCenterAngle,
          verifyPointerAngle,
          verifyDiff,
          adjustment,
          baseEndRotationMod,
          targetRotationMod
        })
        // Force correct alignment
        endRotation = startRotation + totalRotationDegrees + (targetRotationMod - baseEndRotationMod)
      }
      
      // Verify: (360 - endRotation) % 360 should equal sliceCenterAngle
      const verifyMod = ((endRotation % 360) + 360) % 360
      const verifyPointerAngleFinal = (360 - verifyMod) % 360
      const diff = Math.abs(verifyPointerAngleFinal - sliceCenterAngle)
      if (diff > 0.1 && diff < 359.9) {
        console.warn('Rotation calculation mismatch:', {
          verifyPointerAngleFinal,
          sliceCenterAngle,
          diff
        })
      }
      
      console.log('Fixed winner rotation calculation:', {
        sliceCenterAngle,
        targetRotationMod,
        baseEndRotationMod,
        adjustment,
        endRotation,
        endRotationMod: verifyMod,
        verifyPointerAngle: verifyPointerAngleFinal
      })
    } else {
      // Random spin - store the current batch to ensure consistency
      randomBatchRef.current = displayedNames.length > 0 ? [...displayedNames] : (names.length > 0 ? [...names] : [])
      console.log('Stored random batch for winner calculation:', {
        batchLength: randomBatchRef.current.length,
        firstFew: randomBatchRef.current.slice(0, 5)
      })
      const randomAngle = Math.random() * 360
      endRotation = startRotation + totalRotationDegrees + randomAngle
    }

    const startTime = performance.now()

    // Custom Easing: Multi-phase smooth spin
    // Phases:
    // 0-2s (0-0.133): Slow start - gentle acceleration
    // 2-4s (0.133-0.267): Transition to medium fast
    // 4-9s (0.267-0.6): Medium fast - steady speed with slight acceleration
    // 9-15s (0.6-1.0): Gradual slowdown - smooth deceleration over last 6 seconds
    const ease = (t) => {
      // Normalize time to 0-1 range (t is already 0-1)
      const totalTime = 15 // seconds
      const phase1End = 2 / totalTime   // 0.133 - Slow start phase
      const phase2End = 4 / totalTime   // 0.267 - Transition phase
      const phase3End = 9 / totalTime   // 0.6 - Medium fast phase
      // phase4End = 1.0 - Gradual slowdown phase

      if (t < phase1End) {
        // Phase 1: Slow start (0-2s) - Gentle acceleration
        const phaseProgress = t / phase1End
        // Slow, smooth acceleration curve
        return 0.08 * Math.pow(phaseProgress, 2.5)
      } else if (t < phase2End) {
        // Phase 2: Transition (2-4s) - Building up to medium fast
        const phaseProgress = (t - phase1End) / (phase2End - phase1End)
        const startValue = 0.08
        const endValue = 0.40
        // Smooth transition with easing
        return startValue + (endValue - startValue) * (1 - Math.pow(1 - phaseProgress, 1.5))
      } else if (t < phase3End) {
        // Phase 3: Medium fast (4-9s) - Steady speed with very slight acceleration
        // Use a more linear approach with minimal curve for smooth, consistent behavior
        const phaseProgress = (t - phase2End) / (phase3End - phase2End)
        const startValue = 0.40
        const endValue = 0.82
        // Nearly linear with very slight ease-in for natural feel
        // Using exponent close to 1.0 for steady speed
        return startValue + (endValue - startValue) * Math.pow(phaseProgress, 0.95)
      } else {
        // Phase 4: Gradual slowdown (9-15s, last 6 seconds)
        const phaseProgress = (t - phase3End) / (1 - phase3End)
        const startValue = 0.82
        const endValue = 1.0
        // Smooth deceleration curve
        return startValue + (endValue - startValue) * (1 - Math.pow(1 - phaseProgress, 3))
      }
    }

    const animate = () => {
      // Prevent any further execution if already completed
      if (animationCompletedRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        return
      }

      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      if (progress < 1) {
        // Check again if completed
        if (animationCompletedRef.current) {
          return
        }
        // Apply easing for smooth acceleration and deceleration
        const easedProgress = ease(progress)
        const current = startRotation + (endRotation - startRotation) * easedProgress
        
        // Always update every frame for smooth, glitch-free animation
        // No throttling - smooth rotation is priority
            setFinalRotation(current)
        
        // Robust sync: Play sound every 25 degrees (throttle sound for many entries)
        if (names.length < 2000 && Math.abs(current - lastTickRotation) >= 25) {
          playClickSound()
          lastTickRotation = current
        }

        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Animation complete - stop IMMEDIATELY at exact target
        animationCompletedRef.current = true

        // Cancel animation frame immediately
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }

        // Set to EXACT endRotation - freeze immediately
        setFinalRotation(endRotation)
        isFrozenRef.current = true

        // Only process winner once
        if (!winnerProcessedRef.current) {
          winnerProcessedRef.current = true

          // Calculate winner using the EXACT final rotation value
          // CRITICAL: Use the stored batch that was active when the spin started
          // This ensures the winner matches what's actually displayed on the wheel
          const frozenRot = endRotation
          let batchToUse = displayedNames
          if (shouldUseFixedWinner && fixedBatchRef.current) {
            // Use the exact batch that was used for fixed winner rotation calculation
            batchToUse = fixedBatchRef.current
            console.log('Using fixed batch for winner calculation:', {
              batchLength: batchToUse.length,
              position0: batchToUse[0],
              isFixedWinner: shouldUseFixedWinner
            })
          } else if (!shouldUseFixedWinner && randomBatchRef.current && randomBatchRef.current.length > 0) {
            // Use the stored batch from when random spin started
            batchToUse = randomBatchRef.current
            console.log('Using stored random batch for winner calculation:', {
              batchLength: batchToUse.length,
              firstFew: batchToUse.slice(0, 5),
              isRandom: true
            })
          } else {
            // Fallback to current displayedNames or all names
            batchToUse = displayedNames.length > 0 ? displayedNames : names
            console.log('Using fallback batch for winner calculation:', {
              batchLength: batchToUse.length,
              source: displayedNames.length > 0 ? 'displayedNames' : 'names'
            })
          }
          const displayedNamesLength = batchToUse.length > 0 ? batchToUse.length : names.length
          const sliceAngle = 360 / displayedNamesLength

          // The pointer is fixed at 0° (right side, pointing to the right)
          // After the wheel rotates clockwise by R degrees, find which slice is at the pointer

          // Normalize rotation to 0-360 range
          const R = ((frozenRot % 360) + 360) % 360

          // The pointer is at 0° (right side)
          // When wheel rotates clockwise by R degrees:
          // - The canvas coordinate system rotates counter-clockwise by R (making wheel appear to rotate clockwise)
          // - A point that was at angle A in original wheel appears at angle (A - R) after rotation
          // - The pointer is fixed at 0° in screen coordinates
          // - What's at the pointer (0°) was originally at (-R) degrees in the wheel's coordinate system
          // - Convert to 0-360 range: (360 - R) % 360
          // This matches the pointer color calculation logic
          const pointerAngleInOriginal = (360 - R) % 360

          // Find which slice contains this angle (based on displayedNames which is what's shown)
          // Slices start at -90° (top), so slice i covers:
          // from (i * sliceAngle - 90) to ((i+1) * sliceAngle - 90)
          let selectedDisplayedIndex = 0
          let found = false

          for (let i = 0; i < displayedNamesLength; i++) {
            // Calculate slice boundaries in original coordinates (0-360 range)
            const sliceStart = (i * sliceAngle - 90 + 360) % 360
            const sliceEnd = ((i + 1) * sliceAngle - 90 + 360) % 360

            // Check if pointer angle is within this slice
            let inSlice = false

            if (sliceStart < sliceEnd) {
              // Normal case: slice doesn't wrap around 0°
              inSlice = pointerAngleInOriginal >= sliceStart && pointerAngleInOriginal < sliceEnd
            } else {
              // Wrap-around case: slice crosses 0° boundary (e.g., 315° to 45°)
              inSlice = pointerAngleInOriginal >= sliceStart || pointerAngleInOriginal < sliceEnd
            }

            if (inSlice) {
              selectedDisplayedIndex = i
              found = true
              break
            }
          }

          // Fallback: if no slice found (shouldn't happen), find closest slice center
          if (!found) {
            let minDist = Infinity
            for (let i = 0; i < displayedNamesLength; i++) {
              const sliceCenter = (i * sliceAngle - 90 + sliceAngle / 2 + 360) % 360
              let dist = Math.abs(pointerAngleInOriginal - sliceCenter)
              if (dist > 180) dist = 360 - dist
              if (dist < minDist) {
                minDist = dist
                selectedDisplayedIndex = i
              }
            }
          }

          // Ensure valid index
          selectedDisplayedIndex = selectedDisplayedIndex % displayedNamesLength
          if (selectedDisplayedIndex < 0) {
            selectedDisplayedIndex = (selectedDisplayedIndex + displayedNamesLength) % displayedNamesLength
          }

          // Get the winner name from the batch used for calculation (what's actually shown)
          const displayedWinnerName = batchToUse.length > 0 ? batchToUse[selectedDisplayedIndex] : names[selectedDisplayedIndex]
          
          console.log('Winner calculation:', {
            frozenRot: R,
            pointerAngleInOriginal: pointerAngleInOriginal,
            selectedDisplayedIndex,
            displayedNamesLength,
            sliceAngle,
            displayedWinnerName,
            batchToUseLength: batchToUse.length,
            batchToUseFirstFew: batchToUse.slice(0, 5),
            currentDisplayedNamesFirstFew: displayedNames.slice(0, 5)
          })
          
          // Find the index of this winner in the full names array
          let finalWinnerIndex = names.indexOf(displayedWinnerName)
          if (finalWinnerIndex === -1) {
            // Fallback: if not found, use the calculated index
            finalWinnerIndex = selectedDisplayedIndex % names.length
            console.warn('Winner name not found in names array, using fallback index:', {
              displayedWinnerName,
              finalWinnerIndex,
              selectedDisplayedIndex
            })
          }

          // Use fixed winner if available, otherwise use calculated winner
          let winnerName, winnerColor, winnerTicket
          
          // CRITICAL: Color must be based on selectedDisplayedIndex (position in displayed batch)
          // This ensures popup color matches the slice color on the wheel
          winnerColor = colors[selectedDisplayedIndex % colors.length]
          
          if (shouldUseFixedWinner && targetWinnerIndex !== null && targetWinnerIndex >= 0 && targetWinnerIndex < names.length) {
            // ALWAYS use the fixed winner index - don't recalculate from rotation
            finalWinnerIndex = targetWinnerIndex
            winnerName = names[finalWinnerIndex]
            
            // CRITICAL: Always prioritize winnerForThisSpin.ticketNumber (the ticket that was selected)
            // This is the source of truth for fixed winner selection
            if (winnerForThisSpin && winnerForThisSpin.ticketNumber) {
              winnerTicket = String(winnerForThisSpin.ticketNumber).trim()
              
              // CRITICAL: Verify that the name at targetWinnerIndex matches the selected ticket
              // If name has ticket in format "Name (Ticket)", ensure it matches selected ticket
              const nameTicketMatch = winnerName.match(/^(.+?)\s*\((\d+)\)$/)
              if (nameTicketMatch) {
                const nameTicket = nameTicketMatch[2]
                const cleanName = nameTicketMatch[1].trim()
                
                // If name's ticket doesn't match selected ticket, find correct name by ticket
                if (nameTicket !== winnerTicket) {
                  console.warn('⚠️ Name ticket mismatch - finding correct name by ticket:', {
                    nameAtIndex: winnerName,
                    nameTicket: nameTicket,
                    selectedTicket: winnerTicket,
                    targetIndex: targetWinnerIndex
                  })
                  
                  // Find name that matches the selected ticket using ticketToNameMap
                  if (ticketToNameMap && ticketToNameMap[winnerTicket]) {
                    const correctName = ticketToNameMap[winnerTicket]
                    // Find index of correct name
                    const correctIndex = names.findIndex(n => {
                      // Check if name matches exactly or matches clean name
                      return n === correctName || 
                             n === `${cleanName} (${winnerTicket})` ||
                             (nameToTicketMap[n] && String(nameToTicketMap[n]).trim() === winnerTicket)
                    })
                    
                    if (correctIndex !== -1 && correctIndex < names.length) {
                      finalWinnerIndex = correctIndex
                      winnerName = names[correctIndex]
                      console.log('✅ Found correct name by ticket:', {
                        oldName: names[targetWinnerIndex],
                        newName: winnerName,
                        ticket: winnerTicket,
                        oldIndex: targetWinnerIndex,
                        newIndex: correctIndex
                      })
                    } else {
                      // Update name to match ticket format
                      winnerName = `${cleanName} (${winnerTicket})`
                      console.log('✅ Updated name to match selected ticket:', {
                        originalName: names[targetWinnerIndex],
                        updatedName: winnerName,
                        ticket: winnerTicket
                      })
                    }
                  } else {
                    // Update name to match ticket format
                    winnerName = `${cleanName} (${winnerTicket})`
                    console.log('✅ Updated name to match selected ticket (no mapping found):', {
                      originalName: names[targetWinnerIndex],
                      updatedName: winnerName,
                      ticket: winnerTicket
                    })
                  }
                }
              }
              
              console.log('✅ Fixed winner ticket from winnerForThisSpin (SELECTED TICKET):', {
                winnerName,
                winnerTicket,
                source: 'winnerForThisSpin.ticketNumber',
                note: 'This is the ticket number that was selected by user'
              })
            } else {
              // Fallback 1: Try nameToTicketMap (mapping from original data)
              winnerTicket = nameToTicketMap[winnerName]
              if (winnerTicket) {
                winnerTicket = String(winnerTicket).trim()
                console.log('✅ Fixed winner ticket from nameToTicketMap:', {
                  winnerName,
                  winnerTicket,
                  source: 'nameToTicketMap'
                })
              } else {
                // Fallback 2: Extract from name format "Name (Ticket)" ONLY if no ticket was selected
                // This is last resort - don't use if ticket was already selected
                const nameTicketMatch = winnerName.match(/^(.+?)\s*\((\d+)\)$/)
                if (nameTicketMatch) {
                  winnerTicket = nameTicketMatch[2]
                  console.log('⚠️ Ticket extracted from name format (fallback):', {
                    originalName: winnerName,
                    cleanName: nameTicketMatch[1],
                    ticket: winnerTicket,
                    warning: 'No ticket was selected, using ticket from name format'
                  })
                } else {
                  console.warn('⚠️ No ticket found for fixed winner:', {
                    winnerName,
                    winnerForThisSpin,
                    nameToTicketMapHasName: winnerName in nameToTicketMap
                  })
                }
              }
            }
            
            // CRITICAL: Ensure winnerForThisSpin.ticketNumber is ALWAYS used if available
            // This ensures the selected ticket number is displayed, not the one from name format
            if (winnerForThisSpin && winnerForThisSpin.ticketNumber) {
              const selectedTicket = String(winnerForThisSpin.ticketNumber).trim()
              // Only override if current ticket doesn't match selected ticket
              if (winnerTicket !== selectedTicket) {
                console.log('🔄 Overriding ticket with selected ticket number:', {
                  currentTicket: winnerTicket,
                  selectedTicket: selectedTicket,
                  reason: 'Selected ticket takes priority over name format or mapping'
                })
                winnerTicket = selectedTicket
              }
            }
            } else {
            // Random spin or fixed winner not found - use calculated winner from displayedNames
            winnerName = displayedWinnerName
            finalWinnerIndex = names.indexOf(winnerName)
            if (finalWinnerIndex === -1) {
              finalWinnerIndex = selectedDisplayedIndex % names.length
              winnerName = names[finalWinnerIndex]
            }
            // Get ticket from mapping first
            winnerTicket = nameToTicketMap[winnerName]
            
            // If no ticket from mapping, try to extract from name format "Name (Ticket)"
            if (!winnerTicket || String(winnerTicket).trim() === '') {
              const nameTicketMatch = winnerName.match(/^(.+?)\s*\((\d+)\)$/)
              if (nameTicketMatch) {
                winnerTicket = nameTicketMatch[2]
                console.log('✅ Ticket extracted from name format for random winner:', {
                  name: winnerName,
                  ticket: winnerTicket
                })
              }
            }
            
            if (shouldUseFixedWinner) {
              console.warn('Fixed winner mode but targetWinnerIndex not found:', {
                targetWinnerIndex,
                shouldUseFixedWinner,
                selectedDisplayedIndex
              })
            }
          }

          // Set winner and stop spinning
          const winnerObj = { 
            name: winnerName, 
            color: winnerColor, 
            index: finalWinnerIndex,
            ticket: winnerTicket,
            spinNumber: currentSpinNumber,
            timestamp: new Date().toISOString()
          }
          setWinner(winnerObj)
          setIsSpinning(false)
          
          // Add winner to winners list
          setWinners(prevWinners => {
            const updated = [...prevWinners, winnerObj]
            // Save to localStorage
            localStorage.setItem('winnersList', JSON.stringify(updated))
            return updated
          })
          
          // Update spin count in localStorage
          localStorage.setItem('spinCount', currentSpinNumber.toString())

          // Reset ref after processing
          winnerProcessedRef.current = false

          // Grand Finale Confetti (3 bursts!)
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 2000 }

          const randomInRange = (min, max) => Math.random() * (max - min) + min

          // Burst 1: Center
          confetti({ ...defaults, particleCount: 100, origin: { y: 0.6 } })

          // Burst 2: Left (delayed)
          setTimeout(() => confetti({ ...defaults, particleCount: 50, angle: 60, origin: { x: 0, y: 0.7 } }), 200)

          // Burst 3: Right (delayed)
          setTimeout(() => confetti({ ...defaults, particleCount: 50, angle: 120, origin: { x: 1, y: 0.7 } }), 400)

          playFanfare()

          // Wait 1 second after wheel stops, then show pop-up
          // Wheel remains frozen during this time and until pop-up is closed
          setTimeout(() => {
            // Calculate wheel container center position for popup alignment
            if (wheelContainerRef.current) {
              const rect = wheelContainerRef.current.getBoundingClientRect()
              const centerX = rect.left + rect.width / 2
              const centerY = rect.top + rect.height / 2
              setPopupPosition({
                top: `${centerY}px`,
                left: `${centerX}px`,
                transform: 'translate(-50%, -50%)'
              })
            }
            setShowWinner(true)
          }, 1000)
        }
      }
    }

    // Start animation immediately
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [isSpinning, names, displayedNames, finalRotation, settings.spinTime, selectedSpinFile, spinMode, spinModes, spinCount])

  const handleWheelClick = () => {
    // Prevent clicking when spinning or showing winner, but keep normal cursor
    if (!isSpinning && !showWinner) {
      spinWheel()
    }
  }

  const handleCloseWinner = () => {
    setShowWinner(false)
    // Unfreeze wheel - slow rotation can resume
    isFrozenRef.current = false
    setWinner(null)
    // Clear fixed winner name so batches can rotate normally until next spin
    setFixedWinnerName(null)
    
    // Automatically move to next file after spin completes
    moveToNextFile()
  }
  
  // Function to move to the next file in rotation
  const moveToNextFile = () => {
    try {
      // Get all active files
      const files = getActiveFiles()
      
      if (files.length === 0) {
        console.log('No files available for rotation')
        return
      }
      
      // If only one file, stay on it
      if (files.length === 1) {
        console.log('Only one file available, staying on current file')
        return
      }
      
      // Calculate next file index (cycle through)
      setCurrentFileIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % files.length
        
        // Get next file
        const nextFile = files[nextIndex]
        
        if (nextFile) {
          console.log('🔄 Rotating to next file:', {
            currentIndex: prevIndex,
            nextIndex: nextIndex,
            filename: nextFile.filename || nextFile.name,
            totalFiles: files.length,
            hasPicture: !!nextFile.picture,
            pictureLength: nextFile.picture ? nextFile.picture.length : 0
          })
          
          // Use setTimeout to ensure state is updated before loading next file
          setTimeout(() => {
            handleSelectSpinFile(nextFile)
          }, 100)
        }
        
        return nextIndex
      })
    } catch (error) {
      console.error('Error moving to next file:', error)
    }
  }

  const handleRemoveWinner = () => {
    if (winner) {
      // Remove winner by TICKET NUMBER if available, otherwise by name (if unique)
      const winnerTicket = winner.ticket
      const winnerName = winner.name
      
      // Check if ticket exists and is valid
      const hasValidTicket = winnerTicket && 
                            winnerTicket !== winnerName && 
                            String(winnerTicket).trim() !== String(winnerName).trim() &&
                            String(winnerTicket).trim() !== ''
      
      // If no valid ticket, check if name is unique (for dummy/manual data)
      if (!hasValidTicket) {
        // Count how many times this name appears
        const nameCount = names.filter(name => {
          // Extract base name if in "Name (Ticket)" format
          const baseNameMatch = name.match(/^(.+?)\s*\(\d+\)$/)
          const baseName = baseNameMatch ? baseNameMatch[1].trim() : name.trim()
          const winnerBaseName = winnerName.match(/^(.+?)\s*\(\d+\)$/)
            ? winnerName.match(/^(.+?)\s*\(\d+\)$/)[1].trim()
            : winnerName.trim()
          return baseName.toLowerCase() === winnerBaseName.toLowerCase()
        }).length
        
        // If name appears only once, safe to remove by name
        if (nameCount === 1) {
          console.log('Removing winner by name (unique name, no ticket):', { winnerName })
          const updatedNames = names.filter(name => {
            const baseNameMatch = name.match(/^(.+?)\s*\(\d+\)$/)
            const baseName = baseNameMatch ? baseNameMatch[1].trim() : name.trim()
            const winnerBaseName = winnerName.match(/^(.+?)\s*\(\d+\)$/)
              ? winnerName.match(/^(.+?)\s*\(\d+\)$/)[1].trim()
              : winnerName.trim()
            return baseName.toLowerCase() !== winnerBaseName.toLowerCase()
          })
          setNames(updatedNames)
          
          // Update textarea
          const lines = namesText.split('\n').filter(line => {
            const lineName = line.trim()
            if (!lineName) return true
            const baseNameMatch = lineName.match(/^(.+?)\s*\(\d+\)$/)
            const baseName = baseNameMatch ? baseNameMatch[1].trim() : lineName.trim()
            const winnerBaseName = winnerName.match(/^(.+?)\s*\(\d+\)$/)
              ? winnerName.match(/^(.+?)\s*\(\d+\)$/)[1].trim()
              : winnerName.trim()
            return baseName.toLowerCase() !== winnerBaseName.toLowerCase()
          })
      setNamesText(lines.join('\n'))
          
          // Dispatch event for admin panel
          window.dispatchEvent(new CustomEvent('winnerRemoved', {
            detail: { winnerName, winnerTicket: null }
          }))
          
          setShowWinner(false)
          setWinner(null)
          return
        } else {
          // Name appears multiple times - can't safely remove without ticket
          alert(`Cannot remove winner: This name appears ${nameCount} times. Ticket number is required to remove a specific entry.`)
          return
        }
      }
      
      const normalizedWinnerTicket = String(winnerTicket).trim()
      
      console.log('Removing winner by ticket:', { 
        winnerName: winner.name, 
        winnerTicket: normalizedWinnerTicket
      })
      
      // Remove from names array by matching ticket number ONLY
      // CRITICAL: Only remove ONE entry, even if multiple entries have the same ticket
      let removedCount = 0
      let finalNames = null // Will hold the final filtered array
      let removedIndex = -1 // Track which index was removed to prevent multiple removals
      
      // First, try to find the index of the entry to remove using ticketToIndexMap (fastest)
      const ticketIndex = ticketToIndexMap[normalizedWinnerTicket]
      if (ticketIndex !== undefined && ticketIndex >= 0 && ticketIndex < names.length) {
        // Verify the ticket matches at this index
        const nameAtIndex = names[ticketIndex]
        let nameTicket = nameToTicketMap[nameAtIndex]
        
        // If no mapping, try to extract ticket from "Name (Ticket)" format
        if (!nameTicket || nameTicket === nameAtIndex) {
          const ticketMatch = nameAtIndex.match(/^(.+?)\s*\((\d+)\)$/)
          if (ticketMatch) {
            nameTicket = ticketMatch[2]
          }
        }
        
        // Verify ticket matches before removing
        if (nameTicket && nameTicket !== nameAtIndex && String(nameTicket).trim() === normalizedWinnerTicket) {
          finalNames = names.filter((name, idx) => idx !== ticketIndex)
          removedCount = 1
          removedIndex = ticketIndex
        }
      }
      
      // If ticketToIndexMap didn't work, try filtering by ticket
      if (removedCount === 0) {
        // Find the FIRST index that matches the ticket
        const matchingIndex = names.findIndex((name, index) => {
        // First try to get ticket from mapping
        let nameTicket = nameToTicketMap[name]
        
        // If no mapping, try to extract ticket from "Name (Ticket)" format
        if (!nameTicket || nameTicket === name) {
          const ticketMatch = name.match(/^(.+?)\s*\((\d+)\)$/)
          if (ticketMatch) {
            nameTicket = ticketMatch[2]
          }
        }
        
          // Only match if ticket number exists and matches exactly
        if (nameTicket && nameTicket !== name && String(nameTicket).trim() !== String(name).trim()) {
          const normalizedNameTicket = String(nameTicket).trim()
            return normalizedNameTicket === normalizedWinnerTicket
          }
          
          return false
        })
        
        if (matchingIndex !== -1) {
          finalNames = names.filter((name, idx) => idx !== matchingIndex)
          removedCount = 1
          removedIndex = matchingIndex
        }
      }
      
      // If we still haven't found a match, try exact name match as last resort (only if name is unique)
      if (removedCount === 0) {
          const exactNameMatch = names.findIndex(name => name === winner.name)
          if (exactNameMatch !== -1) {
          // Check if name is unique before removing
          const nameOccurrences = names.filter(name => name === winner.name).length
          if (nameOccurrences === 1) {
            finalNames = names.filter((name, idx) => idx !== exactNameMatch)
            removedCount = 1
            removedIndex = exactNameMatch
          } else {
            alert(`Cannot remove winner: Ticket number "${normalizedWinnerTicket}" not found, and name "${winner.name}" appears ${nameOccurrences} times.`)
            return
          }
          } else {
            alert(`Cannot remove winner: Ticket number "${normalizedWinnerTicket}" not found in entries.`)
            return
        }
      }
      
      // Only set names once with the final filtered array
      if (finalNames !== null) {
      console.log(`Successfully removed ${removedCount} entry/entries with ticket "${normalizedWinnerTicket}"`)
        setNames(finalNames)
      }
      
      // Update textarea - remove ONLY ONE line that matches the ticket
      // CRITICAL: Only remove the FIRST matching line to prevent multiple removals
      let textareaRemovedCount = 0
      let textareaRemovedOnce = false // Track if we've already removed one line
      const lines = namesText.split('\n').filter(line => {
        // If we've already removed one line, keep all remaining lines
        if (textareaRemovedOnce) {
          return true
        }
        
        const lineName = line.trim()
        if (!lineName) return true // Keep empty lines
        
        const lineTicket = nameToTicketMap[lineName]
        
        // Only remove if ticket number exists, is different from name, and matches exactly
        if (lineTicket && lineTicket !== lineName && String(lineTicket).trim() !== String(lineName).trim()) {
          const normalizedLineTicket = String(lineTicket).trim()
          const shouldRemove = normalizedLineTicket === normalizedWinnerTicket
          if (shouldRemove && !textareaRemovedOnce) {
            textareaRemovedCount++
            textareaRemovedOnce = true // Mark that we've removed one line
            console.log('Removing line from textarea by ticket match:', { lineName, lineTicket, winnerTicket: normalizedWinnerTicket })
            return false // Remove this line
          }
        }
        
        // If no ticket mapping OR ticket equals name, keep the line (don't remove by name)
        return true
      })
      
      console.log(`Removed ${textareaRemovedCount} line(s) from textarea`)
      setNamesText(lines.join('\n'))
      
      // Update ticket mapping - remove entries with matching ticket
      const updatedMap = { ...nameToTicketMap }
      Object.keys(updatedMap).forEach(name => {
        const ticket = String(updatedMap[name]).trim()
        if (ticket === normalizedWinnerTicket) {
          console.log('Removing from ticket map:', { name, ticket })
          delete updatedMap[name]
        }
      })
      setNameToTicketMap(updatedMap)

      // Dispatch event to notify AdminPanel to remove winner from entries list
      console.log('App: Dispatching winnerRemoved event', { 
        winnerName: winner.name, 
        winnerTicket: winner.ticket,
        winner: winner
      })
      
      // Create event with proper detail - ONLY send ticket number (not name as fallback)
      const eventDetail = { 
        winnerName: winner.name,
        winnerTicket: winner.ticket // ONLY ticket number, no fallback to name
      }
      
      if (!eventDetail.winnerTicket) {
        console.warn('Cannot dispatch winnerRemoved event: No ticket number available')
        return
      }
      
      // Dispatch on window
      const windowEvent = new CustomEvent('winnerRemoved', { 
        detail: eventDetail,
        bubbles: true,
        cancelable: true
      })
      window.dispatchEvent(windowEvent)
      
      // Also dispatch on document
      const docEvent = new CustomEvent('winnerRemoved', { 
        detail: eventDetail,
        bubbles: true,
        cancelable: true
      })
      document.dispatchEvent(docEvent)
      
      console.log('App: Event dispatched on both window and document', eventDetail)

      setShowWinner(false)
      // Unfreeze wheel - slow rotation can resume
      isFrozenRef.current = false
      setWinner(null)
    }
  }

  const clearResults = () => {
    setResults([])
  }

  const sortResults = () => {
    const sorted = [...results].sort((a, b) => {
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })
    setResults(sorted)
  }

  const handleNew = () => {
    // Reset everything
    setNames(['Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'])
    setNamesText('Ali\nBeatriz\nCharles\nDiya\nEric\nFatima\nGabriel\nHanna')
    setResults([])
    setActiveTab('entries')
    setFinalRotation(0)
    setIsSpinning(false)
    setShowWinner(false)
    setWinner(null)
    setIsSidebarHidden(false)
    setSelectedSpinFile(null)
    setNameToTicketMap({})
    winnerProcessedRef.current = false
    isFrozenRef.current = false
    setSpinCount(0)
    setSpinMode('random')
    setSpinModes({})
  }

  // Load spin files from backend API only
  useEffect(() => {
    const loadSpinFiles = async () => {
      try {
        setLoadingSpinFiles(true)
        const backendFiles = await getSpinFiles()
        if (backendFiles && Array.isArray(backendFiles)) {
          const files = backendFiles.filter(f => f.active !== false) // Filter active files
          setSpinFiles(files)
          
          // If files are available and no file is currently selected, select the first one
          if (files.length > 0 && !selectedSpinFile) {
            const firstFile = files[0]
            setCurrentFileIndex(0)
            handleSelectSpinFile(firstFile)
          } else if (files.length > 0 && selectedSpinFile) {
            // If a file is already selected, find its index
            const currentIndex = files.findIndex(f => f.id === selectedSpinFile.id)
            if (currentIndex !== -1) {
              setCurrentFileIndex(currentIndex)
            }
          } else if (files.length === 0) {
            // If no files available, set dummy data only if names array is empty
            setNames(prevNames => {
              if (prevNames.length === 0) {
                const dummyNames = ['Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna']
                setNamesText(dummyNames.join('\n'))
                return dummyNames
              }
              return prevNames
            })
          }
        } else {
          setSpinFiles([])
          // If no files, set dummy data only if names array is empty
          setNames(prevNames => {
            if (prevNames.length === 0) {
              const dummyNames = ['Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna']
              setNamesText(dummyNames.join('\n'))
              return dummyNames
            }
            return prevNames
          })
        }
      } catch (error) {
        console.error('Failed to load spin files from backend:', error)
        setSpinFiles([])
        // If error, set dummy data only if names array is empty
        setNames(prevNames => {
          if (prevNames.length === 0) {
            const dummyNames = ['Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna']
            setNamesText(dummyNames.join('\n'))
            return dummyNames
          }
          return prevNames
        })
        // Don't show alert if it's just empty response (no files uploaded yet)
        if (error.message && !error.message.includes('Cannot connect')) {
          console.warn('Backend returned error, but continuing with empty files list')
        }
      } finally {
        setLoadingSpinFiles(false)
      }
    }
    loadSpinFiles()
  }, [])
  
  // Listen for reset all events from admin panel
  useEffect(() => {
    const handleResetAllWinners = () => {
      console.log('App: Resetting all winners')
      setWinners([])
      localStorage.removeItem('winnersList')
    }
    
    const handleResetWheel = async () => {
      console.log('App: Resetting wheel')
      // Reset names to default
      setNames(['Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'])
      setNamesText('Ali\nBeatriz\nCharles\nDiya\nEric\nFatima\nGabriel\nHanna')
      setResults([])
      setSelectedSpinFile(null)
      setNameToTicketMap({})
      setNameToIndexMap({})
      setTicketToNameMap({})
      setTicketToIndexMap({})
      setFinalRotation(0)
      setIsSpinning(false)
      setShowWinner(false)
      setWinner(null)
      setIsSidebarHidden(false)
      setSpinCount(0)
      localStorage.setItem('spinCount', '0')
      
      // Reload files list to reflect deletions
      try {
        const backendFiles = await getSpinFiles()
        if (backendFiles && Array.isArray(backendFiles)) {
          const activeFiles = backendFiles.filter(f => f.active !== false)
          setSpinFiles(activeFiles)
        } else {
          setSpinFiles([])
        }
      } catch (error) {
        console.error('Failed to reload files after reset:', error)
        setSpinFiles([])
      }
    }
    
    // Handle file deletion - remove entries from wheel that belong to deleted file
    const handleFileDeleted = async (event) => {
      const { fileId } = event.detail || {}
      if (!fileId) return
      
      console.log('App: File deleted, removing entries from wheel:', { fileId })
      
      // Reload all files from backend and merge entries from remaining files
      try {
        const backendFiles = await getSpinFiles()
        if (backendFiles && Array.isArray(backendFiles)) {
          const activeFiles = backendFiles.filter(f => f.active !== false && f.id !== fileId)
          setSpinFiles(activeFiles)
          
          // If there are active files remaining, merge their entries
          if (activeFiles.length > 0) {
            // Use the same logic as handleFileUploaded to merge all files
            const allEntries = []
            const nameToOriginalItemMap = {}
            const ticketMap = {}
            const ticketNameMap = {}
            const ticketIndexMap = {}
            const indexMap = {}
            
            // Get removed entries to filter them out
            const getRemovedEntries = () => {
              try {
                const removed = localStorage.getItem('removedEntries')
                return removed ? JSON.parse(removed) : []
              } catch (e) {
                return []
              }
            }
            const normalize = (str) => String(str || '').trim().toLowerCase()
            const removedEntries = getRemovedEntries()
            
            // Process each active file (same logic as handleFileUploaded)
            activeFiles.forEach((file, fileIndex) => {
              if (file.json_content && Array.isArray(file.json_content)) {
                file.json_content.forEach((item, idx) => {
                  const globalIndex = allEntries.length
                  
                  // Extract name and ticket (same logic as handleSelectSpinFile)
                  let formattedName = ''
                  let ticketNumber = ''
                  
                  if (typeof item === 'string') {
                    formattedName = item.trim() || `Entry ${globalIndex + 1}`
                    const ticketMatch = formattedName.match(/^(.+?)\s*\((\d+)\)$/)
                    if (ticketMatch) {
                      ticketNumber = ticketMatch[2]
                    }
                  } else if (typeof item === 'object' && item !== null) {
                    // Extract ticket number
                    ticketNumber = item['Ticket Number'] || 
                                  item['ticket number'] || 
                                  item['ticketNumber'] || 
                                  item['Ticket'] || 
                                  item['ticket'] ||
                                  item['Ticket No'] ||
                                  item['ticket no'] ||
                                  item['TicketNo'] ||
                                  item['Ticket #'] ||
                                  item['ticket #'] ||
                                  item['Ticket#'] ||
                                  item['Ticket ID'] ||
                                  item['ticket id'] ||
                                  item['TicketId'] ||
                                  ''
                    
                    // Search all keys for ticket
                    if (!ticketNumber || String(ticketNumber).trim() === '') {
                      for (const key of Object.keys(item)) {
                        if (key.toLowerCase().includes('ticket')) {
                          const value = item[key]
                          if (value && String(value).trim() !== '') {
                            ticketNumber = value
                            break
                          }
                        }
                      }
                    }
                    
                    // Extract name
                    const firstName = item['First Name'] || item['first name'] || item['firstName'] || ''
                    const lastName = item['Last Name'] || item['last name'] || item['lastName'] || ''
                    let displayName = ''
                    
                    if (firstName && lastName) {
                      displayName = `${firstName} ${lastName}`.trim()
                    } else if (firstName) {
                      displayName = String(firstName).trim()
                    } else if (lastName) {
                      displayName = String(lastName).trim()
                    }
                    
                    // Format as "Name (Ticket)" if ticket exists
                    if (ticketNumber && String(ticketNumber).trim() !== '') {
                      formattedName = displayName ? `${displayName} (${String(ticketNumber).trim()})` : String(ticketNumber).trim()
                    } else {
                      formattedName = displayName || `Entry ${globalIndex + 1}`
                    }
                  } else {
                    formattedName = String(item).trim() || `Entry ${globalIndex + 1}`
                  }
                  
                  // Check if entry is removed (by ticket number)
                  const entryTicket = ticketNumber ? normalize(ticketNumber) : null
                  let isRemoved = false
                  if (entryTicket && entryTicket !== normalize(formattedName)) {
                    isRemoved = removedEntries.some(removed => {
                      const removedTicket = normalize(removed.ticket || removed.originalTicket)
                      return removedTicket && removedTicket !== '' && entryTicket === removedTicket
                    })
                  }
                  
                  // Only add if not removed
                  if (!isRemoved) {
                    allEntries.push(formattedName)
                    const uniqueKey = `${formattedName}-${globalIndex}`
                    nameToOriginalItemMap[uniqueKey] = item
                    
                    // Create mappings
                    const finalTicket = ticketNumber ? String(ticketNumber).trim() : ''
                    if (finalTicket) {
                      ticketMap[formattedName] = finalTicket
                      ticketNameMap[finalTicket] = formattedName
                      ticketIndexMap[finalTicket] = globalIndex
                    }
                    indexMap[formattedName] = globalIndex
                  }
                })
              }
            })
            
            // Update wheel with merged entries from remaining files
            setNames(allEntries)
            setNamesText(allEntries.join('\n'))
            setNameToTicketMap(ticketMap)
            setNameToIndexMap(indexMap)
            setTicketToNameMap(ticketNameMap)
            setTicketToIndexMap(ticketIndexMap)
            
            console.log('App: Wheel updated after file deletion:', {
              remainingFiles: activeFiles.length,
              totalEntries: allEntries.length
            })
          } else {
            // No files remaining, reset to dummy data
            setNames(['Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'])
            setNamesText('Ali\nBeatriz\nCharles\nDiya\nEric\nFatima\nGabriel\nHanna')
            setNameToTicketMap({})
            setNameToIndexMap({})
            setTicketToNameMap({})
            setTicketToIndexMap({})
            setSelectedSpinFile(null)
          }
        } else {
          setSpinFiles([])
        }
      } catch (error) {
        console.error('Failed to reload files after deletion:', error)
      }
    }
    
    window.addEventListener('resetAllWinners', handleResetAllWinners)
    document.addEventListener('resetAllWinners', handleResetAllWinners)
    window.addEventListener('resetWheel', handleResetWheel)
    document.addEventListener('resetWheel', handleResetWheel)
    window.addEventListener('fileDeleted', handleFileDeleted)
    document.addEventListener('fileDeleted', handleFileDeleted)
    
    return () => {
      window.removeEventListener('resetAllWinners', handleResetAllWinners)
      document.removeEventListener('resetAllWinners', handleResetAllWinners)
      window.removeEventListener('resetWheel', handleResetWheel)
      document.removeEventListener('resetWheel', handleResetWheel)
      window.removeEventListener('fileDeleted', handleFileDeleted)
      document.removeEventListener('fileDeleted', handleFileDeleted)
    }
  }, [])

  // Debug: Log when names state changes
  useEffect(() => {
    console.log('🔄 Names state updated:', {
      namesLength: names.length,
      sampleNames: names.slice(0, 5),
      selectedFile: selectedSpinFile?.filename || selectedSpinFile?.name || 'none'
    })
  }, [names, selectedSpinFile])
  
  // Listen for spin mode updates from admin panel
  useEffect(() => {
    const handleSpinModeUpdate = () => {
      const savedSpinModes = localStorage.getItem('spinModes')
      if (savedSpinModes) {
        try {
          setSpinModes(JSON.parse(savedSpinModes))
        } catch (e) {
          console.error('Failed to parse spinModes:', e)
        }
      }
    }
    
    // Listen for spin count reset
    const handleSpinCountReset = () => {
      const savedCount = localStorage.getItem('spinCount')
      setSpinCount(savedCount ? parseInt(savedCount, 10) : 0)
    }
    
    window.addEventListener('spinModeUpdated', handleSpinModeUpdate)
    window.addEventListener('spinCountReset', handleSpinCountReset)
    return () => {
      window.removeEventListener('spinModeUpdated', handleSpinModeUpdate)
      window.removeEventListener('spinCountReset', handleSpinCountReset)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showOpenDropdown && !event.target.closest('.header-btn-dropdown-container')) {
        setShowOpenDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOpenDropdown])

  // Handle spin file selection
  const handleSelectSpinFile = (spinFile) => {
    console.log('🔄 handleSelectSpinFile called:', {
      fileId: spinFile?.id,
      filename: spinFile?.filename || spinFile?.name,
      hasJsonContent: !!spinFile?.json_content,
      jsonContentType: Array.isArray(spinFile?.json_content) ? 'array' : typeof spinFile?.json_content,
      jsonContentLength: spinFile?.json_content?.length || 0,
      hasPicture: !!spinFile?.picture
    })
    
    // Clear fixed batch ref when selecting a new file so wheel can update with new entries
    fixedBatchRef.current = null
    randomBatchRef.current = null
    
    setSelectedSpinFile(spinFile)
    
    // Set center image from the file's picture property (always update to match current file)
    // Force update the center image to match the current file
    if (spinFile.picture && String(spinFile.picture).trim() !== '') {
      const pictureData = String(spinFile.picture).trim()
      console.log('Setting center image from file:', {
        filename: spinFile.filename || spinFile.name,
        pictureLength: pictureData.length,
        picturePreview: pictureData.substring(0, 50) + '...'
      })
      setCenterImage(pictureData)
      localStorage.setItem('centerImage', pictureData)
    } else {
      // If file doesn't have a picture, clear the center image to match the file
      console.log('File has no center image, clearing center image:', {
        filename: spinFile.filename || spinFile.name,
        hasPicture: !!spinFile.picture
      })
      setCenterImage(null)
      localStorage.removeItem('centerImage')
    }
    // Extract names from json_content and store mapping for winner matching
    if (spinFile.json_content && Array.isArray(spinFile.json_content)) {
      console.log('✅ Processing json_content array with', spinFile.json_content.length, 'entries')
      // No warning - allow all entries
      
      // Debug: Log first item to see structure
      if (spinFile.json_content.length > 0) {
        console.log('Excel data structure:', spinFile.json_content[0])
        console.log('All keys:', Object.keys(spinFile.json_content[0] || {}))
      }
      
      // Process ALL entries (no limit) - user wants all entries from Excel
      const contentToProcess = spinFile.json_content
      
      // Performance: Only log if needed (disabled for production)
      // console.log('📊 Processing Excel file:', { totalEntries: contentToProcess.length })
      
      // Get removed entries from localStorage to filter them out
      const getRemovedEntries = () => {
        try {
          const removed = localStorage.getItem('removedEntries')
          return removed ? JSON.parse(removed) : []
        } catch (e) {
          return []
        }
      }
      const normalize = (str) => String(str || '').trim().toLowerCase()
      const removedEntries = getRemovedEntries()
      
      // Performance: Only log if needed
      // console.log('🗑️ Removed entries count:', removedEntries.length)
      
      // Extract names keeping ALL entries (including duplicates), keeping track of original items
      const nameToOriginalItemMap = {} // Map name+index to original item (handles duplicates)
      const extractedNames = contentToProcess.map((item, index) => {
        // If item is already a string, check if it's in "Name (Ticket)" format
        if (typeof item === 'string') {
          let name = item.trim()
          // If name is empty, use index to ensure ALL entries are included
          if (!name || name.length === 0) {
            name = `Entry ${index + 1}`
          }
          // Check if already in "Name (Ticket)" format
          const ticketMatch = name.match(/^(.+?)\s*\((\d+)\)$/)
          if (ticketMatch) {
            const uniqueKey = `${name}-${index}`
            nameToOriginalItemMap[uniqueKey] = item
            return name // Already formatted
          }
          // Use index to handle duplicates - each entry gets unique mapping key
          const uniqueKey = `${name}-${index}`
          nameToOriginalItemMap[uniqueKey] = item
          return name
        }
        
        // If item is an object, try to find a meaningful value
        if (typeof item === 'object' && item !== null) {
          // Get ticket number first - try multiple field names and variations
          // Try common variations of ticket number field names
          let ticketNumber = ''
          const allKeys = Object.keys(item)
          
          // Try exact matches first
          ticketNumber = item['Ticket Number'] || 
                        item['ticket number'] || 
                        item['ticketNumber'] || 
                        item['Ticket'] || 
                        item['ticket'] ||
                        item['Ticket No'] ||
                        item['ticket no'] ||
                        item['TicketNo'] ||
                        item['Ticket #'] ||
                        item['ticket #'] ||
                        item['Ticket#'] ||
                        item['Ticket ID'] ||
                        item['ticket id'] ||
                        item['TicketId'] ||
                        ''
          
          // If not found, search through all keys for ticket-related fields (case-insensitive)
          if (!ticketNumber || String(ticketNumber).trim() === '') {
            for (const key of allKeys) {
              const keyLower = key.toLowerCase().trim()
              // Check if key contains "ticket"
              if (keyLower.includes('ticket')) {
                const value = item[key]
                if (value && String(value).trim() !== '') {
                  ticketNumber = value
                  console.log(`Found ticket number in field "${key}":`, ticketNumber)
                  break
                }
              }
            }
          }
          
          // Debug: Log ticket number extraction for first few items
          if (index < 5) {
            console.log('🎫 Ticket extraction:', {
              index,
              ticketNumber,
              ticketNumberFound: ticketNumber && String(ticketNumber).trim() !== '',
              itemKeys: allKeys,
              allItemValues: Object.entries(item).slice(0, 5).map(([k, v]) => ({ key: k, value: v })),
              firstName: item['First Name'] || item['first name'] || '',
              lastName: item['Last Name'] || item['last name'] || ''
            })
          }
          
          // Check for "First Name" and "Last Name" combination
          const firstName = item['First Name'] || item['first name'] || item['firstName'] || item['First Name'] || ''
          const lastName = item['Last Name'] || item['last name'] || item['lastName'] || item['Last Name'] || ''
          
          let displayName = ''
          
          // If both first and last name exist, combine them
          if (firstName && lastName) {
            displayName = `${firstName} ${lastName}`.trim()
          } else if (firstName) {
            displayName = String(firstName).trim()
          } else if (lastName) {
            displayName = String(lastName).trim()
          }
          
          // Format as "Name (Ticket)" if ticket exists, otherwise just name
          let formattedName = displayName
          if (ticketNumber && String(ticketNumber).trim() !== '') {
            if (displayName) {
              formattedName = `${displayName} (${String(ticketNumber).trim()})`
            } else {
              // If no name, use ticket as name
              formattedName = String(ticketNumber).trim()
            }
          } else if (!displayName) {
            // If no name and no ticket, use index as fallback to ensure ALL entries are included
            // This ensures every row from Excel is processed, even if empty
            formattedName = `Entry ${index + 1}`
          }
          
          // CRITICAL: Ensure formattedName is never empty - use index as last resort
          if (!formattedName || formattedName.trim().length === 0) {
            formattedName = `Entry ${index + 1}`
          }
          
          // Use index to handle duplicates - each entry gets unique mapping key
          const uniqueKey = `${formattedName}-${index}`
          nameToOriginalItemMap[uniqueKey] = item
          return formattedName
        }
        
        // Last resort: if item is not string or object
        let name = String(item).trim()
        // If name is empty, use index to ensure ALL entries are included
        if (!name || name.length === 0) {
          name = `Entry ${index + 1}`
        }
        const uniqueKey = `${name}-${index}`
        nameToOriginalItemMap[uniqueKey] = item
        return name
      })
      // REMOVED: Don't filter out empty names - use index as fallback instead
      // This ensures ALL entries from Excel are processed
      
      // Create mappings: name -> ticket number, name -> index, ticket -> name, ticket -> index
      const ticketMap = {}
      const indexMap = {}
      const ticketNameMap = {}
      const ticketIndexMap = {} // Fast lookup: ticket -> index in names array
      
      extractedNames.forEach((name, idx) => {
        // Use index-based unique key to get original item (handles duplicates)
        const uniqueKey = `${name}-${idx}`
        const originalItem = nameToOriginalItemMap[uniqueKey] || nameToOriginalItemMap[name]
        
        if (originalItem && typeof originalItem === 'object') {
          // CRITICAL: Extract ticket number from ORIGINAL ITEM, not from formatted name
          // The formatted name "Name (324)" might have a different number than actual ticket
          // Try multiple field names to find the actual ticket number
          let ticketNumber = originalItem['Ticket Number'] || 
                               originalItem['ticket number'] || 
                               originalItem['ticketNumber'] || 
                               originalItem['Ticket'] || 
                               originalItem['ticket'] ||
                               originalItem['Ticket No'] ||
                               originalItem['ticket no'] ||
                               originalItem['TicketNo'] ||
                            originalItem['Ticket #'] ||
                            originalItem['ticket #'] ||
                            originalItem['Ticket#'] ||
                            originalItem['Ticket ID'] ||
                            originalItem['ticket id'] ||
                            originalItem['TicketId'] ||
                            ''
          
          // If not found, search through all keys for ticket-related fields (case-insensitive)
          if (!ticketNumber || String(ticketNumber).trim() === '') {
            const allKeys = Object.keys(originalItem)
            for (const key of allKeys) {
              const keyLower = key.toLowerCase().trim()
              // Check if key contains "ticket"
              if (keyLower.includes('ticket')) {
                const value = originalItem[key]
                if (value && String(value).trim() !== '') {
                  ticketNumber = value
                  break
                }
              }
            }
          }
          
          // Debug: Log ticket mapping for entries that match winner name pattern
          const nameMatch = name.match(/^(.+?)\s*\((\d+)\)$/)
          if (nameMatch && idx < 10) {
            console.log('🎫 Ticket mapping check:', {
              name,
              formattedTicket: nameMatch[2],
              actualTicket: ticketNumber,
              match: String(ticketNumber).trim() === nameMatch[2],
              itemKeys: Object.keys(originalItem).slice(0, 10)
            })
          }
          
          // CRITICAL: Always extract ticket number - prioritize from original item, then from formatted name
          let finalTicket = null
          
          // First priority: Get ticket from original item
          if (ticketNumber && String(ticketNumber).trim() !== '' && String(ticketNumber).trim() !== String(name).trim()) {
            finalTicket = String(ticketNumber).trim()
          } else {
            // Second priority: Extract ticket from formatted name "Name (Ticket)"
            const ticketMatch = name.match(/^(.+?)\s*\((\d+)\)$/)
            if (ticketMatch) {
              finalTicket = ticketMatch[2]
            }
          }
          
          // ALWAYS store ticket if found (even if it matches name format)
          // This ensures ticket-based identification works correctly
          if (finalTicket) {
            ticketMap[name] = finalTicket
            ticketNameMap[finalTicket] = name
            ticketIndexMap[finalTicket] = idx // Fast lookup for removal
            
            console.log('🎫 Ticket mapped:', {
              name,
              ticket: finalTicket,
              index: idx,
              source: ticketNumber ? 'originalItem' : 'formattedName'
            })
          } else {
            console.warn('⚠️ No ticket found for entry:', {
              name,
              index: idx,
              hasTicketNumber: !!ticketNumber,
              ticketNumberValue: ticketNumber
            })
          }
          // Always store index mapping
          indexMap[name] = idx
        } else {
          // No original item - try to extract ticket from "Name (Ticket)" format
          const ticketMatch = name.match(/^(.+?)\s*\((\d+)\)$/)
          if (ticketMatch) {
            const extractedTicket = ticketMatch[2]
            ticketMap[name] = extractedTicket
            ticketNameMap[extractedTicket] = name
            ticketIndexMap[extractedTicket] = idx // Fast lookup for removal
          }
          indexMap[name] = idx
        }
      })
      
      // Store ticket-to-index map for fast removal
      setTicketToIndexMap(ticketIndexMap)
      
      // Now filter out removed entries AFTER we have ticket mappings
      // Filter BY TICKET NUMBER ONLY (not by name, because same name can have multiple entries)
      const finalNames = extractedNames.filter((name, idx) => {
        const ticketNumber = ticketMap[name]
        
        // Only check removal if ticket number exists and is different from name
        // Don't use name as fallback - this prevents removing all entries with same name
        if (!ticketNumber || ticketNumber === name) {
          // If no ticket mapping or ticket equals name, keep the entry (can't match by ticket)
          return true
        }
        
        const normalizedTicket = normalize(ticketNumber)
        
        // Check if this entry is in the removed list BY TICKET NUMBER ONLY
        const isRemoved = removedEntries.some(removed => {
          const removedTicket = normalize(removed.ticket || removed.originalTicket)
          // Match ONLY by ticket number (not by name)
          return normalizedTicket && removedTicket && normalizedTicket === removedTicket
        })
        
        if (isRemoved) {
          console.log('Filtering out removed entry by ticket:', { name, ticketNumber })
          return false
        }
        
        return true
      })
      
      // Update mappings to only include non-removed entries
      const finalTicketMap = {}
      const finalIndexMap = {}
      const finalTicketNameMap = {}
      
      finalNames.forEach((name, idx) => {
        // ONLY store ticket if it exists and is different from name
        // Don't use name as fallback - this prevents removing all entries with same name
        const ticket = ticketMap[name]
        if (ticket && ticket !== name) {
          finalTicketMap[name] = ticket
          finalTicketNameMap[ticket] = name
        }
        // Always store index mapping
        finalIndexMap[name] = idx
      })
      
      console.log('✅ Final entries processed:', {
        totalInExcel: contentToProcess.length,
        extractedEntries: extractedNames.length,
        removedEntries: removedEntries.length,
        finalEntriesOnWheel: finalNames.length,
        ticketMappings: Object.keys(finalTicketMap).length,
        sampleEntries: finalNames.slice(0, 5),
        difference: contentToProcess.length - finalNames.length,
        differenceReason: removedEntries.length > 0 ? `${removedEntries.length} removed entries` : 'none'
      })
      
      // Alert if significant difference
      if (contentToProcess.length !== finalNames.length && removedEntries.length === 0) {
        console.warn('⚠️ Entry count mismatch:', {
          excelEntries: contentToProcess.length,
          wheelEntries: finalNames.length,
          difference: contentToProcess.length - finalNames.length,
          possibleCause: 'Empty entries or filtering issue'
        })
      }
      
      setNameToTicketMap(finalTicketMap)
      setNameToIndexMap(finalIndexMap)
      setTicketToNameMap(finalTicketNameMap)
      
      // CRITICAL: Update state to show entries on wheel
      console.log('📝 Setting names state:', {
        finalNamesLength: finalNames.length,
        sampleNames: finalNames.slice(0, 10),
        willUpdateNames: finalNames.length > 0
      })
      
      // Batch state updates for better performance
      if (finalNames.length > 0) {
        setNames(finalNames)
        // Use setTimeout to avoid blocking UI for very large lists
        if (finalNames.length > 1000) {
          setTimeout(() => {
            setNamesText(finalNames.join('\n'))
            console.log('✅ Updated namesText (async)')
          }, 0)
        } else {
          setNamesText(finalNames.join('\n'))
          console.log('✅ Updated namesText (sync)')
        }
        console.log('✅ State updated - names should now appear on wheel')
        
        // Check if file has a ticket number for fixed wheel functionality
        if (spinFile.ticketNumber && String(spinFile.ticketNumber).trim() !== '') {
          const targetTicket = String(spinFile.ticketNumber).trim()
          console.log('🎯 File has ticket number for fixed wheel:', targetTicket)
          
          // Find the entry that matches this ticket number
          let matchingEntryIndex = null
          let matchingEntryName = null
          let matchingEntryId = null
          
          // First, try to find by ticket in the finalTicketMap (fastest method)
          const matchingNameFromTicket = finalTicketNameMap[targetTicket]
          if (matchingNameFromTicket && finalIndexMap[matchingNameFromTicket] !== undefined) {
            matchingEntryIndex = finalIndexMap[matchingNameFromTicket]
            matchingEntryName = matchingNameFromTicket
            // Find the original index in contentToProcess to create entryId
            for (let i = 0; i < contentToProcess.length; i++) {
              const item = contentToProcess[i]
              if (typeof item === 'object' && item !== null) {
                const ticketNumber = item['Ticket Number'] || 
                                   item['ticket number'] || 
                                   item['ticketNumber'] || 
                                   item['Ticket'] || 
                                   item['ticket'] ||
                                   item['Ticket No'] ||
                                   item['ticket no'] ||
                                   item['TicketNo'] ||
                                   ''
                if (String(ticketNumber).trim() === targetTicket) {
                  matchingEntryId = `${spinFile.id}-${i}`
                  break
                }
              }
            }
            console.log('✅ Found matching entry for ticket (via ticket map):', {
              ticket: targetTicket,
              name: matchingEntryName,
              index: matchingEntryIndex,
              entryId: matchingEntryId
            })
          } else {
            // Fallback: Search through json_content to find matching ticket
            for (let i = 0; i < contentToProcess.length; i++) {
              const item = contentToProcess[i]
              if (typeof item === 'object' && item !== null) {
                const ticketNumber = item['Ticket Number'] || 
                                   item['ticket number'] || 
                                   item['ticketNumber'] || 
                                   item['Ticket'] || 
                                   item['ticket'] ||
                                   item['Ticket No'] ||
                                   item['ticket no'] ||
                                   item['TicketNo'] ||
                                   ''
                
                if (String(ticketNumber).trim() === targetTicket) {
                  // Found matching ticket - get the entry details
                  const firstName = item['First Name'] || item['first name'] || item['firstName'] || ''
                  const lastName = item['Last Name'] || item['last name'] || item['lastName'] || ''
                  let name = ''
                  if (firstName && lastName) {
                    name = `${firstName} ${lastName}`.trim()
                  } else if (firstName) {
                    name = String(firstName).trim()
                  } else if (lastName) {
                    name = String(lastName).trim()
                  } else if (ticketNumber) {
                    name = String(ticketNumber).trim()
                  }
                  
                  // Format name with ticket if needed
                  let formattedName = name
                  if (ticketNumber && String(ticketNumber).trim() !== '') {
                    if (name) {
                      formattedName = `${name} (${String(ticketNumber).trim()})`
                    } else {
                      formattedName = String(ticketNumber).trim()
                    }
                  }
                  
                  // Find this entry in finalNames
                  const entryId = `${spinFile.id}-${i}`
                  const nameInFinal = finalNames.find(n => {
                    // Check if name matches or if ticket is in the name
                    return n === formattedName || 
                           n === name ||
                           n.includes(`(${targetTicket})`) ||
                           (finalTicketMap[n] && String(finalTicketMap[n]).trim() === targetTicket)
                  })
                  
                  if (nameInFinal) {
                    matchingEntryIndex = finalIndexMap[nameInFinal]
                    matchingEntryName = nameInFinal
                    matchingEntryId = entryId
                    console.log('✅ Found matching entry for ticket (via search):', {
                      ticket: targetTicket,
                      name: matchingEntryName,
                      index: matchingEntryIndex,
                      entryId: matchingEntryId
                    })
                    break
                  }
                }
              }
            }
          }
          
          // If found, set as fixed winner for spin 1
          if (matchingEntryIndex !== null && matchingEntryName) {
            // Get current spin modes and selected winners
            const savedSpinModes = localStorage.getItem('spinModes')
            const savedSelectedWinners = localStorage.getItem('selectedWinners')
            
            let spinModes = {}
            let selectedWinners = []
            
            try {
              if (savedSpinModes) {
                spinModes = JSON.parse(savedSpinModes)
              }
              if (savedSelectedWinners) {
                selectedWinners = JSON.parse(savedSelectedWinners)
              }
            } catch (e) {
              console.error('Failed to parse spin modes or selected winners:', e)
            }
            
            // Set spin mode for spin 1 to "fixed"
            spinModes['1'] = 'fixed'
            localStorage.setItem('spinModes', JSON.stringify(spinModes))
            
            // Set selected winner for spin 1
            const winnerForSpin1 = {
              spin: 1,
              winnerId: matchingEntryId,
              name: matchingEntryName,
              ticketNumber: targetTicket
            }
            
            // Remove any existing winner for spin 1
            selectedWinners = selectedWinners.filter(w => w.spin !== 1 && Number(w.spin) !== 1 && String(w.spin) !== '1')
            
            // Add new winner for spin 1
            selectedWinners.push(winnerForSpin1)
            localStorage.setItem('selectedWinners', JSON.stringify(selectedWinners))
            
            // Update state
            setSpinModes(spinModes)
            
            console.log('✅ Fixed winner set for spin 1:', {
              ticket: targetTicket,
              name: matchingEntryName,
              entryId: matchingEntryId,
              index: matchingEntryIndex
            })
          } else {
            console.warn('⚠️ Ticket number not found in file entries:', targetTicket)
          }
        } else {
          // No ticket number - ensure spin 1 is random
          const savedSpinModes = localStorage.getItem('spinModes')
          let spinModes = {}
          try {
            if (savedSpinModes) {
              spinModes = JSON.parse(savedSpinModes)
            }
          } catch (e) {
            console.error('Failed to parse spin modes:', e)
          }
          
          // Set spin mode for spin 1 to "random" if not already set to "fixed" by user
          if (spinModes['1'] !== 'fixed') {
            spinModes['1'] = 'random'
            localStorage.setItem('spinModes', JSON.stringify(spinModes))
            setSpinModes(spinModes)
          }
        }
      } else {
        console.error('❌ finalNames is empty! Nothing to display on wheel.')
        alert('Warning: No entries to display. All entries may have been filtered out.')
      }
      
      // Load spin mode settings from localStorage
      const savedSpinModes = localStorage.getItem('spinModes')
      if (savedSpinModes) {
        try {
          setSpinModes(JSON.parse(savedSpinModes))
        } catch (e) {
          console.error('Failed to parse spinModes:', e)
        }
      }
      
      console.log(`✅ Successfully loaded ${finalNames.length} entries from ${spinFile.json_content.length} total entries (${spinFile.json_content.length - finalNames.length} removed/filtered)`)
      console.log('📋 Sample names:', finalNames.slice(0, 5))
    } else {
      console.error('❌ File missing json_content or json_content is not an array:', {
        fileId: spinFile?.id,
        filename: spinFile?.filename || spinFile?.name,
        hasJsonContent: !!spinFile?.json_content,
        jsonContentType: typeof spinFile?.json_content,
        isArray: Array.isArray(spinFile?.json_content)
      })
      alert('Error: File does not contain valid data. Please check the file and try again.')
    }
    setShowOpenDropdown(false)
  }

  // Handle file uploaded from admin panel
  // IMPORTANT: Load ALL active files and merge their entries, not just the uploaded file
  const handleFileUploaded = async (uploadedFile) => {
    console.log('handleFileUploaded called with:', {
      fileId: uploadedFile?.id,
      filename: uploadedFile?.filename || uploadedFile?.name,
      hasJsonContent: !!uploadedFile?.json_content,
      jsonContentLength: uploadedFile?.json_content?.length || 0
    })
    
    // Reload files list from backend for the dropdown
    try {
      const backendFiles = await getSpinFiles()
      if (backendFiles && Array.isArray(backendFiles)) {
        const activeFiles = backendFiles.filter(f => f.active !== false)
        setSpinFiles(activeFiles)
        
        // Load ALL active files and merge their entries (not just the uploaded file)
        if (activeFiles.length > 0) {
          console.log('Loading all active files to merge entries:', {
            totalFiles: activeFiles.length,
            fileIds: activeFiles.map(f => f.id),
            uploadedFileId: uploadedFile?.id
          })
          
          // Merge entries from all active files
          const allEntries = []
          const nameToOriginalItemMap = {}
          const ticketMap = {}
          const ticketNameMap = {}
          const ticketIndexMap = {}
          const indexMap = {}
          
          // Get removed entries to filter them out
          const getRemovedEntries = () => {
            try {
              const removed = localStorage.getItem('removedEntries')
              return removed ? JSON.parse(removed) : []
            } catch (e) {
              return []
            }
          }
          const normalize = (str) => String(str || '').trim().toLowerCase()
          const removedEntries = getRemovedEntries()
          
          // Process each active file
          activeFiles.forEach((file, fileIndex) => {
            if (file.json_content && Array.isArray(file.json_content)) {
              console.log(`Processing file ${fileIndex + 1}/${activeFiles.length}:`, {
                fileId: file.id,
                filename: file.filename || file.name,
                entriesCount: file.json_content.length
              })
              
              file.json_content.forEach((item, idx) => {
                const globalIndex = allEntries.length
                
                // Extract name and ticket (same logic as handleSelectSpinFile)
                let formattedName = ''
                let ticketNumber = ''
                
                if (typeof item === 'string') {
                  formattedName = item.trim() || `Entry ${globalIndex + 1}`
                  const ticketMatch = formattedName.match(/^(.+?)\s*\((\d+)\)$/)
                  if (ticketMatch) {
                    ticketNumber = ticketMatch[2]
                  }
                } else if (typeof item === 'object' && item !== null) {
                  // Extract ticket number
                  ticketNumber = item['Ticket Number'] || 
                                item['ticket number'] || 
                                item['ticketNumber'] || 
                                item['Ticket'] || 
                                item['ticket'] ||
                                item['Ticket No'] ||
                                item['ticket no'] ||
                                item['TicketNo'] ||
                                item['Ticket #'] ||
                                item['ticket #'] ||
                                item['Ticket#'] ||
                                item['Ticket ID'] ||
                                item['ticket id'] ||
                                item['TicketId'] ||
                                ''
                  
                  // Search all keys for ticket
                  if (!ticketNumber || String(ticketNumber).trim() === '') {
                    for (const key of Object.keys(item)) {
                      if (key.toLowerCase().includes('ticket')) {
                        const value = item[key]
                        if (value && String(value).trim() !== '') {
                          ticketNumber = value
                          break
                        }
                      }
                    }
                  }
                  
                  // Extract name
                  const firstName = item['First Name'] || item['first name'] || item['firstName'] || ''
                  const lastName = item['Last Name'] || item['last name'] || item['lastName'] || ''
                  let displayName = ''
                  
                  if (firstName && lastName) {
                    displayName = `${firstName} ${lastName}`.trim()
                  } else if (firstName) {
                    displayName = String(firstName).trim()
                  } else if (lastName) {
                    displayName = String(lastName).trim()
                  }
                  
                  // Format as "Name (Ticket)" if ticket exists
                  if (ticketNumber && String(ticketNumber).trim() !== '') {
                    formattedName = displayName ? `${displayName} (${String(ticketNumber).trim()})` : String(ticketNumber).trim()
                  } else {
                    formattedName = displayName || `Entry ${globalIndex + 1}`
                  }
                } else {
                  formattedName = String(item).trim() || `Entry ${globalIndex + 1}`
                }
                
                // Check if entry is removed (by ticket number)
                const entryTicket = ticketNumber ? normalize(ticketNumber) : null
                let isRemoved = false
                if (entryTicket && entryTicket !== normalize(formattedName)) {
                  isRemoved = removedEntries.some(removed => {
                    const removedTicket = normalize(removed.ticket || removed.originalTicket)
                    return removedTicket && removedTicket !== '' && entryTicket === removedTicket
                  })
                }
                
                // Only add if not removed
                if (!isRemoved) {
                  allEntries.push(formattedName)
                  const uniqueKey = `${formattedName}-${globalIndex}`
                  nameToOriginalItemMap[uniqueKey] = item
                  
                  // Create mappings
                  const finalTicket = ticketNumber ? String(ticketNumber).trim() : ''
                  if (finalTicket) {
                    ticketMap[formattedName] = finalTicket
                    ticketNameMap[finalTicket] = formattedName
                    ticketIndexMap[finalTicket] = globalIndex
                  }
                  indexMap[formattedName] = globalIndex
                }
              })
            }
          })
          
          console.log('Merged entries from all files:', {
            totalEntries: allEntries.length,
            filesProcessed: activeFiles.length,
            entriesPerFile: activeFiles.map(f => ({
              fileId: f.id,
              filename: f.filename || f.name,
              entries: f.json_content?.length || 0
            }))
          })
          
          // Update wheel with merged entries
          setNames(allEntries)
          setNamesText(allEntries.join('\n'))
          setNameToTicketMap(ticketMap)
          setNameToIndexMap(indexMap)
          setTicketToNameMap(ticketNameMap)
          setTicketToIndexMap(ticketIndexMap)
          
          // Select the uploaded file (for center image and other file-specific settings)
          if (uploadedFile) {
            setSelectedSpinFile(uploadedFile)
            
            // Set center image from uploaded file if it has one
            if (uploadedFile.picture && String(uploadedFile.picture).trim() !== '') {
              setCenterImage(String(uploadedFile.picture).trim())
              localStorage.setItem('centerImage', String(uploadedFile.picture).trim())
            }
          }
      }
    } else {
        setSpinFiles([])
      }
    } catch (error) {
      console.error('Failed to reload files list from backend:', error)
      setSpinFiles([])
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        spinWheel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [spinWheel])

  // Theme switching handler
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    // Apply theme class to document
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  // Apply theme on mount and when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Effect to randomly select 100 entries from names array and update every few milliseconds
  // BUT ONLY when wheel is NOT spinning and NO winner is displayed
  useEffect(() => {
    if (names.length === 0) {
      setDisplayedNames([])
      return
    }

    // If names.length <= 100, just use all names
    if (names.length <= 100) {
      setDisplayedNames(names)
      return
    }

    // Function to randomly select 100 entries
    const selectRandomBatch = () => {
      // Don't update if spinning or showing winner - keep current batch frozen
      if (isSpinning || showWinner || winner) {
        return
      }
      
      // CRITICAL: If we have a fixed batch stored, don't change it
      if (fixedBatchRef.current) {
        return
      }
      
      // CRITICAL: If we're in fixed winner mode for spin 1, don't change the batch
      // The batch should already be set correctly in spinWheel function
      const savedSpinModes = localStorage.getItem('spinModes')
      if (savedSpinModes) {
        try {
          const spinModes = JSON.parse(savedSpinModes)
          if (spinModes['1'] === 'fixed' && fixedWinnerName) {
            // Fixed winner mode - don't change the batch, it's already set correctly
            // Just ensure the fixed winner is at position 0 if batch exists
            if (displayedNames.length > 0 && displayedNames[0] !== fixedWinnerName) {
              const batch = [fixedWinnerName, ...displayedNames.filter(n => n !== fixedWinnerName).slice(0, 99)]
              setDisplayedNames(batch)
            }
            return
          }
        } catch (e) {
          // Continue with normal batch selection
        }
      }
      
      // If there's a fixed winner, ensure it's ALWAYS at position 0 in the batch
      let batch = []
      if (fixedWinnerName && names.includes(fixedWinnerName)) {
        // CRITICAL: Fixed winner MUST be at position 0 for rotation calculation to work
        // Start with the fixed winner at position 0
        batch.push(fixedWinnerName)
        // Get remaining names (excluding the fixed winner)
        const remainingNames = names.filter(name => name !== fixedWinnerName)
        // Shuffle and take 99 more to make 100 total
        const shuffled = [...remainingNames].sort(() => Math.random() - 0.5)
        batch = [fixedWinnerName, ...shuffled.slice(0, 99)]
        // Ensure fixed winner is exactly at position 0
        if (batch[0] !== fixedWinnerName) {
          batch = batch.filter(n => n !== fixedWinnerName)
          batch.unshift(fixedWinnerName)
          batch = batch.slice(0, 100)
        }
      } else {
        // No fixed winner - random selection
        const shuffled = [...names].sort(() => Math.random() - 0.5)
        batch = shuffled.slice(0, 100)
      }
      
      setDisplayedNames(batch)
    }

    // Set initial batch immediately when names change (only if not currently spinning/showing winner)
    // If spinning/showing winner, keep current displayedNames unchanged
    // CRITICAL: Always update displayedNames immediately when names change, so wheel shows new entries right away
    if (!isSpinning && !showWinner && !winner) {
      selectRandomBatch()
    }

    // Only start rotation interval if wheel is idle and no winner is displayed
    if (isSpinning || showWinner || winner) {
      // Wheel is spinning or showing winner - don't rotate participants
      return
    }

    // Update every 50 milliseconds to cycle through different batches
    // Only when wheel is idle and no winner is displayed
    const interval = setInterval(selectRandomBatch, 50)

    return () => clearInterval(interval)
  }, [names, isSpinning, showWinner, winner, fixedWinnerName])

  // Update popup position when wheel container position changes (sidebar toggle, resize, etc.)
  useEffect(() => {
    const updatePopupPosition = () => {
      if (wheelContainerRef.current && showWinner) {
        const rect = wheelContainerRef.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        setPopupPosition({
          top: `${centerY}px`,
          left: `${centerX}px`,
          transform: 'translate(-50%, -50%)'
        })
      }
    }
    
    updatePopupPosition()
    window.addEventListener('resize', updatePopupPosition)
    
    return () => {
      window.removeEventListener('resize', updatePopupPosition)
    }
  }, [showWinner, isSidebarHidden])

  const colors = ['#efb71d', '#24a643', '#4d7ceb', '#d82135'] // yellow, green, blue, red

  // Helper to determine text color based on background
  const getTextColor = (bgColor) => {
    // Yellow (#efb71d) and Green (#24a643) get black text
    if (bgColor === '#efb71d' || bgColor === '#24a643') return 'black'
    return 'white'
  }

  // Calculate current color under pointer
  const getCurrentPointerColor = () => {
    if (names.length === 0) return '#ffd700' // Default Gold
    
    // If pointerChangesColor setting is disabled, use fixed gold color
    if (!settings.pointerChangesColor) return '#ffd700' // Fixed Gold

    // Use displayedNames.length because that's what's actually shown on the wheel
    const displayedNamesLength = displayedNames.length > 0 ? displayedNames.length : names.length
    const sliceAngle = 360 / displayedNamesLength
    
    // Normalize rotation to 0-360 range
    const R = ((finalRotation % 360) + 360) % 360

    // The pointer is fixed at 0° (right side)
    // After rotating clockwise by R degrees, what's at the pointer (0°) 
    // was originally at (-R) degrees in the wheel's coordinate system
    // Convert to 0-360 range: (360 - R) % 360
    const pointerAngleInOriginal = (360 - R) % 360

    // Find which slice contains this angle (using same logic as winner calculation)
    // Slices start at -90° (top), so slice i covers:
    // from (i * sliceAngle - 90) to ((i+1) * sliceAngle - 90)
    let selectedDisplayedIndex = 0
    let found = false

    for (let i = 0; i < displayedNamesLength; i++) {
      // Calculate slice boundaries in original coordinates (0-360 range)
      const sliceStart = (i * sliceAngle - 90 + 360) % 360
      const sliceEnd = ((i + 1) * sliceAngle - 90 + 360) % 360

      // Check if pointer angle is within this slice
      let inSlice = false

      if (sliceStart < sliceEnd) {
        // Normal case: slice doesn't wrap around 0°
        inSlice = pointerAngleInOriginal >= sliceStart && pointerAngleInOriginal < sliceEnd
      } else {
        // Wrap-around case: slice crosses 0° boundary (e.g., 315° to 45°)
        inSlice = pointerAngleInOriginal >= sliceStart || pointerAngleInOriginal < sliceEnd
      }

      if (inSlice) {
        selectedDisplayedIndex = i
        found = true
        break
      }
    }

    // Fallback: if no slice found, find closest slice center
    if (!found) {
      let minDist = Infinity
      for (let i = 0; i < displayedNamesLength; i++) {
        const sliceCenter = (i * sliceAngle - 90 + sliceAngle / 2 + 360) % 360
        let dist = Math.abs(pointerAngleInOriginal - sliceCenter)
        if (dist > 180) dist = 360 - dist
        if (dist < minDist) {
          minDist = dist
          selectedDisplayedIndex = i
        }
      }
    }

    // Ensure valid index
    selectedDisplayedIndex = selectedDisplayedIndex % displayedNamesLength
    if (selectedDisplayedIndex < 0) {
      selectedDisplayedIndex = (selectedDisplayedIndex + displayedNamesLength) % displayedNamesLength
    }
    
    // Return color based on displayed index - this matches what's actually shown
    return colors[selectedDisplayedIndex % colors.length]
  }

  // Use fixed gold color for better visibility (or dynamic if setting enabled)
  const pointerColor = getCurrentPointerColor()


  // Fullscreen mode - only show wheel
  if (isFullscreen) {
    return (
      <div className="app fullscreen-mode">
        <div className="fullscreen-wheel-container">
          <button className="fullscreen-minimize-btn" onClick={() => setIsFullscreen(false)} title="Exit fullscreen">
            <FiMaximize className="icon" />
          </button>
          <div className="wheel-container-fullscreen">
            <div className="wheel-wrapper" ref={wheelWrapperRef} onClick={handleWheelClick} style={{ cursor: 'pointer' }}>
              <div style={{ width: '100%', height: '100%' }}>
                <CanvasWheel
                  names={fixedBatchRef.current && isSpinning ? fixedBatchRef.current : displayedNames}
                  colors={colors}
                  rotation={finalRotation}
                  width={750}
                  height={750}
                  centerImage={centerImage}
                  centerImageSize={centerImageSize}
                />
                {/* Fixed Arrow Pointer at 3 o'clock (right side) - Does NOT rotate with wheel */}
                <svg
                  className="wheel-pointer"
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    pointerEvents: 'none',
                    position: 'absolute',
                    top: '50%',
                    right: '-1.33%', // Percentage-based: scales with wheel-wrapper size at any zoom level
                    transform: 'translateY(-50%)',
                    width: '5.33%', // ~40px relative to 750px wheel, scales with zoom
                    height: '5.33%', // ~40px relative to 750px wheel, scales with zoom
                    minWidth: '5.33%',
                    minHeight: '5.33%',
                    maxWidth: '5.33%',
                    maxHeight: '5.33%',
                    zIndex: 20,
                    margin: 0,
                    padding: 0,
                    boxSizing: 'border-box',
                    display: 'block',
                    left: 'auto'
                  }}
                >
                  <defs>
                    {/* Golden 3D gradient - rich metallic gold */}
                    <linearGradient id="goldenGradientFS" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFD700" />
                      <stop offset="25%" stopColor="#FFC125" />
                      <stop offset="50%" stopColor="#FFA500" />
                      <stop offset="75%" stopColor="#FF8C00" />
                      <stop offset="100%" stopColor="#CD853F" />
                    </linearGradient>
                    {/* Top highlight for 3D shine */}
                    <linearGradient id="goldenTopHighlightFS" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                      <stop offset="30%" stopColor="rgba(255,255,255,0.4)" />
                      <stop offset="60%" stopColor="rgba(255,255,255,0)" />
                      <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
                    </linearGradient>
                    {/* Side highlight for depth */}
                    <linearGradient id="goldenSideHighlightFS" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
                      <stop offset="40%" stopColor="rgba(255,255,255,0.3)" />
                      <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
                    </linearGradient>
                    {/* Enhanced 3D bevel filter */}
                    <filter id="goldenBevelFS" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
                      <feOffset in="blur" dx="4" dy="4" result="offsetBlur" />
                      <feSpecularLighting in="blur" surfaceScale="10" specularConstant="1.5" specularExponent="30" lightingColor="#FFD700" result="specOut">
                        <fePointLight x="-5000" y="-10000" z="40000" />
                      </feSpecularLighting>
                      <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
                      <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1.2" k4="0" result="litPaint" />
                      <feMerge>
                        <feMergeNode in="offsetBlur" />
                        <feMergeNode in="litPaint" />
                      </feMerge>
                    </filter>
                    {/* Enhanced shadow */}
                    <filter id="arrowShadowFS">
                      <feGaussianBlur in="SourceAlpha" stdDeviation="5" />
                      <feOffset dx="3" dy="3" result="offsetblur" />
                      <feComponentTransfer>
                        <feFuncA type="linear" slope="0.4" />
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {/* Golden 3D arrow - polished metallic style */}
                  <g filter="url(#arrowShadowFS)">
                    {/* Main arrow body with golden gradient */}
                  <path
                    d="M 10 50 L 90 20 L 90 80 Z"
                      fill="url(#goldenGradientFS)"
                      stroke="#CD853F"
                      strokeWidth="1"
                      filter="url(#goldenBevelFS)"
                    />
                    {/* Top highlight for shine */}
                    <path
                      d="M 10 50 L 90 20 L 90 80 Z"
                      fill="url(#goldenTopHighlightFS)"
                      opacity="0.6"
                    />
                    {/* Side highlight for depth */}
                    <path
                      d="M 10 50 L 90 20 L 90 80 Z"
                      fill="url(#goldenSideHighlightFS)"
                      opacity="0.5"
                    />
                    {/* Bright inner highlight line */}
                    <path
                      d="M 12 50 L 88 22 L 88 78 Z"
                      fill="none"
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth="1.5"
                    />
                    {/* Subtle inner shadow line */}
                  <path
                    d="M 15 50 L 85 24 L 85 76 Z"
                    fill="none"
                      stroke="rgba(0,0,0,0.2)"
                      strokeWidth="1"
                  />
                  </g>
                </svg>
              </div>
              {/* Fixed arc text overlay - doesn't rotate */}
              {!isSpinning && !showWinner && !winner && (
                <svg
                  className="wheel-text-overlay"
                  viewBox="0 0 750 750"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 5
                  }}
                >
                  <defs>
                    {/* Arc path for "Click to spin" - at the top of center circle */}
                    <path id="arcPath1-fullscreen" d="M 295 295 A 80 80 0 0 1 455 295" fill="none" />
                    {/* Arc path for "or press ctrl+enter" - U-shape: start/end at top, center at bottom */}
                    <path id="arcPath2-fullscreen" d="M 280 470 Q 375 590 470 470" fill="none" />
                  </defs>
                  {/* "Click to spin" text at the top */}
                  <text
                    fill="white"
                    fontSize="42"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                      pointerEvents: 'none'
                    }}
                  >
                    <textPath href="#arcPath1-fullscreen" startOffset="50%">
                      Click to spin
                    </textPath>
                  </text>
                  {/* "or press ctrl+enter" text at the bottom */}
                  <text
                    fill="white"
                    fontSize="28"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                      pointerEvents: 'none'
                    }}
                  >
                    <textPath href="#arcPath2-fullscreen" startOffset="50%">
                      or press ctrl+enter
                    </textPath>
                  </text>
                </svg>
              )}
              {/* Arrow is now drawn inside CanvasWheel and rotates with the wheel */}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`app theme-${theme}`}>
      {/* Hidden file input for center image - always available */}
      <input
        ref={centerImageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files[0]
          if (file) {
            // Convert to base64 for persistence
            const reader = new FileReader()
            reader.onload = (event) => {
              const base64Image = event.target.result
              setCenterImage(base64Image)
              // Save to localStorage
              localStorage.setItem('centerImage', base64Image)
            }
            reader.onerror = () => {
              console.error('Failed to read image file')
            }
            reader.readAsDataURL(file)
          }
        }}
      />
      {/* Header Navigation Bar */}
      <header className="header">
        <div className="header-left">
          <button className="header-btn admin-btn mobile-admin-btn" title="Admin Panel" onClick={() => setShowAdminPanel(true)}>
            <FiUpload className="icon" />
            <span>Admin</span>
          </button>
        </div>
        <div className="header-right">
          <button className="header-btn" title="Customize" onClick={() => setShowCustomize(true)}>
            <FiSettings className="icon" />
            <span>Customize</span>
          </button>
          <button className="header-btn admin-btn desktop-admin-btn" title="Admin Panel" onClick={() => setShowAdminPanel(true)}>
            <FiUpload className="icon" />
            <span>Admin</span>
          </button>
          {/* Theme Switcher */}
          <button 
            className="header-btn" 
            title={`Theme: ${theme === 'night' ? 'Night' : theme === 'normal' ? 'Normal' : 'Light'} (Click to change)`}
            onClick={() => {
              const themes = ['night', 'normal', 'light']
              const currentIndex = themes.indexOf(theme)
              const nextTheme = themes[(currentIndex + 1) % 3]
              handleThemeChange(nextTheme)
            }}
          >
            {theme === 'night' && <FiMoon className="icon" />}
            {(theme === 'normal' || theme === 'light') && <FiSun className="icon" />}
            <span className="hide-on-mobile">
              {theme === 'night' ? 'Night' : theme === 'normal' ? 'Normal' : 'Light'}
            </span>
          </button>
          <button 
            className="header-btn" 
            title="Winner List" 
            onClick={() => setShowWinnersList(true)}
            style={{ 
              backgroundColor: winners.length > 0 ? '#4CAF50' : undefined,
              color: winners.length > 0 ? 'white' : undefined
            }}
          >
            <FiAward className="icon" />
            <span>Winner List {winners.length > 0 && `(${winners.length})`}</span>
          </button>
          <button className="header-btn" title="New" onClick={handleNew}>
            <FiFile className="icon" />
            <span>New</span>
          </button>
          <div className="header-btn-dropdown-container" style={{ position: 'relative' }}>
            <button 
              className="header-btn" 
              title="Open"
              onClick={() => setShowOpenDropdown(!showOpenDropdown)}
            >
              <FiFolder className="icon" />
              <span>Open</span>
              <FiChevronDown className="icon" style={{ marginLeft: '4px', fontSize: '12px' }} />
            </button>
            {showOpenDropdown && (
              <div 
                className="open-dropdown"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  minWidth: '200px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  marginTop: '4px'
                }}
              >
                {loadingSpinFiles ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#888' }}>
                    Loading...
                  </div>
                ) : spinFiles.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#888' }}>
                    No spin files available
                  </div>
                ) : (
                  <>
                    {spinFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => handleSelectSpinFile(file)}
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                          backgroundColor: selectedSpinFile?.id === file.id ? '#f0f0f0' : 'white'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = selectedSpinFile?.id === file.id ? '#f0f0f0' : 'white'}
                      >
                        <div style={{ fontWeight: selectedSpinFile?.id === file.id ? 'bold' : 'normal' }}>
                          {file.filename}
                        </div>
                        {file.picture && (
                          <img 
                            src={file.picture} 
                            alt={file.filename}
                            style={{ width: '40px', height: '40px', objectFit: 'cover', marginTop: '4px', borderRadius: '4px' }}
                          />
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <button className="header-btn hide-on-mobile" title="Save">
            <FiSave className="icon" />
            <span>Save</span>
          </button>
          <button className="header-btn hide-on-mobile" title="Share">
            <FiShare2 className="icon" />
            <span>Share</span>
          </button>
          <button className="header-btn hide-on-mobile" title="Gallery">
            <FiSearch className="icon" />
            <span>Gallery</span>
          </button>
          <button className="header-btn" title="Fullscreen" onClick={() => setIsFullscreen(true)}>
            <FiMaximize className="icon" />
          </button>
          <button className="header-btn dropdown hide-on-mobile" title="More">
            <span>More</span>
            <FiChevronDown className="icon" />
          </button>
          <button className="header-btn dropdown hide-on-mobile" title="Language">
            <FiGlobe className="icon" />
            <span>English</span>
            <FiChevronDown className="icon" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Center - Wheel */}
        <div className="wheel-container" ref={wheelContainerRef}>
          <div className="wheel-wrapper" ref={wheelWrapperRef} onClick={handleWheelClick} style={{ cursor: 'pointer' }}>
            <div style={{ width: '100%', height: '100%' }}>
              <CanvasWheel
                names={displayedNames}
                colors={colors}
                rotation={finalRotation}
                width={750}
                height={750}
                centerImage={centerImage}
                centerImageSize={centerImageSize}
              />
            </div>

            {/* Fixed arc text overlay - doesn't rotate */}
            {!isSpinning && !showWinner && !winner && (
              <svg
                className="wheel-text-overlay"
                viewBox="0 0 750 750"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 5
                }}
              >
                <defs>
                  {/* Arc path for "Click to spin" - at the top of center circle */}
                  <path id="arcPath1" d="M 295 295 A 80 80 0 0 1 455 295" fill="none" />
                  {/* Arc path for "or press ctrl+enter" - U-shape: start/end at top, center at bottom */}
                  <path id="arcPath2" d="M 280 470 Q 375 590 470 470" fill="none" />
                </defs>
                {/* "Click to spin" text at the top */}
                <text
                  fill="white"
                  fontSize="42"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                    pointerEvents: 'none'
                  }}
                >
                  <textPath href="#arcPath1" startOffset="50%">
                    Click to spin
                  </textPath>
                </text>
                {/* "or press ctrl+enter" text at the bottom */}
                <text
                  fill="white"
                  fontSize="28"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                    pointerEvents: 'none'
                  }}
                >
                  <textPath href="#arcPath2" startOffset="50%">
                    or press ctrl+enter
                  </textPath>
                </text>
              </svg>
            )}
            {/* Fixed Arrow Pointer at 3 o'clock (right side) - Does NOT rotate with wheel */}
            <svg
              className="wheel-pointer"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                pointerEvents: 'none',
                position: 'absolute',
                top: '50%',
                right: '-1.33%', // Percentage-based: scales with wheel-wrapper size at any zoom level
                transform: 'translateY(-50%)',
                width: '5.33%', // ~40px relative to 750px wheel, scales with zoom
                height: '5.33%', // ~40px relative to 750px wheel, scales with zoom
                minWidth: '5.33%',
                minHeight: '5.33%',
                maxWidth: '5.33%',
                maxHeight: '5.33%',
                zIndex: 20,
                margin: 0,
                padding: 0,
                boxSizing: 'border-box',
                display: 'block',
                left: 'auto'
              }}
            >
              <defs>
                {/* Golden 3D gradient - rich metallic gold */}
                <linearGradient id="goldenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="25%" stopColor="#FFC125" />
                  <stop offset="50%" stopColor="#FFA500" />
                  <stop offset="75%" stopColor="#FF8C00" />
                  <stop offset="100%" stopColor="#CD853F" />
                </linearGradient>
                {/* Top highlight for 3D shine */}
                <linearGradient id="goldenTopHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                  <stop offset="30%" stopColor="rgba(255,255,255,0.4)" />
                  <stop offset="60%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
                </linearGradient>
                {/* Side highlight for depth */}
                <linearGradient id="goldenSideHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
                  <stop offset="40%" stopColor="rgba(255,255,255,0.3)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
                </linearGradient>
                {/* Enhanced 3D bevel filter */}
                <filter id="goldenBevel" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
                  <feOffset in="blur" dx="4" dy="4" result="offsetBlur" />
                  <feSpecularLighting in="blur" surfaceScale="10" specularConstant="1.5" specularExponent="30" lightingColor="#FFD700" result="specOut">
                    <fePointLight x="-5000" y="-10000" z="40000" />
                  </feSpecularLighting>
                  <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
                  <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1.2" k4="0" result="litPaint" />
                  <feMerge>
                    <feMergeNode in="offsetBlur" />
                    <feMergeNode in="litPaint" />
                  </feMerge>
                </filter>
                {/* Enhanced shadow */}
                <filter id="arrowShadow">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="5" />
                  <feOffset dx="3" dy="3" result="offsetblur" />
                  <feComponentTransfer>
                    <feFuncA type="linear" slope="0.4" />
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Golden 3D arrow - polished metallic style */}
              <g filter="url(#arrowShadow)">
                {/* Main arrow body with golden gradient */}
              <path
                d="M 10 50 L 90 20 L 90 80 Z"
                  fill="url(#goldenGradient)"
                  stroke="#CD853F"
                  strokeWidth="1"
                  filter="url(#goldenBevel)"
                />
                {/* Top highlight for shine */}
                <path
                  d="M 10 50 L 90 20 L 90 80 Z"
                  fill="url(#goldenTopHighlight)"
                  opacity="0.6"
                />
                {/* Side highlight for depth */}
                <path
                  d="M 10 50 L 90 20 L 90 80 Z"
                  fill="url(#goldenSideHighlight)"
                  opacity="0.5"
                />
                {/* Bright inner highlight line */}
                <path
                  d="M 12 50 L 88 22 L 88 78 Z"
                  fill="none"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="1.5"
                />
                {/* Subtle inner shadow line */}
              <path
                d="M 15 50 L 85 24 L 85 76 Z"
                fill="none"
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth="1"
              />
              </g>
            </svg>
          </div>
        </div >

        {/* Right Sidebar - Entries */}
        < div className={`right-sidebar ${isSidebarHidden ? 'sidebar-hidden' : ''}`
        }>
          {
            isSidebarHidden ? (
              <div className="sidebar-header-hidden" >
                <label className="hide-checkbox">
                  <input
                    type="checkbox"
                    checked={isSidebarHidden}
                    onChange={(e) => setIsSidebarHidden(e.target.checked)}
                  />
                  <span>Hide</span>
                </label>
              </div>
            ) : (
              <>
                <div className="sidebar-header">
                  <div className="tabs">
                    <button
                      className={`tab ${activeTab === 'entries' ? 'active' : ''}`}
                      onClick={() => setActiveTab('entries')}
                    >
                      Entries {names.length}
                    </button>
                    <button
                      className={`tab ${activeTab === 'results' ? 'active' : ''}`}
                      onClick={() => setActiveTab('results')}
                    >
                      Results {results.length}
                    </button>
                  </div>
                  <label className="hide-checkbox">
                    <input
                      type="checkbox"
                      checked={isSidebarHidden}
                      onChange={(e) => setIsSidebarHidden(e.target.checked)}
                    />
                    <span>Hide</span>
                  </label>
                </div>

                {activeTab === 'entries' ? (
                  <>
                    <div className="sidebar-actions">
                      <button className="action-btn" onClick={shuffleNames} title="Shuffle">
                        <FiShuffle className="icon" />
                        <span>Shuffle</span>
                      </button>
                      <button className="action-btn" onClick={sortNames} title="Sort">
                        <span className="icon" style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.5' }}>
                          <FiArrowUp style={{ fontSize: '10px' }} />
                          <FiArrowDown style={{ fontSize: '10px' }} />
                        </span>
                        <span>Sort</span>
                      </button>
                      <button 
                        className="action-btn dropdown" 
                        title="Add image"
                        onClick={() => {
                          if (centerImageInputRef.current) {
                            centerImageInputRef.current.click()
                          }
                        }}
                      >
                        <span>Add image</span>
                        <FiChevronDown className="icon" />
                      </button>
                    </div>

                    <div className="entries-list">
                      <div className="add-name-input">
                        <textarea
                          className="entries-textarea"
                          placeholder="Type names here, press Enter for new line..."
                          value={namesText}
                          onChange={handleNamesTextChange}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sidebar-actions">
                      <button className="action-btn" onClick={sortResults} title="Sort">
                        <FiArrowUp className="icon" />
                        <span>Sort</span>
                      </button>
                      <button className="action-btn" onClick={clearResults} title="Clear the list">
                        <span className="icon">×</span>
                        <span>Clear the list</span>
                      </button>
                    </div>

                    <div className="entries-list">
                      <div className="names-container">
                        {results.length === 0 ? (
                          <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                            No results yet
                          </div>
                        ) : (
                          results.map((name, index) => (
                            <div key={index} className="name-item">
                              <span>{name}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
        </div >
      </div >

      {/* Winners List Modal */}
      {showWinnersList && (
        <div 
          className="winner-overlay" 
          onClick={() => setShowWinnersList(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
          }}
        >
          <div 
            className="winners-list-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a1a',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{
              backgroundColor: '#2a2a2a',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #333'
            }}>
              <h2 style={{
                margin: 0,
                color: '#fff',
                fontSize: '24px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <FiAward style={{ color: '#FFD700' }} />
                Winners List ({winners.length})
              </h2>
              <button
                onClick={() => setShowWinnersList(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '28px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#444'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                title="Close"
              >
                <FiX />
              </button>
            </div>
            
            {/* Modal Content */}
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1
            }}>
              {winners.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#888'
                }}>
                  <FiAward style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }} />
                  <p style={{ fontSize: '18px', margin: 0 }}>No winners yet</p>
                  <p style={{ fontSize: '14px', margin: '8px 0 0 0' }}>Spin the wheel to see winners here!</p>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {winners.map((winner, index) => (
                    <div
                      key={index}
                      style={{
                        backgroundColor: '#2a2a2a',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        border: `2px solid ${winner.color || '#4CAF50'}`,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px'
                          }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: winner.color || '#4CAF50',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontWeight: 'bold',
                              fontSize: '18px',
                              flexShrink: 0
                            }}>
                              {winner.spinNumber || index + 1}
                            </div>
                            <div>
                              <div style={{
                                color: '#fff',
                                fontSize: '20px',
                                fontWeight: '600',
                                marginBottom: '4px'
                              }}>
                                {winner.name}
                              </div>
                              {winner.ticket && (
                                <div style={{
                                  color: '#aaa',
                                  fontSize: '14px'
                                }}>
                                  Ticket: {winner.ticket}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          color: '#888',
                          fontSize: '12px',
                          textAlign: 'right'
                        }}>
                          {winner.timestamp && new Date(winner.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Winner Pop-up */}
      {
        showWinner && winner && (
          <div className="winner-overlay" onClick={handleCloseWinner} style={{ 
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div className="winner-popup" onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute',
              ...popupPosition
            }}>
              <div className="winner-header" style={{ backgroundColor: winner.color }}>
                <h2>We have a winner!</h2>
                <button className="winner-close-btn" onClick={handleCloseWinner}>×</button>
              </div>
              <div className="winner-content">
                {/* Extract base name if in "Name (Ticket)" format */}
                {(() => {
                  const nameMatch = winner.name.match(/^(.+?)\s*\((\d+)\)$/)
                  const displayName = nameMatch ? nameMatch[1].trim() : winner.name
                  const ticketFromName = nameMatch ? nameMatch[2] : null
                  const finalTicket = winner.ticket || ticketFromName
                  
                  return (
                    <>
                      <div className="winner-name">
                        {displayName} {finalTicket}
                      </div>
                    </>
                  )
                })()}
                <div className="winner-buttons">
                  <button className="winner-btn close-btn" onClick={handleCloseWinner}>Close</button>
                  <button className="winner-btn remove-btn" onClick={handleRemoveWinner}>Remove</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Customize Pop-up */}
      {
        showCustomize && (
          <div className="customize-overlay" onClick={() => setShowCustomize(false)}>
            <div className="customize-popup" onClick={(e) => e.stopPropagation()}>
              <div className="customize-tabs">
                <button
                  className={`customize-tab ${customizeTab === 'during-spin' ? 'active' : ''}`}
                  onClick={() => setCustomizeTab('during-spin')}
                >
                  During spin
                </button>
                <button
                  className={`customize-tab ${customizeTab === 'after-spin' ? 'active' : ''}`}
                  onClick={() => setCustomizeTab('after-spin')}
                >
                  After spin
                </button>
                <button
                  className={`customize-tab ${customizeTab === 'appearance' ? 'active' : ''}`}
                  onClick={() => setCustomizeTab('appearance')}
                >
                  Appearance
                </button>
              </div>

              <div className="customize-content">
                {customizeTab === 'during-spin' && (
                  <div className="customize-section">
                    <div className="customize-field">
                      <label className="customize-label">Sound</label>
                      <div className="customize-sound-controls">
                        <select
                          className="customize-select"
                          value={settings.sound}
                          onChange={(e) => setSettings({ ...settings, sound: e.target.value })}
                        >
                          <option>Ticking sound</option>
                        </select>
                        <button className="customize-icon-btn" title="Play">
                          <FiPlay />
                        </button>
                        <button className="customize-icon-btn" title="Stop">
                          <FiSquare />
                        </button>
                      </div>
                    </div>

                    <div className="customize-field">
                      <label className="customize-label">Volume</label>
                      <div className="customize-slider-container" style={{ '--slider-progress': `${settings.volume}%` }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={settings.volume}
                          onChange={(e) => setSettings({ ...settings, volume: parseInt(e.target.value) })}
                          className="customize-slider"
                          style={{ '--slider-progress': `${settings.volume}%` }}
                        />
                        <div className="customize-slider-labels">
                          <span>0%</span>
                          <span>25%</span>
                          <span>50%</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    <div className="customize-checkboxes">
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.displayDuplicates}
                          onChange={(e) => setSettings({ ...settings, displayDuplicates: e.target.checked })}
                        />
                        <span>Display duplicates</span>
                        <FiHelpCircle className="customize-help-icon" />
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.spinSlowly}
                          onChange={(e) => setSettings({ ...settings, spinSlowly: e.target.checked })}
                        />
                        <span>Spin slowly</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.showTitle}
                          onChange={(e) => setSettings({ ...settings, showTitle: e.target.checked })}
                        />
                        <span>Show title</span>
                      </label>
                    </div>

                    <div className="customize-field">
                      <label className="customize-label">Spin time (seconds)</label>
                      <div className="customize-slider-container" style={{ '--slider-progress': `${((settings.spinTime - 1) / 59) * 100}%` }}>
                        <input
                          type="range"
                          min="1"
                          max="60"
                          value={settings.spinTime}
                          onChange={(e) => setSettings({ ...settings, spinTime: parseInt(e.target.value) })}
                          className="customize-slider"
                          style={{ '--slider-progress': `${((settings.spinTime - 1) / 59) * 100}%` }}
                        />
                        <div className="customize-slider-labels">
                          <span>1</span>
                          <span>10</span>
                          <span>20</span>
                          <span>30</span>
                          <span>40</span>
                          <span>50</span>
                          <span>60</span>
                        </div>
                      </div>
                    </div>

                    <div className="customize-field">
                      <label className="customize-label-bold">Max number of names visible on the wheel</label>
                      <p className="customize-description">All names in the text-box have the same chance of winning, regardless of this value.</p>
                      <div className="customize-slider-container" style={{ '--slider-progress': `${((settings.maxNamesVisible - 4) / 996) * 100}%` }}>
                        <input
                          type="range"
                          min="4"
                          max="1000"
                          value={settings.maxNamesVisible}
                          onChange={(e) => setSettings({ ...settings, maxNamesVisible: parseInt(e.target.value) })}
                          className="customize-slider"
                          style={{ '--slider-progress': `${((settings.maxNamesVisible - 4) / 996) * 100}%` }}
                        />
                        <div className="customize-slider-labels">
                          <span>4</span>
                          <span>100</span>
                          <span>200</span>
                          <span>300</span>
                          <span>400</span>
                          <span>500</span>
                          <span>600</span>
                          <span>700</span>
                          <span>800</span>
                          <span>900</span>
                          <span>1000</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {customizeTab === 'after-spin' && (
                  <div className="customize-section">
                    <div className="customize-field">
                      <label className="customize-label">Sound</label>
                      <div className="customize-sound-controls">
                        <select
                          className="customize-select"
                          value={settings.afterSpinSound}
                          onChange={(e) => setSettings({ ...settings, afterSpinSound: e.target.value })}
                        >
                          <option>Subdued applause</option>
                        </select>
                        <button className="customize-icon-btn" title="Play">
                          <FiPlay />
                        </button>
                        <button className="customize-icon-btn" title="Stop">
                          <FiSquare />
                        </button>
                      </div>
                    </div>

                    <div className="customize-field">
                      <label className="customize-label">Volume</label>
                      <div className="customize-slider-container" style={{ '--slider-progress': `${settings.afterSpinVolume}%` }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={settings.afterSpinVolume}
                          onChange={(e) => setSettings({ ...settings, afterSpinVolume: parseInt(e.target.value) })}
                          className="customize-slider"
                          style={{ '--slider-progress': `${settings.afterSpinVolume}%` }}
                        />
                        <div className="customize-slider-labels">
                          <span>0%</span>
                          <span>25%</span>
                          <span>50%</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    <div className="customize-checkboxes">
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.animateWinningEntry}
                          onChange={(e) => setSettings({ ...settings, animateWinningEntry: e.target.checked })}
                        />
                        <span>Animate winning entry</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.launchConfetti}
                          onChange={(e) => setSettings({ ...settings, launchConfetti: e.target.checked })}
                        />
                        <span>Launch confetti</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.autoRemoveWinner}
                          onChange={(e) => setSettings({ ...settings, autoRemoveWinner: e.target.checked })}
                        />
                        <span>Auto-remove winner after 5 seconds</span>
                      </label>
                    </div>

                    <div className="customize-field">
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.displayPopup}
                          onChange={(e) => setSettings({ ...settings, displayPopup: e.target.checked })}
                        />
                        <span>Display popup with message:</span>
                      </label>
                      <input
                        type="text"
                        className="customize-text-input"
                        value={settings.popupMessage}
                        onChange={(e) => setSettings({ ...settings, popupMessage: e.target.value })}
                        disabled={!settings.displayPopup}
                      />
                      <div className="customize-indented-checkbox">
                        <label className="customize-checkbox-label">
                          <input
                            type="checkbox"
                            checked={settings.displayRemoveButton}
                            onChange={(e) => setSettings({ ...settings, displayRemoveButton: e.target.checked })}
                            disabled={!settings.displayPopup}
                          />
                          <span>Display the "Remove" button</span>
                        </label>
                      </div>
                    </div>

                    <div className="customize-field">
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.playClickSoundOnRemove}
                          onChange={(e) => setSettings({ ...settings, playClickSoundOnRemove: e.target.checked })}
                        />
                        <span>Play a click sound when the winner is removed</span>
                      </label>
                    </div>
                  </div>
                )}

                {customizeTab === 'appearance' && (
                  <div className="customize-section">
                    <div className="customize-field">
                      <div className="customize-toggle-container">
                        <div className={`customize-toggle-option ${!settings.wheelBackgroundImage ? 'active' : ''}`}>
                          <div className="customize-option-icon customize-wheel-icon">
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(255, 64, 64)' }}></div>
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(0, 177, 0)' }}></div>
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(0, 195, 255)' }}></div>
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(255, 217, 0)' }}></div>
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(0, 195, 255)' }}></div>
                            <div className="wheel-icon-slice" style={{ backgroundColor: 'rgb(255, 165, 0)' }}></div>
                          </div>
                          <span className="customize-option-text">One color per section</span>
                        </div>
                        <label className="customize-toggle">
                          <input
                            type="checkbox"
                            checked={settings.wheelBackgroundImage}
                            onChange={(e) => setSettings({ ...settings, wheelBackgroundImage: e.target.checked })}
                          />
                          <span className="customize-toggle-slider"></span>
                        </label>
                        <div className={`customize-toggle-option ${settings.wheelBackgroundImage ? 'active' : ''}`}>
                          <div className="customize-option-icon">
                            <div className="cookie-icon">🍪</div>
                          </div>
                          <span className="customize-option-text">Wheel background image</span>
                        </div>
                      </div>
                    </div>

                    {settings.wheelBackgroundImage && (
                      <div className="customize-field">
                        <label className="customize-label">Wheel background image</label>
                        <button className="customize-image-btn">
                          <div className="cookie-icon">🍪</div>
                          <span>Wheel background image</span>
                          <FiChevronDown />
                        </button>
                      </div>
                    )}

                    <div className="customize-field">
                      <button className="customize-theme-btn">
                        <span>Apply a theme</span>
                        <FiChevronDown />
                      </button>
                    </div>

                    <div className="customize-field">
                      <div className="customize-colors-header">
                        <label className="customize-label-bold">Customize colors</label>
                        <FiHelpCircle className="customize-help-icon" />
                      </div>
                      <div className="customize-color-palettes">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                          <div key={index} className="customize-color-palette-item">
                            <div className="customize-color-palette-icon">
                              <FiDroplet />
                            </div>
                            <label className="customize-checkbox-label">
                              <input
                                type="checkbox"
                                checked={settings.colorPalettes[index]}
                                onChange={(e) => {
                                  const newPalettes = [...settings.colorPalettes]
                                  newPalettes[index] = e.target.checked
                                  setSettings({ ...settings, colorPalettes: newPalettes })
                                }}
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="customize-field">
                      <label className="customize-label">Image at the center of the wheel</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <button 
                          className="customize-image-btn"
                          onClick={() => centerImageInputRef.current?.click()}
                          style={{ flex: 1 }}
                        >
                        <FiImage />
                          <span>{centerImage ? 'Change Image' : 'Select Image'}</span>
                        <FiChevronDown />
                      </button>
                        {centerImage && (
                          <button
                            className="customize-btn cancel-btn"
                            onClick={() => {
                              setCenterImage(null)
                              localStorage.removeItem('centerImage')
                              if (centerImageInputRef.current) {
                                centerImageInputRef.current.value = ''
                              }
                            }}
                            style={{ padding: '8px 16px' }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {centerImage && (
                        <div style={{ marginTop: '12px', textAlign: 'center' }}>
                          <img 
                            src={centerImage} 
                            alt="Center preview" 
                            style={{ 
                              maxWidth: '150px', 
                              maxHeight: '150px', 
                              borderRadius: '8px',
                              border: '2px solid #ddd'
                            }} 
                          />
                        </div>
                      )}
                    </div>

                    <div className="customize-field">
                      <label className="customize-label">Image size</label>
                      <select
                        className="customize-select"
                        value={centerImageSize}
                        onChange={(e) => {
                          setCenterImageSize(e.target.value)
                          localStorage.setItem('centerImageSize', e.target.value)
                        }}
                        disabled={!centerImage}
                      >
                        <option value="S">Small</option>
                        <option value="M">Medium</option>
                        <option value="L">Large</option>
                      </select>
                    </div>

                    <div className="customize-checkboxes-grid">
                      <label className="customize-checkbox-label">
                        <FiDroplet className="customize-checkbox-icon" />
                        <input
                          type="checkbox"
                          checked={settings.pageBackgroundColor}
                          onChange={(e) => setSettings({ ...settings, pageBackgroundColor: e.target.checked })}
                        />
                        <span>Page background color</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.contours}
                          onChange={(e) => setSettings({ ...settings, contours: e.target.checked })}
                        />
                        <span>Contours</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.displayColorGradient}
                          onChange={(e) => setSettings({ ...settings, displayColorGradient: e.target.checked })}
                        />
                        <span>Display a color gradient on the page</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.wheelShadow}
                          onChange={(e) => setSettings({ ...settings, wheelShadow: e.target.checked })}
                        />
                        <span>Wheel shadow</span>
                      </label>
                      <label className="customize-checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.pointerChangesColor}
                          onChange={(e) => setSettings({ ...settings, pointerChangesColor: e.target.checked })}
                        />
                        <span>Pointer changes color</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="customize-buttons">
                <button className="customize-btn cancel-btn" onClick={() => setShowCustomize(false)}>
                  Cancel
                </button>
                <button className="customize-btn ok-btn" onClick={() => setShowCustomize(false)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Admin Panel */}
      {showAdminPanel && (
        <AdminPanel 
          onClose={() => setShowAdminPanel(false)} 
          onFileUploaded={handleFileUploaded}
        />
      )}
    </div >
  )
}

export default App
