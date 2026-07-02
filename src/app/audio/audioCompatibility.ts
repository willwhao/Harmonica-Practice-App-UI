export interface AudioCapabilitySource {
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasAudioContext: boolean;
  hasAnimationFrame: boolean;
}

export interface AudioCompatibilityResult {
  supported: boolean;
  missing: Array<'secure-context' | 'media-devices' | 'audio-context' | 'animation-frame'>;
}

export function inspectAudioCompatibility(source: AudioCapabilitySource): AudioCompatibilityResult {
  const missing: AudioCompatibilityResult['missing'] = [];
  if (!source.isSecureContext) missing.push('secure-context');
  if (!source.hasMediaDevices) missing.push('media-devices');
  if (!source.hasAudioContext) missing.push('audio-context');
  if (!source.hasAnimationFrame) missing.push('animation-frame');
  return { supported: missing.length === 0, missing };
}

export function inspectCurrentBrowserAudio(): AudioCompatibilityResult {
  const browserWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return inspectAudioCompatibility({
    isSecureContext: window.isSecureContext,
    hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
    hasAudioContext: Boolean(window.AudioContext ?? browserWindow.webkitAudioContext),
    hasAnimationFrame: typeof window.requestAnimationFrame === 'function',
  });
}
