const DIATONIC_C = [
  { blow: 'C', draw: 'D' },
  { blow: 'E', draw: 'G' },
  { blow: 'G', draw: 'B' },
  { blow: 'C', draw: 'D' },
  { blow: 'E', draw: 'F' },
  { blow: 'G', draw: 'A' },
  { blow: 'C', draw: 'B' },
  { blow: 'E', draw: 'D' },
  { blow: 'G', draw: 'F' },
  { blow: 'C', draw: 'A' },
];

export function HarmonicaStrip({
  activeHole,
  activeType,
  harmonicaType,
}: {
  activeHole: number;
  activeType: 'blow' | 'draw';
  harmonicaType: 'diatonic' | 'chromatic';
}) {
  const holes = harmonicaType === 'chromatic'
    ? Array.from({ length: 12 }, () => ({ blow: '', draw: '' }))
    : DIATONIC_C;
  return (
    <div
      style={{
        background: 'linear-gradient(180deg,#E7EBF0 0%,#B9C0C8 100%)',
        borderTop: '1px solid rgba(255,255,255,0.65)',
        borderBottom: '1px solid rgba(0,0,0,0.45)',
        padding: '4px 5px 5px',
        display: 'flex',
        alignItems: 'stretch',
        gap: 3,
      }}
    >
      {holes.map((h, i) => {
        const holeNum = i + 1;
        const isActive = holeNum === activeHole;
        const blowColor = '#00C9B1';
        const drawColor = '#FF6B9D';
        return (
          <div
            key={holeNum}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: 7, color: isActive && activeType === 'blow' ? blowColor : '#5D6675', fontWeight: isActive ? 800 : 600, lineHeight: 1, height: 8 }}>
              {isActive && activeType === 'blow' ? '↑吹' : h.blow}
            </div>

            <div
              style={{
                width: '100%',
                height: 34,
                borderRadius: 5,
                background: isActive
                  ? `linear-gradient(180deg, ${activeType === 'blow' ? '#66FFF0' : '#FF9BC4'} 0%, ${activeType === 'blow' ? blowColor : drawColor} 48%, #1C2832 100%)`
                  : 'linear-gradient(180deg,#303642 0%,#0D1119 52%,#03060B 100%)',
                border: `1.5px solid ${isActive ? (activeType === 'blow' ? '#7DFFF1' : '#FFB4D2') : 'rgba(255,255,255,0.16)'}`,
                boxShadow: isActive
                  ? `0 0 14px ${activeType === 'blow' ? blowColor : drawColor}aa, inset 0 2px 4px rgba(255,255,255,0.35), inset 0 -4px 8px rgba(0,0,0,0.5)`
                  : 'inset 0 2px 4px rgba(255,255,255,0.08), inset 0 -5px 9px rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 850, color: isActive ? '#F8FFFF' : 'rgba(255,255,255,0.62)', transition: 'color 0.15s', textShadow: isActive ? '0 1px 5px rgba(0,0,0,0.5)' : 'none' }}>
                {holeNum}
              </span>
            </div>

            <div style={{ fontSize: 7, color: isActive && activeType === 'draw' ? drawColor : '#5D6675', fontWeight: isActive ? 800 : 600, lineHeight: 1, height: 8 }}>
              {isActive && activeType === 'draw' ? '↓吸' : h.draw}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BreathGuideBar({
  activeType,
  activeHole,
}: {
  activeType: 'blow' | 'draw';
  activeHole: number;
}) {
  const isBlow = activeType === 'blow';
  return (
    <div
      style={{
        height: 42,
        padding: '0 12px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(180deg,#0A0F1C 0%,#080D18 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 30,
          borderRadius: 16,
          background: 'rgba(255,255,255,0.96)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        }}
      >
        <span
          style={{
            minWidth: 46,
            height: 24,
            borderRadius: 12,
            background: isBlow ? 'linear-gradient(180deg,#D9FFF8,#A7FFF0)' : 'rgba(0,201,177,0.1)',
            border: `1px solid ${isBlow ? 'rgba(0,201,177,0.45)' : 'rgba(0,201,177,0.16)'}`,
            color: '#008977',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            fontSize: 12,
            fontWeight: 850,
          }}
        >
          ↑ 吹
        </span>
        <span style={{ color: '#C05675', fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>
          请跟随节奏进行吹吸练习
        </span>
        <span
          style={{
            minWidth: 46,
            height: 24,
            borderRadius: 12,
            background: !isBlow ? 'linear-gradient(180deg,#FFE0ED,#FFB7D3)' : 'rgba(255,107,157,0.1)',
            border: `1px solid ${!isBlow ? 'rgba(255,107,157,0.48)' : 'rgba(255,107,157,0.16)'}`,
            color: '#C02663',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            fontSize: 12,
            fontWeight: 850,
          }}
        >
          ↓ 吸
        </span>
        <span style={{ color: '#7B879A', fontSize: 11, fontWeight: 700 }}>
          第 {activeHole} 孔
        </span>
      </div>
    </div>
  );
}
