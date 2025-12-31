import React, { useRef, useEffect, memo } from 'react'

const CanvasWheel = memo(({ names, colors, rotation, width = 800, height = 800, centerImage = null, centerImageSize = 'M' }) => {
    const canvasRef = useRef(null)
    const centerImageLoadedRef = useRef(null)
    const rotationRef = useRef(rotation)
    const animationFrameRef = useRef(null)
    const staticWheelCanvasRef = useRef(null) // Offscreen canvas for static wheel
    const needsRedrawRef = useRef(true) // Track if static wheel needs to be redrawn

    // Update rotation ref without triggering re-render
    useEffect(() => {
        rotationRef.current = rotation
    }, [rotation])

    // Setup canvas and static wheel (only when names/colors change, NOT rotation)
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        // Use optimized context settings for ultra-smooth animation
        const ctx = canvas.getContext('2d', {
            alpha: true,
            desynchronized: true, // Better performance for animations - allows async rendering
            willReadFrequently: false, // Optimize for write operations
            powerPreference: 'high-performance' // Use dedicated GPU if available
        })
        
        // Enable hardware acceleration hints for smooth rendering
        if (ctx.imageSmoothingEnabled !== undefined) {
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high' // Best quality for smooth rendering
        }

        // Create offscreen canvas for static wheel (wheel without rotation)
        const staticCanvas = document.createElement('canvas')
        staticWheelCanvasRef.current = staticCanvas
        const staticCtx = staticCanvas.getContext('2d', {
            alpha: true,
            desynchronized: true,
            willReadFrequently: false,
            powerPreference: 'high-performance'
        })

        // Reduce DPR for many entries to improve performance
        const baseDpr = window.devicePixelRatio || 1
        const dpr = names.length > 2000 ? Math.min(baseDpr, 1.5) : baseDpr

        let canvasWidth = width
        let canvasHeight = height
        let centerX = width / 2
        let centerY = height / 2
        let radius = Math.min(centerX, centerY) - 20

        // Setup canvas size
        const setupCanvas = () => {
            const displayWidth = canvas.clientWidth || width
            const displayHeight = canvas.clientHeight || height

            canvasWidth = displayWidth
            canvasHeight = displayHeight
            centerX = displayWidth / 2
            centerY = displayHeight / 2
            radius = Math.min(centerX, centerY) - 20

            // Set actual size in memory (scaled to account for extra pixel density)
            // Setting width/height resets the context, so we need to reapply settings
            canvas.width = displayWidth * dpr
            canvas.height = displayHeight * dpr
            staticCanvas.width = displayWidth * dpr
            staticCanvas.height = displayHeight * dpr

            // Normalize coordinate system to use css pixels
            ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform
            ctx.scale(dpr, dpr)
            staticCtx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform
            staticCtx.scale(dpr, dpr)
            
            // Enable image smoothing for better quality
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = names.length > 1000 ? 'medium' : 'high'
            staticCtx.imageSmoothingEnabled = true
            staticCtx.imageSmoothingQuality = names.length > 1000 ? 'medium' : 'high'

            needsRedrawRef.current = true
        }

        // Throttle resize for better performance with many entries
        let resizeTimeout = null
        const handleResize = () => {
            if (resizeTimeout) {
                clearTimeout(resizeTimeout)
            }
            
            const throttleDelay = names.length > 5000 ? 100 : names.length > 2000 ? 50 : 0
            
            resizeTimeout = setTimeout(() => {
                setupCanvas()
                drawStaticWheel()
                drawWheel()
            }, throttleDelay)
        }

        const resizeObserver = new ResizeObserver(() => {
            handleResize()
        })
        resizeObserver.observe(canvas)

        // Draw static wheel (without rotation) to offscreen canvas
        const drawStaticWheel = () => {
            if (!staticWheelCanvasRef.current) return

            // Clear static canvas - use CSS pixel dimensions (context is already scaled)
            staticCtx.clearRect(0, 0, canvasWidth, canvasHeight)

            // Handle empty state - show a default gray wheel with message
            if (names.length === 0) {
                // Draw a simple gray circle
                staticCtx.beginPath()
                staticCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
                staticCtx.fillStyle = '#2a2a2a' // Dark gray background
                staticCtx.fill()
                
                // Draw border
                staticCtx.strokeStyle = '#3a3a3a'
                staticCtx.lineWidth = 2
                staticCtx.stroke()
                
                // Draw center hub
                const isMobile = window.innerWidth < 768
                const hubRadius = isMobile ? 35 : 70
                staticCtx.beginPath()
                staticCtx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI)
                staticCtx.fillStyle = 'white'
                staticCtx.shadowColor = 'rgba(0,0,0,0.2)'
                staticCtx.shadowBlur = 5
                staticCtx.fill()
                
                // Draw center image if available
                if (centerImageLoadedRef.current && 
                    centerImageLoadedRef.current.complete && 
                    centerImageLoadedRef.current.naturalWidth > 0) {
                    try {
                        let imageRadius
                        // Desktop gets slightly larger image
                        const desktopMultiplier = isMobile ? 1.0 : 1.1
                        if (centerImageSize === 'S') {
                            imageRadius = hubRadius * 0.75 * desktopMultiplier
                        } else if (centerImageSize === 'L') {
                            imageRadius = hubRadius * 1.45 * desktopMultiplier
                        } else {
                            imageRadius = hubRadius * 1.15 * desktopMultiplier
                        }
                        
                        staticCtx.save()
                        staticCtx.beginPath()
                        staticCtx.arc(centerX, centerY, imageRadius, 0, 2 * Math.PI)
                        staticCtx.clip()
                        staticCtx.drawImage(
                            centerImageLoadedRef.current, 
                            centerX - imageRadius, 
                            centerY - imageRadius, 
                            imageRadius * 2, 
                            imageRadius * 2
                        )
                        staticCtx.restore()
                        
                        // Draw thin white border around the image
                        staticCtx.save()
                        staticCtx.beginPath()
                        staticCtx.arc(centerX, centerY, imageRadius, 0, 2 * Math.PI)
                        staticCtx.strokeStyle = 'white'
                        staticCtx.lineWidth = 1.5
                        staticCtx.stroke()
                        staticCtx.restore()
                    } catch (error) {
                        console.error('Error drawing center image:', error)
                    }
                }
                
                needsRedrawRef.current = false
                return
            }

            const numSegments = names.length
            const sliceAngle = (2 * Math.PI) / numSegments

            const isManyEntries = names.length > 2000
            const isVeryManyEntries = names.length > 5000
            
            if (isVeryManyEntries) {
                staticCtx.imageSmoothingEnabled = false
            }

            // Draw Shadow (behind the wheel) - Skip for many entries for performance
            if (names.length < 2000) {
                staticCtx.save()
                staticCtx.shadowColor = 'rgba(0, 0, 0, 0.3)'
                staticCtx.shadowBlur = 15
                staticCtx.shadowOffsetY = 10
                staticCtx.beginPath()
                staticCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
                staticCtx.fillStyle = 'rgba(0,0,0,0)'
                staticCtx.fill()
                staticCtx.restore()
            }

            const shouldDrawGradient = names.length < 300
            const shouldDrawStrokes = names.length < 500

            // Use Path2D for better performance with many segments
            const segmentPaths = []
            
            // Batch create paths first
            for (let index = 0; index < names.length; index++) {
                const startAngle = index * sliceAngle - Math.PI / 2
                const endAngle = startAngle + sliceAngle
                
                const path = new Path2D()
                path.moveTo(centerX, centerY)
                path.arc(centerX, centerY, radius, startAngle, endAngle)
                path.closePath()
                segmentPaths.push({ path, index, startAngle, endAngle })
            }

            // Draw all segments
            segmentPaths.forEach(({ path, index }) => {
                staticCtx.fillStyle = colors[index % colors.length]
                staticCtx.fill(path)

                // Add gradient (skip for large lists)
                if (shouldDrawGradient && !isManyEntries) {
                    const gradient = staticCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
                    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
                    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0)')
                    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)')
                    staticCtx.fillStyle = gradient
                    staticCtx.fill(path)
                }

                // Draw strokes
                if (shouldDrawStrokes) {
                    const strokeWidth = names.length > 500 ? 0.5 : 1
                    staticCtx.lineWidth = strokeWidth
                    staticCtx.strokeStyle = names.length > 500 ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.1)'
                    staticCtx.stroke(path)
                }
            })

            // Draw text - always show, but adjust size and position based on entries
            segmentPaths.forEach(({ index, startAngle }) => {
                const name = names[index]
                const midAngle = startAngle + sliceAngle / 2
                
                staticCtx.save()
                staticCtx.translate(centerX, centerY)
                staticCtx.rotate(midAngle)

                staticCtx.textAlign = 'right'
                staticCtx.textBaseline = 'middle'

                const bgColor = colors[index % colors.length]
                staticCtx.fillStyle = (bgColor === '#efb71d' || bgColor === '#24a643') ? '#000000' : '#FFFFFF'

                const isMobile = window.innerWidth < 768
                const numEntries = names.length
                
                // Calculate font size based on number of entries
                // Normal size for entries <= 50, then fixed 5px for entries > 50
                let fontSize
                if (numEntries <= 10) {
                    // Normal size for few entries
                    fontSize = isMobile ? 32 : 36
                } else if (numEntries <= 50) {
                    // Slightly smaller but still normal
                    fontSize = isMobile ? 24 : 28
                } else {
                    // Fixed 5px for all entries > 50
                    fontSize = 5
                }
                
                // Also consider arc length to prevent text overflow
                const textRadius = radius - (numEntries > 100 ? 5 : numEntries > 50 ? 8 : 12)
                const arcLength = textRadius * sliceAngle
                const maxSizeFromArc = arcLength / (isMobile ? 4 : 5)
                
                // For entries > 50, keep 5px fixed, but don't exceed arc length
                if (numEntries > 50) {
                    fontSize = Math.min(5, maxSizeFromArc)
                } else {
                    fontSize = Math.min(fontSize, maxSizeFromArc)
                }
                
                // Ensure minimum readable size (5px for entries > 50, normal minimum for <= 50)
                const minSize = numEntries > 50 ? 5 : (isMobile ? 6 : 8)
                fontSize = Math.max(minSize, fontSize)

                staticCtx.font = `500 ${fontSize}px "Montserrat", sans-serif`
                staticCtx.shadowColor = 'rgba(0,0,0,0.2)'
                staticCtx.shadowBlur = 2
                staticCtx.shadowOffsetX = 1
                staticCtx.shadowOffsetY = 1

                // Truncate long names based on entries
                let displayName = name
                if (numEntries > 500 && name.length > 8) {
                    displayName = name.substring(0, 8) + '...'
                } else if (numEntries > 200 && name.length > 12) {
                    displayName = name.substring(0, 12) + '...'
                } else if (numEntries > 100 && name.length > 15) {
                    displayName = name.substring(0, 15) + '...'
                }

                // Position text at corner (closer to edge when more entries)
                // More entries = closer to edge (corner)
                const textPosition = numEntries > 100 ? radius - 5 : numEntries > 50 ? radius - 8 : radius - 12
                staticCtx.fillText(displayName, textPosition, 0)
                staticCtx.restore()
            })

            // Draw Center Hub (static, no image rotation)
            const isMobile = window.innerWidth < 768
            const hubRadius = isMobile ? 35 : 70

            staticCtx.beginPath()
            staticCtx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI)
            staticCtx.fillStyle = 'white'
            staticCtx.shadowColor = 'rgba(0,0,0,0.2)'
            staticCtx.shadowBlur = 5
            staticCtx.fill()

            needsRedrawRef.current = false
        }

        // Draw wheel with rotation (composite static wheel + rotation)
        const drawWheel = () => {
            // Ensure we have valid dimensions
            if (canvasWidth <= 0 || canvasHeight <= 0) {
                return
            }
            
            // Clear canvas
            ctx.clearRect(0, 0, canvasWidth, canvasHeight)

            // Draw static wheel with rotation
            // The rotation value represents clockwise rotation in degrees
            // Canvas rotate() rotates the coordinate system counter-clockwise for positive angles
            // To make the wheel appear to rotate clockwise, we rotate the coordinate system counter-clockwise
            // This means we use a positive angle (no negation needed)
            ctx.save()
            ctx.translate(centerX, centerY)
            ctx.rotate((rotationRef.current * Math.PI) / 180) // Positive angle for clockwise wheel rotation
            ctx.translate(-centerX, -centerY)
            
            // Draw the static wheel from offscreen canvas
            // The static canvas has internal dimensions (canvasWidth * dpr, canvasHeight * dpr)
            // The main canvas context is scaled by dpr, so we draw at CSS pixel dimensions
            // Draw the full static canvas using its actual internal dimensions as source
            if (staticWheelCanvasRef.current && staticWheelCanvasRef.current.width > 0 && staticWheelCanvasRef.current.height > 0) {
                // Source: full static canvas (canvasWidth * dpr x canvasHeight * dpr)
                // Destination: CSS pixel dimensions (canvasWidth x canvasHeight) - context handles DPR scaling
                ctx.drawImage(
                    staticWheelCanvasRef.current,
                    0, 0, staticWheelCanvasRef.current.width, staticWheelCanvasRef.current.height, // Source: full canvas
                    0, 0, canvasWidth, canvasHeight // Destination: CSS pixels (context is scaled)
                )
            } else {
                // If static canvas not ready, draw directly (fallback)
                needsRedrawRef.current = true
                drawStaticWheel()
                if (staticWheelCanvasRef.current && staticWheelCanvasRef.current.width > 0) {
                    ctx.drawImage(staticWheelCanvasRef.current, 0, 0, canvasWidth, canvasHeight)
                }
            }
            
            // Draw center image with rotation (if provided)
            if (centerImageLoadedRef.current && 
                centerImageLoadedRef.current.complete && 
                centerImageLoadedRef.current.naturalWidth > 0) {
                try {
                    const isMobile = window.innerWidth < 768
                    const hubRadius = isMobile ? 35 : 70
                    
                    let imageRadius
                    // Desktop gets slightly larger image
                    const desktopMultiplier = isMobile ? 1.0 : 1.1
                    if (centerImageSize === 'S') {
                        imageRadius = hubRadius * 0.75 * desktopMultiplier
                    } else if (centerImageSize === 'L') {
                        imageRadius = hubRadius * 1.45 * desktopMultiplier
                    } else {
                        imageRadius = hubRadius * 1.15 * desktopMultiplier
                    }
                    
                    ctx.save()
                    ctx.beginPath()
                    ctx.arc(centerX, centerY, imageRadius, 0, 2 * Math.PI)
                    ctx.clip()
                    ctx.drawImage(
                        centerImageLoadedRef.current, 
                        centerX - imageRadius, 
                        centerY - imageRadius, 
                        imageRadius * 2, 
                        imageRadius * 2
                    )
                    ctx.restore()
                    
                    // Draw thin white border around the image
                    ctx.save()
                    ctx.beginPath()
                    ctx.arc(centerX, centerY, imageRadius, 0, 2 * Math.PI)
                    ctx.strokeStyle = 'white'
                    ctx.lineWidth = 1.5
                    ctx.stroke()
                    ctx.restore()
                } catch (error) {
                    console.error('Error drawing center image:', error)
                }
            }

            ctx.restore()
        }

        // Animation loop - continuously redraw with current rotation
        // Optimized for smooth 60fps rendering - no frame skipping
        let lastFrameTime = performance.now()
        const targetFPS = 60
        const frameInterval = 1000 / targetFPS
        
        const animate = (currentTime) => {
            const elapsed = currentTime - lastFrameTime
            
            // Ensure consistent frame rate for smooth animation
            if (elapsed >= frameInterval) {
                drawWheel()
                lastFrameTime = currentTime - (elapsed % frameInterval)
            }
            
            animationFrameRef.current = requestAnimationFrame(animate)
        }

        // Load center image when it changes
        if (centerImage) {
            if (!centerImageLoadedRef.current || centerImageLoadedRef.current.src !== centerImage) {
                const img = new Image()
                img.crossOrigin = 'anonymous'
                img.onload = () => {
                    centerImageLoadedRef.current = img
                    drawStaticWheel()
                    drawWheel()
                }
                img.onerror = (error) => {
                    console.error('Failed to load center image:', centerImage, error)
                    centerImageLoadedRef.current = null
                }
                if (typeof centerImage === 'string') {
                    img.src = centerImage
                }
            }
        } else {
            centerImageLoadedRef.current = null
        }

        // Initial setup - use requestAnimationFrame to ensure canvas is ready
        const initialize = () => {
            const displayWidth = canvas.clientWidth || width
            const displayHeight = canvas.clientHeight || height
            
            if (displayWidth > 0 && displayHeight > 0) {
                setupCanvas()
                drawStaticWheel()
                // Draw immediately to ensure visibility
                drawWheel()
                // Start animation loop
                animationFrameRef.current = requestAnimationFrame(animate)
            } else {
                // Canvas not ready yet, try again next frame
                animationFrameRef.current = requestAnimationFrame(initialize)
            }
        }
        
        // Start initialization
        animationFrameRef.current = requestAnimationFrame(initialize)

        return () => {
            resizeObserver.disconnect()
            if (resizeTimeout) {
                clearTimeout(resizeTimeout)
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
                animationFrameRef.current = null
            }
        }
    }, [names, colors, width, height, centerImage, centerImageSize]) // Removed rotation from dependencies

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100%',
                height: '100%',
                touchAction: 'none'
            }}
        />
    )
})

CanvasWheel.displayName = 'CanvasWheel'

export default CanvasWheel
