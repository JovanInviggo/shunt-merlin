// types/wav-decoder.d.ts
declare module "wav-decoder" {
  interface AudioData {
    sampleRate: number;
    channelData: Float32Array[];
  }

  interface DecodeOptions {
    symmetric?: boolean;
  }

  function decode(
    src: ArrayBuffer | Buffer,
    opts?: DecodeOptions
  ): Promise<AudioData>;
  function decode(src: ArrayBuffer | Buffer, opts?: DecodeOptions): AudioData; // Overload for sync usage if needed, though seems async is primary

  const WavDecoder: {
    decode: typeof decode;
    // Add sync if needed: decode.sync?: typeof decode.sync;
  };

  export default WavDecoder;
}
