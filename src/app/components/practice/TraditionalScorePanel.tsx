import { getPracticeChart, type ScoreNotation, type ScoreNotationToken } from '../../data/practiceCharts';
import { getVisibleTraditionalScore } from '../../../engine/scoreLayout';

function formatDuration(durationBeats?: number) {
  if (!durationBeats || durationBeats === 1) return '';
  if (durationBeats === 0.5) return '半拍';
  if (Number.isInteger(durationBeats)) return `${durationBeats}拍`;
  return `${durationBeats.toFixed(1).replace(/\.0$/, '')}拍`;
}

function isTokenActive(token: ScoreNotationToken, currentBeatFloat: number, isPlaying: boolean) {
  if (!isPlaying || token.kind !== 'note' || token.startBeat === undefined) return false;
  const duration = token.durationBeats ?? 1;
  return token.startBeat <= currentBeatFloat && currentBeatFloat < token.startBeat + duration;
}

function getVisibleNotationLines(notation: ScoreNotation, currentBeatFloat: number) {
  const activeIndex = notation.lines.findIndex((line) => currentBeatFloat >= line.startBeat && currentBeatFloat < line.endBeat);
  const firstIndex = Math.max(0, activeIndex === -1 ? notation.lines.length - 1 : activeIndex);
  return [notation.lines[firstIndex], notation.lines[firstIndex + 1]].filter(Boolean);
}

function NotationTokenView({
  token,
  active,
}: {
  token: ScoreNotationToken;
  active: boolean;
}) {
  if (token.kind === 'section') {
    return (
      <span
        style={{
          alignSelf: 'flex-start',
          minWidth: 18,
          height: 18,
          border: '1px solid #64748B',
          borderRadius: 3,
          color: active ? '#831843' : '#334155',
          fontSize: 11,
          fontWeight: 850,
          lineHeight: '16px',
          textAlign: 'center',
          background: active ? '#FCE7F3' : '#F8FAFC',
        }}
      >
        {token.text}
      </span>
    );
  }

  const color = active ? '#831843' : token.kind === 'rest' || token.kind === 'hold' ? '#64748B' : '#111827';
  const lyric = token.lyric ?? '';
  return (
    <span
      style={{
        minWidth: token.kind === 'hold' ? 12 : 18,
        padding: active ? '2px 5px 1px' : '2px 3px 1px',
        borderRadius: active ? 7 : 4,
        background: active ? '#F9A8D4' : 'transparent',
        boxShadow: active ? '0 0 0 1px rgba(219,39,119,0.22), 0 4px 13px rgba(219,39,119,0.18)' : 'none',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        position: 'relative',
        transform: active ? 'translateY(-1px)' : 'none',
        transition: 'background 0.12s, transform 0.12s, box-shadow 0.12s',
      }}
    >
      {token.slur && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -3,
            left: 2,
            right: 2,
            height: 8,
            borderTop: `1px solid ${active ? '#9F1239' : '#334155'}`,
            borderRadius: '50% 50% 0 0',
          }}
        />
      )}
      {token.octave === 'high' && (
        <span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: '50%', background: color, marginBottom: 1 }} />
      )}
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
        <span
          style={{
            fontSize: active ? 17 : 15,
            fontWeight: active ? 900 : 800,
            color,
            lineHeight: 1,
            fontFamily: 'ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          {token.text}
        </span>
        {token.suffix && (
          <span style={{ color, fontSize: 10, fontWeight: 750, lineHeight: 1 }}>{token.suffix}</span>
        )}
      </span>
      {token.underline ? (
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            width: 13,
            marginTop: 1,
          }}
        >
          {Array.from({ length: token.underline }).map((_, index) => (
            <span key={index} style={{ height: 1, background: color, borderRadius: 1 }} />
          ))}
        </span>
      ) : (
        <span aria-hidden="true" style={{ height: 2 }} />
      )}
      {token.octave === 'low' && (
        <span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: '50%', background: color, marginTop: 1 }} />
      )}
      <span
        style={{
          minHeight: 11,
          color: active ? '#831843' : '#64748B',
          fontSize: 9,
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          marginTop: 2,
        }}
      >
        {lyric}
      </span>
    </span>
  );
}

function NotationScore({
  notation,
  currentBeatFloat,
  isPlaying,
}: {
  notation: ScoreNotation;
  currentBeatFloat: number;
  isPlaying: boolean;
}) {
  const lines = getVisibleNotationLines(notation, currentBeatFloat);
  return (
    <>
      {lines.map((line, rowIndex) => (
        <div
          key={line.id}
          style={{
            minHeight: 45,
            display: 'flex',
            alignItems: 'stretch',
            gap: 5,
            opacity: rowIndex === 0 ? 1 : 0.62,
            marginTop: rowIndex === 0 ? 0 : 6,
          }}
        >
          {line.measures.map((measure) => (
            <span
              key={measure.id}
              style={{
                display: 'inline-flex',
                alignItems: 'flex-end',
                gap: 2,
                paddingLeft: 5,
                borderLeft: '1px solid #CBD5E1',
              }}
            >
              {measure.tokens.map((token) => (
                <NotationTokenView
                  key={token.id}
                  token={token}
                  active={isTokenActive(token, currentBeatFloat, isPlaying)}
                />
              ))}
            </span>
          ))}
          {rowIndex === lines.length - 1 && (
            <span style={{ borderLeft: '1px solid #CBD5E1', width: 1, flexShrink: 0 }} />
          )}
        </div>
      ))}
    </>
  );
}

export function TraditionalScorePanel({
  scoreMeasures,
  notation,
  currentBeatFloat,
  isPlaying,
  combo,
}: {
  scoreMeasures: ReturnType<typeof getPracticeChart>['chart']['measures'];
  notation?: ScoreNotation;
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
        {notation ? (
          <NotationScore notation={notation} currentBeatFloat={currentBeatFloat} isPlaying={isPlaying} />
        ) : (
          rows.map((row, rowIndex) => (
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
          ))
        )}
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
