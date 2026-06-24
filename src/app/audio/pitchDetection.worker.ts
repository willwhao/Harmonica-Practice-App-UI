import { analyzePitchFrame, type PitchWorkerRequest } from './pitchWorkerProtocol.ts';

self.onmessage = (event: MessageEvent<PitchWorkerRequest>) => {
  self.postMessage(analyzePitchFrame(event.data));
};
