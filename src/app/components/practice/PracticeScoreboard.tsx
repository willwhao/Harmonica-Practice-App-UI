import { ArrowLeft } from 'lucide-react';

interface PracticeScoreboardProps {
  title: string;
  subtitle: string;
  score: number;
  accuracy: number;
  progressPct: number;
  onBack: () => void;
}

export function PracticeScoreboard({
  title,
  subtitle,
  score,
  accuracy,
  progressPct,
  onBack,
}: PracticeScoreboardProps) {
  const safeProgress = Math.max(0, Math.min(100, progressPct));

  return (
    <>
      <div
        style={{
          height: 50,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          flexShrink: 0,
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="返回练习设置"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} color="#E2EAF8" />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: '#E2EAF8',
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          <div style={{ color: '#6B80A8', fontSize: 10 }}>{subtitle}</div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: '#00C9B1', fontSize: 16, fontWeight: 700 }}>{score.toLocaleString()}</div>
          <div style={{ color: '#6B80A8', fontSize: 10 }}>准确率 {accuracy}%</div>
        </div>
      </div>

      <div
        aria-label="练习进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeProgress)}
        role="progressbar"
        style={{ height: 2, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}
      >
        <div
          style={{
            height: '100%',
            width: `${safeProgress}%`,
            background: 'linear-gradient(90deg,#00C9B1,#0099A0)',
            transition: 'width 0.3s linear',
          }}
        />
      </div>
    </>
  );
}
