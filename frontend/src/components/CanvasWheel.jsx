import React, { useRef, useEffect, memo } from 'react'

const CanvasWheel = memo(({ names, colors, rotationRef, width = 800, height = 800, centerImage = null, centerImageSize = 'M' }) => {
    const canvasRef = useRef(null)
    const centerImageLoadedRef = useRef(null)
    const animationFrameRef = useRef(null)
    const staticWheelCanvasRef = useRef(null)
    const needsRedrawRef = useRef(true)

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

        // Create offscreen canvas for static wheel (initial placeholder)
        const staticCanvas = document.createElement('canvas')
        staticWheelCanvasRef.current = staticCanvas

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
            // staticCanvas size is managed per-draw in drawStaticWheel (double buffer)

            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.scale(dpr, dpr)
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = names.length > 1000 ? 'medium' : 'high'

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

        const drawStaticWheel = () => {
            // Draw to a TEMP canvas first, then swap atomically — never shows blank frame
            const tempCanvas = document.createElement('canvas')
            // Use current canvas dimensions (not old static canvas which may be 0)
            tempCanvas.width = canvasWidth * dpr
            tempCanvas.height = canvasHeight * dpr
            const tempCtx = tempCanvas.getContext('2d', { alpha: true, willReadFrequently: false })
            tempCtx.setTransform(1, 0, 0, 1, 0, 0)
            tempCtx.scale(dpr, dpr)
            tempCtx.imageSmoothingEnabled = true
            tempCtx.imageSmoothingQuality = names.length > 1000 ? 'medium' : 'high'
            const sCtx = tempCtx

            // Handle empty state
            if (names.length === 0) {
                sCtx.beginPath()
                sCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
                sCtx.fillStyle = '#2a2a2a'
                sCtx.fill()
                sCtx.strokeStyle = '#3a3a3a'
                sCtx.lineWidth = 2
                sCtx.stroke()
                const isMobile = window.innerWidth < 768
                const hubRadius = isMobile ? 35 : 70
                sCtx.beginPath()
                sCtx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI)
                sCtx.fillStyle = 'white'
                sCtx.shadowColor = 'rgba(0,0,0,0.2)'
                sCtx.shadowBlur = 5
                sCtx.fill()
                if (centerImageLoadedRef.current?.complete && centerImageLoadedRef.current?.naturalWidth > 0) {
                    try {
                        const desktopMultiplier = isMobile ? 1.0 : 1.1
                        let imageRadius = centerImageSize === 'S' ? hubRadius * 0.75 * desktopMultiplier
                            : centerImageSize === 'L' ? hubRadius * 1.45 * desktopMultiplier
                            : hubRadius * 1.15 * desktopMultiplier
                        sCtx.save()
                        sCtx.beginPath()
                        sCtx.arc(centerX, centerY, imageRadius, 0, 2 * Math.PI)
                        sCtx.clip()
                        sCtx.drawImage(centerImageLoadedRef.current, centerX - imageRadius, centerY - imageRadius, imageRadius * 2, imageRadius * 2)
                        sCtx.restore()
                        sCtx.save()
                        sCtx.beginPath()
                        sCtx.arc(centerX, centerY, imageRadius, 0, 2 * Math.PI)
                        sCtx.strokeStyle = 'white'
                        sCtx.lineWidth = 1.5
                        sCtx.stroke()
                        sCtx.restore()
                    } catch (e) {}
                }
                // Atomic swap
                staticWheelCanvasRef.current = tempCanvas
                needsRedrawRef.current = false
                return
            }

            const numSegments = names.length
            const sliceAngle = (2 * Math.PI) / numSegments
            const isManyEntries = names.length > 2000
            const isVeryManyEntries = names.length > 5000

            if (isVeryManyEntries) sCtx.imageSmoothingEnabled = false

            if (names.length < 2000) {
                sCtx.save()
                sCtx.shadowColor = 'rgba(0, 0, 0, 0.3)'
                sCtx.shadowBlur = 15
                sCtx.shadowOffsetY = 10
                sCtx.beginPath()
                sCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
                sCtx.fillStyle = 'rgba(0,0,0,0)'
                sCtx.fill()
                sCtx.restore()
            }

            const shouldDrawGradient = names.length < 300
            const shouldDrawStrokes = names.length < 500
            const segmentPaths = []

            for (let index = 0; index < names.length; index++) {
                const startAngle = index * sliceAngle - Math.PI / 2
                const endAngle = startAngle + sliceAngle
                const path = new Path2D()
                path.moveTo(centerX, centerY)
                path.arc(centerX, centerY, radius, startAngle, endAngle)
                path.closePath()
                segmentPaths.push({ path, index, startAngle, endAngle })
            }

            segmentPaths.forEach(({ path, index }) => {
                sCtx.fillStyle = colors[index % colors.length]
                sCtx.fill(path)
                if (shouldDrawGradient && !isManyEntries) {
                    const gradient = sCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
                    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
                    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0)')
                    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)')
                    sCtx.fillStyle = gradient
                    sCtx.fill(path)
                }
                if (shouldDrawStrokes) {
                    sCtx.lineWidth = names.length > 500 ? 0.5 : 1
                    sCtx.strokeStyle = names.length > 500 ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.1)'
                    sCtx.stroke(path)
                }
            })

            segmentPaths.forEach(({ index, startAngle }) => {
                const name = names[index]
                const midAngle = startAngle + sliceAngle / 2
                sCtx.save()
                sCtx.translate(centerX, centerY)
                sCtx.rotate(midAngle)
                sCtx.textAlign = 'right'
                sCtx.textBaseline = 'middle'
                const bgColor = colors[index % colors.length]
                sCtx.fillStyle = (bgColor === '#efb71d' || bgColor === '#24a643') ? '#000000' : '#FFFFFF'
                const isMobile = window.innerWidth < 768
                const numEntries = names.length
                let fontSize
                if (numEntries <= 10) fontSize = isMobile ? 32 : 36
                else if (numEntries <= 50) fontSize = isMobile ? 24 : 28
                else fontSize = 5
                const textRadius = radius - (numEntries > 100 ? 5 : numEntries > 50 ? 8 : 12)
                const arcLength = textRadius * sliceAngle
                const maxSizeFromArc = arcLength / (isMobile ? 4 : 5)
                fontSize = numEntries > 50 ? Math.min(5, maxSizeFromArc) : Math.min(fontSize, maxSizeFromArc)
                const minSize = numEntries > 50 ? 5 : (isMobile ? 6 : 8)
                fontSize = Math.max(minSize, fontSize)
                sCtx.font = `500 ${fontSize}px "Montserrat", sans-serif`
                sCtx.shadowColor = 'rgba(0,0,0,0.2)'
                sCtx.shadowBlur = 2
                sCtx.shadowOffsetX = 1
                sCtx.shadowOffsetY = 1
                let displayName = name
                if (numEntries > 500 && name.length > 8) displayName = name.substring(0, 8) + '...'
                else if (numEntries > 200 && name.length > 12) displayName = name.substring(0, 12) + '...'
                else if (numEntries > 100 && name.length > 15) displayName = name.substring(0, 15) + '...'
                const textPosition = numEntries > 100 ? radius - 5 : numEntries > 50 ? radius - 8 : radius - 12
                sCtx.fillText(displayName, textPosition, 0)
                sCtx.restore()
            })

            const isMobile = window.innerWidth < 768
            const hubRadius = isMobile ? 35 : 70
            sCtx.beginPath()
            sCtx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI)
            sCtx.fillStyle = 'white'
            sCtx.shadowColor = 'rgba(0,0,0,0.2)'
            sCtx.shadowBlur = 5
            sCtx.fill()

            // Atomic swap — old canvas stays visible until new one is fully drawn
            staticWheelCanvasRef.current = tempCanvas
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

        // Animation loop - draw every frame, no FPS cap (browser handles vsync via rAF)
        const animate = () => {
            drawWheel()
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
