import type { CameBackToRoaster } from '../../lib/yearInCoffee';

interface CameBackToListProps {
  roasters: CameBackToRoaster[];
}

export function CameBackToList({ roasters }: CameBackToListProps) {
  if (roasters.length === 0) {
    return null;
  }

  const maxGrams = Math.max(...roasters.map((r) => r.grams), 1);

  return (
    <div className="stats-card">
      <div className="stats-card-eyebrow">You keep coming back to</div>
      <div className="stats-rank-list">
        {roasters.map((roaster) => {
          const widthPercent = Math.max(Math.round((roaster.grams / maxGrams) * 100), 8);
          const kg = (roaster.grams / 1000).toFixed(1);

          return (
            <div key={roaster.name} className="stats-rank-row">
              <div className="stats-rank-meta">
                <span className="stats-rank-name">{roaster.name}</span>
                <span className="stats-rank-amount">{kg} kg</span>
              </div>
              <div className="stats-bar-track" aria-hidden="true">
                <div className="stats-bar-fill" style={{ width: `${widthPercent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
