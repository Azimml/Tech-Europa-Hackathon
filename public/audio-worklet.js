// Turns the microphone (float32 at the AudioContext rate, usually 48 kHz) into
// 20 ms frames of 16 kHz PCM16, the format Reson8 is told to expect. Each frame
// also carries its RMS level so the page can detect pauses and flush Reson8.
const TARGET_RATE = 16000;
const FRAME_SAMPLES = 320; // 20 ms at 16 kHz

// Exported for the browser-console check (task 4.1); worklet scope ignores it.
class Downsampler {
  constructor(inputRate) {
    this.step = inputRate / TARGET_RATE;
    this.pos = 0; // fractional read position into the current input block
    this.last = 0; // last sample of the previous block, for interpolation across blocks
    this.frame = new Int16Array(FRAME_SAMPLES);
    this.filled = 0;
    this.sumSquares = 0;
  }

  // Feeds one input block, calls onFrame(Int16Array, rms) for every finished frame.
  push(input, onFrame) {
    while (this.pos < input.length) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const a = i === 0 ? this.last : input[i - 1];
      const b = input[i];
      // pos indexes "one sample behind", so index 0 interpolates from the previous block.
      const sample = Math.max(-1, Math.min(1, a + (b - a) * frac));
      this.frame[this.filled++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      this.sumSquares += sample * sample;
      if (this.filled === FRAME_SAMPLES) {
        onFrame(this.frame, Math.sqrt(this.sumSquares / FRAME_SAMPLES));
        this.frame = new Int16Array(FRAME_SAMPLES);
        this.filled = 0;
        this.sumSquares = 0;
      }
      this.pos += this.step;
    }
    this.pos -= input.length;
    this.last = input[input.length - 1];
  }
}

if (typeof AudioWorkletProcessor !== "undefined") {
  class Pcm16Processor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.downsampler = new Downsampler(sampleRate);
    }

    process(inputs) {
      const channel = inputs[0]?.[0];
      if (channel) {
        this.downsampler.push(channel, (frame, rms) => {
          this.port.postMessage({ frame, rms }, [frame.buffer]);
        });
      }
      return true;
    }
  }
  registerProcessor("pcm16-processor", Pcm16Processor);
} else if (typeof globalThis !== "undefined") {
  globalThis.Downsampler = Downsampler;
}
