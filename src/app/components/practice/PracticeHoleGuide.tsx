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

const CHROMATIC_C = Array.from({ length: 12 }, (_, index) => {
  const blowNotes = ['C', 'E', 'G', 'C', 'C', 'E', 'G', 'C', 'C', 'E', 'G', 'C'];
  const drawNotes = ['D', 'F', 'A', 'B', 'D', 'F', 'A', 'B', 'D', 'F', 'A', 'B'];
  return { blow: blowNotes[index], draw: drawNotes[index] };
});

export function HarmonicaStrip({
  activeHole,
  activeType,
  harmonicaType,
}: {
  activeHole: number;
  activeType: 'blow' | 'draw';
  harmonicaType: 'diatonic' | 'chromatic';
}) {
  const holes = harmonicaType === 'chromatic' ? CHROMATIC_C : DIATONIC_C;
  const isChromatic = harmonicaType === 'chromatic';
  return (
    <div
      aria-label={`${isChromatic ? '半音阶' : '十孔'}口琴孔位指示，第 ${activeHole} 孔${activeType === 'blow' ? '吹气' : '吸气'}`}
      style={{
        height: 56,
        padding: '5px 8px 6px',
        background: 'linear-gradient(180deg,#F8FAFC 0%,#CCD4DD 42%,#8792A0 100%)',
        borderTop: '1px solid rgba(255,255,255,0.88)',
        borderBottom: '1px solid rgba(0,0,0,0.55)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -7px 14px rgba(15,23,42,0.28)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          top: 7,
          height: 8,
          borderRadius: 999,
          background: 'linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.12))',
          opacity: 0.75,
          pointerEvents: 'none',
        }}
      />
      {isChromatic && (
        <div
          style={{
            position: 'absolute',
            right: 6,
            top: 14,
            width: 13,
            height: 27,
            borderRadius: 8,
            background: 'linear-gradient(180deg,#E5E7EB,#64748B)',
            border: '1px solid rgba(15,23,42,0.45)',
            boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.7), inset 0 -4px 8px rgba(15,23,42,0.35)',
          }}
        />
      )}
      <div style={{ height: '100%', display: 'flex', gap: isChromatic ? 2 : 3, alignItems: 'stretch', paddingRight: isChromatic ? 13 : 0 }}>
        {holes.map((h, i) => {
          const holeNum = i + 1;
          const isActive = holeNum === activeHole;
          const blowActive = isActive && activeType === 'blow';
          const drawActive = isActive && activeType === 'draw';
          return (
            <div
              key={holeNum}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'grid',
                gridTemplateRows: '9px 1fr 9px',
                alignItems: 'center',
                justifyItems: 'center',
                gap: 1,
              }}
            >
              <div style={{ color: blowActive ? '#007C6D' : '#334155', fontSize: 7, lineHeight: 1, fontWeight: blowActive ? 900 : 750 }}>
                {blowActive ? '吹' : h.blow}
              </div>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 5,
                  background: isActive
                    ? `linear-gradient(180deg,${activeType === 'blow' ? '#7DFFF1' : '#FFB4D2'} 0%,${activeType === 'blow' ? '#00C9B1' : '#FF6B9D'} 46%,#111827 100%)`
                    : 'linear-gradient(180deg,#1F2937 0%,#070A10 55%,#02040A 100%)',
                  border: `1px solid ${isActive ? (activeType === 'blow' ? '#9EFFF5' : '#FFC8DE') : 'rgba(255,255,255,0.22)'}`,
                  boxShadow: isActive
                    ? `0 0 13px ${activeType === 'blow' ? 'rgba(0,201,177,0.75)' : 'rgba(255,107,157,0.75)'}, inset 0 2px 5px rgba(255,255,255,0.45), inset 0 -7px 10px rgba(0,0,0,0.55)`
                    : 'inset 0 2px 5px rgba(255,255,255,0.11), inset 0 -7px 10px rgba(0,0,0,0.75), 0 1px 1px rgba(255,255,255,0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease',
                }}
              >
                <span style={{ color: isActive ? '#F8FFFF' : '#CBD5E1', fontSize: 10, fontWeight: 900, textShadow: '0 1px 3px rgba(0,0,0,0.65)' }}>
                  {holeNum}
                </span>
              </div>
              <div style={{ color: drawActive ? '#BE185D' : '#475569', fontSize: 7, lineHeight: 1, fontWeight: drawActive ? 900 : 750 }}>
                {drawActive ? '吸' : h.draw}
              </div>
            </div>
          );
        })}
      </div>
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
          gap: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          padding: '0 8px',
        }}
      >
        <span
          style={{
            minWidth: 48,
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
        <span style={{ color: '#C05675', fontSize: 12, fontWeight: 800, letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          请跟随节奏进行吹吸练习
        </span>
        <span
          style={{
            minWidth: 48,
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
        <span style={{ color: '#7B879A', fontSize: 11, fontWeight: 800, minWidth: 42, textAlign: 'right' }}>
          第 {activeHole} 孔
        </span>
      </div>
    </div>
  );
}
