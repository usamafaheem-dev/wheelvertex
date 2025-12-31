import { FiTrophy, FiAward } from 'react-icons/fi'

const WinnersLadder = ({ winners }) => {
  return (
    <div className="winners-ladder">
      <div className="winners-ladder-header">
        <FiTrophy className="winners-ladder-icon" />
        <h3>Winners Ladder</h3>
      </div>
      <div className="winners-ladder-list">
        {winners.length === 0 ? (
          <div className="winners-ladder-empty">No winners yet</div>
        ) : (
          winners.map((winner, index) => (
            <div key={index} className="winners-ladder-item">
              <div className="winners-ladder-rank">
                <FiAward className="winners-ladder-rank-icon" />
                <span className="winners-ladder-rank-number">{index + 1}</span>
              </div>
              <div className="winners-ladder-info">
                <div className="winners-ladder-name">{winner.name}</div>
                {winner.ticketNumber && (
                  <div className="winners-ladder-ticket">Ticket: {winner.ticketNumber}</div>
                )}
              </div>
              <div className="winners-ladder-color" style={{ backgroundColor: winner.color }}></div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default WinnersLadder

