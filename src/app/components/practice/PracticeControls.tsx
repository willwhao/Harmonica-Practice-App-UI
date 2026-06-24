import { Mic, MicOff, Pause, Play, RotateCcw, TimerReset, Volume2, VolumeX } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { PracticeSettings } from '../../types';

export function PracticeControls({
  isPlaying,
  displayTime,
  micOn,
  metronomeOn,
  accompanimentOn,
  accompaniment,
  onRestart,
  onBeginPractice,
  onPause,
  onResume,
  onToggleMicrophone,
  setMetronomeOn,
  setAccompanimentOn,
  prepareMetronome,
  prepareAccompaniment,
}: {
  isPlaying: boolean;
  displayTime: number;
  micOn: boolean;
  metronomeOn: boolean;
  accompanimentOn: boolean;
  accompaniment: PracticeSettings['accompaniment'];
  onRestart: () => void;
  onBeginPractice: () => void;
  onPause: () => void;
  onResume: () => void;
  onToggleMicrophone: () => void;
  setMetronomeOn: Dispatch<SetStateAction<boolean>>;
  setAccompanimentOn: Dispatch<SetStateAction<boolean>>;
  prepareMetronome: () => Promise<unknown>;
  prepareAccompaniment: () => Promise<unknown>;
}) {
  return (
    <div
      style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 20px',
        background: '#0A0E1A',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onRestart}
        aria-label="重新开始"
        style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <RotateCcw size={17} color="#A8BCD8" />
      </button>

      <button
        type="button"
        onClick={() => {
          if (!isPlaying && displayTime === 0) onBeginPractice();
          else if (isPlaying) onPause();
          else onResume();
        }}
        aria-label={isPlaying ? '暂停练习' : '继续练习'}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: 'linear-gradient(135deg,#00C9B1,#0099A0)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,201,177,0.4)',
        }}
      >
        {isPlaying ? <Pause size={22} color="#051015" fill="#051015" /> : <Play size={22} color="#051015" fill="#051015" />}
      </button>

      <button
        type="button"
        onClick={onToggleMicrophone}
        aria-label={micOn ? '关闭麦克风音高识别' : '开启麦克风音高识别'}
        aria-pressed={micOn}
        style={{ width: 40, height: 40, borderRadius: 20, background: micOn ? 'rgba(0,201,177,0.12)' : 'rgba(255,255,255,0.07)', border: '1px solid', borderColor: micOn ? 'rgba(0,201,177,0.3)' : 'rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {micOn ? <Mic size={17} color="#00C9B1" /> : <MicOff size={17} color="#6B80A8" />}
      </button>

      <button
        type="button"
        onClick={() => setMetronomeOn((value) => { const next = !value; if (next) void prepareMetronome(); return next; })}
        aria-label={metronomeOn ? '关闭节拍器' : '开启节拍器'}
        aria-pressed={metronomeOn}
        style={{ width: 40, height: 40, borderRadius: 20, background: metronomeOn ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.07)', border: `1px solid ${metronomeOn ? 'rgba(245,158,11,0.3)' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <TimerReset size={17} color={metronomeOn ? '#F59E0B' : '#A8BCD8'} />
      </button>

      <button
        type="button"
        onClick={() => setAccompanimentOn((value) => { const next = !value; if (next) void prepareAccompaniment(); return next; })}
        disabled={accompaniment === 'none'}
        aria-label={accompanimentOn ? '关闭练习伴奏' : '开启练习伴奏'}
        aria-pressed={accompanimentOn}
        style={{ width: 40, height: 40, borderRadius: 20, background: accompanimentOn ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.07)', border: `1px solid ${accompanimentOn ? 'rgba(96,165,250,0.3)' : 'transparent'}`, cursor: accompaniment === 'none' ? 'not-allowed' : 'pointer', opacity: accompaniment === 'none' ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {accompanimentOn ? <Volume2 size={17} color="#60A5FA" /> : <VolumeX size={17} color="#A8BCD8" />}
      </button>
    </div>
  );
}
