import { getPracticeChart } from '../../data/practiceCharts';
import { getVisibleTraditionalScore } from '../../../engine/scoreLayout';

function formatDuration(durationBeats?: number) {
  if (!durationBeats || durationBeats === 1) return '';
  if (durationBeats === 0.5) return '半拍';
  if (Number.isInteger(durationBeats)) return `${durationBeats}拍`;
  return `${durationBeats.toFixed(1).replace(/\.0$/, '')}拍`;
}

export function TraditionalScorePanel({
  scoreMeasures,
  currentBeatFloat,
  isPlaying,
  combo,
}: {
  scoreMeasures: ReturnType<typeof getPracticeChart>['chart']['measures'];
  currentBeatFloat: number;
  isPlaying: boolean;
  combo: number;
}) {
  const currentBeatRounded = Math.floor(currentBeatFloat);
  const rows = getVisibleTraditionalScore(scoreMeasures, currentBeatFloat);
  return (
    <div
      style={{
        height: 128,
        padding: '7px 12px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          flex: 1,
          background: 'rgba(255,255,255,0.97)',
          borderRadius: 14,
          padding: '8px 10px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
          overflow: 'hidden',
        }}
      >
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`, gap: 3, marginTop: rowIndex === 0 ? 0 : 6 }}>
            {row.map((item) => {
              const active = isPlaying && item.absoluteBeat === currentBeatRounded;
              const isMeasureStart = item.beatInMeasure === 0;
              const durationLabel = formatDuration(item.beat.durationBeats);
              const lyric = item.beat.lyric;
              return (
                <div
                  key={item.absoluteBeat}
                  style={{
                    minWidth: 0,
                    height: 45,
                    borderLeft: isMeasureStart ? '1px solid #CBD5E1' : 'none',
                    borderRadius: active ? 8 : 4,
                    background: active ? '#F9A8D4' : 'transparent',
                    boxShadow: active ? '0 0 0 1px rgba(219,39,119,0.22), 0 5px 16px rgba(219,39,119,0.22)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: active ? 'translateY(-1px)' : 'none',
                    transition: 'background 0.12s, transform 0.12s, box-shadow 0.12s',
                    position: 'relative',
                  }}
                >
                  {isMeasureStart && (
                    <span style={{ position: 'absolute', left: 2, top: 1, fontSize: 8, color: '#94A3B8' }}>
                      {item.measure + 1}
                    </span>
                  )}
                  {durationLabel && (
                    <span style={{ position: 'absolute', right: 2, top: 1, fontSize: 7, color: active ? '#9F1239' : '#94A3B8', fontWeight: 700 }}>
                      {durationLabel}
                    </span>
                  )}
                  <span style={{ fontSize: active ? 18 : 16, fontWeight: active ? 850 : 700, color: active ? '#831843' : item.beat.t === 'rest' ? '#C0C8D8' : '#111827', lineHeight: 1 }}>
                    {item.beat.n}
                  </span>
                  <span style={{ fontSize: 8, color: item.beat.t === 'blow' ? '#00A58F' : item.beat.t === 'draw' ? '#DB2777' : '#CBD5E1', lineHeight: 1.1 }}>
                    {item.beat.t === 'blow' ? '↑吹' : item.beat.t === 'draw' ? '↓吸' : '·'}
                  </span>
                  <span style={{ maxWidth: '100%', minHeight: 10, padding: '0 1px', fontSize: 8, color: active ? '#831843' : '#64748B', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lyric ?? ''}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {combo >= 5 && (
        <div style={{ marginLeft: 8, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#F59E0B' }}>COMBO</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>{combo}</div>
        </div>
      )}
    </div>
  );
}
