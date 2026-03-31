/**
 * Decodes a base64 string into a Uint8Array.
 * This is necessary because the Gemini TTS API returns audio data as a base64 string,
 * but the Web Audio API needs a raw byte array.
 * @param base64 The base64 encoded audio string.
 * @returns A Uint8Array containing the raw audio data.
 */
export function decodeBase64(base64: string): Uint8Array {
  try {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("Failed to decode base64 audio data:", error);
    throw new Error("Invalid audio data received.");
  }
}

/**
 * Creates an AudioBuffer from raw PCM audio data.
 * The Gemini TTS API returns audio as raw 16-bit signed PCM at a 24kHz sample rate.
 * The Web Audio API's `decodeAudioData` cannot process raw PCM, so this function is needed
 * to manually construct an AudioBuffer for playback.
 * @param pcmData The raw PCM audio data as a Uint8Array.
 * @param ctx The AudioContext to use for creating the buffer.
 * @returns An AudioBuffer ready for playback.
 */
export function createAudioBufferFromPCM(
  pcmData: Uint8Array,
  ctx: AudioContext,
): AudioBuffer {
  const sampleRate = 24000; // Gemini TTS default sample rate
  const numChannels = 1;     // Gemini TTS is mono

  // The raw data from the API is 16-bit signed PCM.
  // We need to convert it to a Float32Array for the AudioBuffer.
  // The Int16Array constructor will interpret the Uint8Array's buffer as 16-bit integers.
  const pcmDataAsInt16 = new Int16Array(pcmData.buffer);
  const frameCount = pcmDataAsInt16.length / numChannels;
  
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    // Normalize the 16-bit integer to a float between -1.0 and 1.0
    channelData[i] = pcmDataAsInt16[i] / 32768.0;
  }
  
  return buffer;
}

// Declare lamejs as it's loaded from a script tag in the HTML.
declare const lamejs: any;

/**
 * Creates a Blob representing a .mp3 file from raw PCM audio data.
 * This function uses the lamejs library to encode the raw PCM data into the MP3 format,
 * which is more universally compatible and compressed than WAV.
 * @param pcmData The raw PCM audio data (16-bit signed, mono).
 * @param sampleRate The sample rate of the audio (e.g., 24000 for Gemini TTS).
 * @returns A Blob of type 'audio/mpeg'.
 */
export const createMp3File = (pcmData: Uint8Array, sampleRate: number): Blob => {
  if (typeof lamejs === 'undefined') {
    // This is a safeguard, but lamejs should be loaded by the time this is called.
    throw new Error('MP3 encoding library (lamejs) is not loaded.');
  }

  // Initialize the MP3 encoder: 1 channel, specified sample rate, 128kbps bitrate.
  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  
  // The raw data from the API is 16-bit signed PCM. lamejs needs this as an Int16Array.
  const pcmDataAsInt16 = new Int16Array(pcmData.buffer);
  
  const sampleBlockSize = 1152; // Standard block size for MP3 encoding
  const mp3Data: Int8Array[] = [];

  // Encode the PCM data in chunks.
  for (let i = 0; i < pcmDataAsInt16.length; i += sampleBlockSize) {
    const sampleChunk = pcmDataAsInt16.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  // Flush any remaining data in the encoder to finalize the file.
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  // Create the final Blob from the encoded MP3 data chunks.
  return new Blob(mp3Data, { type: 'audio/mpeg' });
};