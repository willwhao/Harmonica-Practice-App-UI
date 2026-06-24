import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PracticeNote } from '../../data/practiceCharts';
import { PracticeNoteLane } from './PracticeNoteLane';

const notes: PracticeNote[] = [{
  beat: 1,
  durationBeats: 1,
  track: 3,
  number: '3',
  type: 'blow',
  hole: 4,
  technique: 'natural',
}];

describe('PracticeNoteLane', () => {
  it('renders falling notes and start overlay', async () => {
    const user = userEvent.setup();
    const onBeginPractice = vi.fn();

    render(
      <PracticeNoteLane
        gameFieldRef={createRef<HTMLDivElement>()}
        trackCount={10}
        trackWidth={36}
        noteWidth={30}
        visibleNotes={notes}
        currentBeatFloat={0}
        judgmentY={300}
        beatHeight={60}
        activeHole={4}
        activeType="blow"
        feedback="Great"
        feedbackKey={1}
        isPlaying={false}
        displayTime={0}
        microphoneStatus="idle"
        microphoneMessage="待机"
        calibrationProgress={0}
        isFallbackChart={false}
        micOn
        microphoneError={false}
        onBeginPractice={onBeginPractice}
        onRetryMicrophone={vi.fn()}
      />,
    );

    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('太棒！')).toBeInTheDocument();
    expect(screen.getByText('开始后将请求麦克风权限，用真实音高进行判定')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '开始练习' }));
    expect(onBeginPractice).toHaveBeenCalledTimes(1);
  });
});
