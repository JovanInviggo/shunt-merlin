import { Buffer } from "buffer";
// Use react-native-file-access instead of expo-file-system
import { Dirs, FileSystem } from "react-native-file-access";

// Placeholder type for format options, similar to wav-encoder
interface WavFormat {
  numberOfChannels: number;
  sampleRate: number;
  bitDepth: number;
  floatingPoint?: boolean;
}

export class WavStreamWriter {
  private finalFilePath: string;
  private format: WavFormat;
  private finalFileFullPath: string;
  private tempDataPath: string;
  private dataSize: number = 0;

  constructor(finalFilePath: string, format: WavFormat) {
    this.finalFilePath = finalFilePath;
    this.format = { ...format, floatingPoint: false };
    this.finalFileFullPath = `${Dirs.CacheDir}/${this.finalFilePath}`;
    this.tempDataPath = `${
      Dirs.CacheDir
    }/temp_recording_data_${Date.now()}.bin`;

    this.initializeTempFile().catch((err) =>
      console.error("Temp file initialization failed:", err)
    );
  }

  // Initialize/clear the temporary data file using react-native-file-access
  private async initializeTempFile(): Promise<void> {
    try {
      // Ensure the temp file is empty at the start using writeFile
      await FileSystem.writeFile(this.tempDataPath, "", "base64"); // Assuming base64 encoding is okay for empty
      this.dataSize = 0;
      console.log(`Initialized temporary data file at: ${this.tempDataPath}`);
    } catch (error) {
      console.error("Failed to initialize temporary data file:", error);
      throw error;
    }
  }

  // Simplified version of wav-encoder's createWriter for Buffer manipulation
  private createWriter(buffer: Buffer, initialPos: number = 0) {
    let pos = initialPos;
    const dataView = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );

    return {
      uint8: (value: number) => {
        dataView.setUint8(pos, value);
        pos += 1;
      }, // Use DataView for consistency
      int16: (value: number) => {
        dataView.setInt16(pos, value, true);
        pos += 2;
      },
      uint16: (value: number) => {
        dataView.setUint16(pos, value, true);
        pos += 2;
      },
      uint32: (value: number) => {
        dataView.setUint32(pos, value, true);
        pos += 4;
      },
      string: (value: string) => {
        for (let i = 0; i < value.length; i++) {
          dataView.setUint8(pos++, value.charCodeAt(i));
        }
      },
      pcm16: (value: number) => {
        // Expects value between -1 and 1
        value = Math.max(-1, Math.min(value, +1));
        value = value < 0 ? value * 32768 : value * 32767;
        value = Math.round(value) | 0;
        dataView.setInt16(pos, value, true);
        pos += 2;
      },
      currentPosition: () => pos,
      getBuffer: () => buffer, // Return the underlying ArrayBuffer
      getDataView: () => dataView, // Expose DataView for direct manipulation if needed
    };
  }

  // Creates the 44-byte WAV header ArrayBuffer
  private createHeader(dataLength: number): ArrayBuffer {
    // Allocate ArrayBuffer directly, DataView will operate on it
    const buffer = new ArrayBuffer(44);
    const dataView = new DataView(buffer);
    const writer = this.createWriter(
      Buffer.from(buffer) /* Unnecessary conversion, use DataView directly */,
      0
    ); // Pass DataView to writer? No, writer uses DataView
    const bytes = this.format.bitDepth >> 3;
    const blockAlign = this.format.numberOfChannels * bytes;
    const byteRate = this.format.sampleRate * blockAlign;
    const formatId = this.format.floatingPoint ? 0x0003 : 0x0001;

    // Use DataView directly for writing header fields
    let pos = 0;
    const writeString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        dataView.setUint8(pos++, str.charCodeAt(i));
      }
    };

    // RIFF chunk descriptor
    writeString("RIFF"); // pos: 0-3
    dataView.setUint32(pos, 36 + dataLength, true);
    pos += 4; // ChunkSize (file size - 8), pos: 4-7
    writeString("WAVE"); // pos: 8-11

    // fmt sub-chunk
    writeString("fmt "); // pos: 12-15
    dataView.setUint32(pos, 16, true);
    pos += 4; // Subchunk1Size (16 for PCM), pos: 16-19
    dataView.setUint16(pos, formatId, true);
    pos += 2; // AudioFormat (PCM=1), pos: 20-21
    dataView.setUint16(pos, this.format.numberOfChannels, true);
    pos += 2; // NumChannels, pos: 22-23
    dataView.setUint32(pos, this.format.sampleRate, true);
    pos += 4; // SampleRate, pos: 24-27
    dataView.setUint32(pos, byteRate, true);
    pos += 4; // ByteRate, pos: 28-31
    dataView.setUint16(pos, blockAlign, true);
    pos += 2; // BlockAlign, pos: 32-33
    dataView.setUint16(pos, this.format.bitDepth, true);
    pos += 2; // BitsPerSample, pos: 34-35

    // data sub-chunk
    writeString("data"); // pos: 36-39
    dataView.setUint32(pos, dataLength, true);
    pos += 4; // Subchunk2Size (data size), pos: 40-43

    if (pos !== 44) {
      console.warn("Header size calculation mismatch!");
    }

    return buffer; // Return the ArrayBuffer
  }

  // Appends chunk data (base64 encoded) to the temporary file using appendFile
  public async writeChunk(chunk: Buffer): Promise<void> {
    try {
      // Use appendFile for efficiency
      await FileSystem.appendFile(
        this.tempDataPath,
        chunk.toString("base64"),
        "base64"
      );
      this.dataSize += chunk.length;
    } catch (error) {
      console.error("Failed to write audio chunk to temp file:", error);
    }
  }

  // Creates the final WAV file using react-native-file-access methods
  public async finalize(): Promise<string> {
    try {
      console.log("Finalizing WAV file...");

      // 1. Create the final header with the correct dataSize
      const finalHeaderBuffer = this.createHeader(this.dataSize);
      const finalHeaderBase64 =
        Buffer.from(finalHeaderBuffer).toString("base64");

      // 2. Delete the potentially existing final file
      // unlink is idempotent like deleteAsync with { idempotent: true }
      await FileSystem.unlink(this.finalFileFullPath);

      // 3. Write the final header to the final file path
      console.log(`Writing header to: ${this.finalFileFullPath}`);
      await FileSystem.writeFile(
        this.finalFileFullPath,
        finalHeaderBase64,
        "base64"
      );

      // 4. Append the data from the temporary file to the final file
      // This is more efficient than reading the whole temp file into memory
      console.log(
        `Concatenating data from ${this.tempDataPath} to ${this.finalFileFullPath}`
      );
      await FileSystem.concatFiles(this.tempDataPath, this.finalFileFullPath);

      // 5. Delete the temporary data file
      console.log(`Deleting temporary data file: ${this.tempDataPath}`);
      await FileSystem.unlink(this.tempDataPath);

      console.log(
        `Finalized WAV file at: ${this.finalFileFullPath} with data size: ${this.dataSize}`
      );
      return this.finalFileFullPath; // Return the full path
    } catch (error) {
      console.error("Failed to finalize WAV file:", error);
      // Clean up temp file on error if possible
      try {
        await FileSystem.unlink(this.tempDataPath);
      } catch (deleteError) {
        console.error(
          "Failed to delete temp file during error cleanup:",
          deleteError
        );
      }
      throw error; // Re-throw to signal failure
    }
  }
}
