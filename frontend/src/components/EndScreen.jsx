import { FiCheckCircle } from 'react-icons/fi'

const EndScreen = ({ winners, onRestart }) => {
  return (
    <div className="end-screen">
      <div className="end-screen-content">
        <FiCheckCircle className="end-screen-icon" />
        <h1 className="end-screen-title">All Spins Complete!</h1>
        <p className="end-screen-subtitle">Thank you for participating</p>
        
        {winners.length > 0 && (
          <div className="end-screen-winners">
            <h2>Final Winners</h2>
            <div className="end-screen-winners-list">
              {winners.map((winner, index) => (
                <div key={index} className="end-screen-winner-item">
                  <span className="end-screen-winner-rank">{index + 1}</span>
                  <span className="end-screen-winner-name">{winner.name}</span>
                  {winner.ticketNumber && (
                    <span className="end-screen-winner-ticket">({winner.ticketNumber})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {onRestart && (
          <button className="end-screen-restart-btn" onClick={onRestart}>
            Start New Session
          </button>
        )}
      </div>
    </div>
  )
}

export default EndScreen

