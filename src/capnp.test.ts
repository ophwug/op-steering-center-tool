import { describe, expect, it } from "vitest";
import { findCarStateMessages, findDeviceType, findFingerprintLogMessages, findSteeringContextMessages } from "./capnp";

describe("Cap'n Proto log parsing", () => {
  it("reads the stable initData deviceType field", () => {
    expect(findDeviceType(minimalInitDataMessage(7))).toBe("mici");
    expect(findDeviceType(minimalInitDataMessage(4))).toBe("tici");
  });

  it("reads fingerprint debugging messages", () => {
    const messages = findFingerprintLogMessages(
      concatBytes([
        carParamsMessage(),
        onroadEventsMessage(),
        canMessage(),
      ]),
    );

    expect(messages.carParams[0]).toMatchObject({
      brand: "hyundai",
      carFingerprint: "KIA OPTIMA 2020",
      fuzzyFingerprint: true,
      dashcamOnly: true,
      passive: true,
      fingerprintSourceName: "fw",
    });
    expect(messages.carParams[0].carVin).toBe("KNAGT4LEXLA000001");
    expect(messages.carParams[0].carFw[0]).toMatchObject({
      ecuName: "fwdCamera",
      fwVersionPython: "b'HDA2-123'",
      fwVersionText: "HDA2-123",
      address: 0x7c4,
      responseAddress: 0x7cc,
      bus: 1,
      brand: "hyundai",
    });
    expect(messages.onroadEvents).toMatchObject([{ name: 54, nameText: "carUnrecognized" }]);
    expect(messages.canMessages).toMatchObject([{ address: 0x5a0, src: 1, dataLength: 8 }]);
  });

  it("reads carState steering fields", () => {
    expect(findCarStateMessages(carStateMessage())).toMatchObject([
      {
        vEgo: 18.5,
        steeringAngleDeg: -1.25,
        steeringRateDeg: 0.5,
        steeringTorque: 12,
        steeringPressed: false,
        standstill: false,
        leftBlinker: false,
        rightBlinker: false,
      },
    ]);
  });

  it("reads steering context messages for straightness scoring", () => {
    const context = findSteeringContextMessages(
      concatBytes([
        controlsStateMessage(),
        lateralPlanMessage(),
        liveLocationKalmanMessage(),
        livePoseMessage(),
      ]),
    );

    expect(context.controlsState[0].curvature).toBeCloseTo(0.0004);
    expect(context.controlsState[0].desiredCurvature).toBeCloseTo(0.0005);
    expect(context.controlsState[0].lateralPlanMonoTime).toBe(99n);
    expect(context.lateralPlan[0].firstCurvature).toBeCloseTo(0.0003);
    expect(context.lateralPlan[0].curvatures[1]).toBeCloseTo(0.0002);
    expect(context.liveLocationKalman[0].speedCalibrated).toBeCloseTo(20);
    expect(context.liveLocationKalman[0].yawRateCalibrated).toBeCloseTo(0.006);
    expect(context.livePose[0].speedDevice).toBeCloseTo(20);
    expect(context.livePose[0].yawRateDevice).toBeCloseTo(0.007);
  });
});

function minimalInitDataMessage(deviceType: number): Uint8Array {
  const bytes = new Uint8Array(48);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0, true);
  view.setUint32(4, 5, true);

  const segmentOffset = 8;
  writeStructPointer(view, segmentOffset, 0, 2, 1);
  view.setUint16(segmentOffset + 16, 0, true);

  writeStructPointer(view, segmentOffset + 24, 0, 1, 0);
  view.setUint16(segmentOffset + 32, deviceType, true);
  return bytes;
}

function writeStructPointer(view: DataView, offset: number, offsetWords: number, dataWords: number, pointerCount: number): void {
  const raw = (BigInt(offsetWords) << 2n) | (BigInt(dataWords) << 32n) | (BigInt(pointerCount) << 48n);
  view.setBigUint64(offset, raw, true);
}

function carParamsMessage(): Uint8Array {
  const builder = new SegmentBuilder(1024);
  const event = builder.initEvent(67);
  const carParams = builder.writeStructPointer(event.pointerOffset, 18, 14);
  builder.writeTextPointer(carParams.pointerOffset, "hyundai");
  builder.writeTextPointer(carParams.pointerOffset + 8, "KIA OPTIMA 2020");
  builder.writeTextPointer(carParams.pointerOffset + 10 * 8, "KNAGT4LEXLA000001");
  builder.view.setUint16(carParams.dataOffset + 35 * 2, 1, true);
  builder.setBool(carParams.dataOffset, 13, true);
  builder.setBool(carParams.dataOffset, 11, true);
  builder.setBool(carParams.dataOffset, 996, true);

  const listStart = builder.allocateWords(1 + 5);
  builder.writeListPointer(carParams.pointerOffset + 11 * 8, listStart, 7, 5);
  builder.writeCompositeTag(listStart, 1, 2, 3);
  const carFwData = listStart + 8;
  const carFwPointer = carFwData + 2 * 8;
  builder.view.setUint16(carFwData, 3, true);
  builder.view.setUint8(carFwData + 2, 2);
  builder.view.setUint8(carFwData + 3, 1);
  builder.view.setUint32(carFwData + 4, 0x7c4, true);
  builder.view.setUint32(carFwData + 8, 0x7cc, true);
  builder.writeDataPointer(carFwPointer, new TextEncoder().encode("HDA2-123"));
  builder.writeTextPointer(carFwPointer + 2 * 8, "hyundai");

  return builder.finish();
}

function onroadEventsMessage(): Uint8Array {
  const builder = new SegmentBuilder(256);
  const event = builder.initEvent(132);
  const listStart = builder.allocateWords(1 + 1);
  builder.writeListPointer(event.pointerOffset, listStart, 7, 1);
  builder.writeCompositeTag(listStart, 1, 1, 0);
  builder.view.setUint16(listStart + 8, 54, true);
  return builder.finish();
}

function canMessage(): Uint8Array {
  const builder = new SegmentBuilder(256);
  const event = builder.initEvent(4);
  const listStart = builder.allocateWords(1 + 2);
  builder.writeListPointer(event.pointerOffset, listStart, 7, 2);
  builder.writeCompositeTag(listStart, 1, 1, 1);
  const dataOffset = listStart + 8;
  const pointerOffset = dataOffset + 8;
  builder.view.setUint32(dataOffset, 0x5a0, true);
  builder.view.setUint8(dataOffset + 6, 1);
  builder.writeDataPointer(pointerOffset, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  return builder.finish();
}

function carStateMessage(): Uint8Array {
  const builder = new SegmentBuilder(256);
  const event = builder.initEvent(21);
  const carState = builder.writeStructPointer(event.pointerOffset, 12, 2);
  builder.view.setFloat32(carState.dataOffset, 18.5, true);
  builder.view.setFloat32(carState.dataOffset + 4 * 4, -1.25, true);
  builder.view.setFloat32(carState.dataOffset + 5 * 4, 12, true);
  builder.view.setFloat32(carState.dataOffset + 6 * 4, 0.5, true);
  builder.view.setFloat32(carState.dataOffset + 7 * 4, 0.1, true);
  builder.view.setFloat32(carState.dataOffset + 9 * 4, 0.01, true);
  return builder.finish();
}

function controlsStateMessage(): Uint8Array {
  const builder = new SegmentBuilder(512);
  const event = builder.initEvent(6);
  const controlsState = builder.writeStructPointer(event.pointerOffset, 24, 1);
  builder.view.setBigUint64(controlsState.dataOffset + 20 * 8, 99n, true);
  builder.view.setFloat32(controlsState.dataOffset + 34 * 4, 0.0004, true);
  builder.view.setFloat32(controlsState.dataOffset + 44 * 4, 0.0005, true);
  return builder.finish();
}

function lateralPlanMessage(): Uint8Array {
  const builder = new SegmentBuilder(512);
  const event = builder.initEvent(63);
  const lateralPlan = builder.writeStructPointer(event.pointerOffset, 1, 7);
  builder.writeFloat32Pointer(lateralPlan.pointerOffset + 6 * 8, [0.0003, 0.0002]);
  return builder.finish();
}

function liveLocationKalmanMessage(): Uint8Array {
  const builder = new SegmentBuilder(1024);
  const event = builder.initEvent(70);
  const liveLocation = builder.writeStructPointer(event.pointerOffset, 1, 13);
  const velocity = builder.writeStructPointer(liveLocation.pointerOffset + 10 * 8, 1, 2);
  builder.setBool(velocity.dataOffset, 0, true);
  builder.writeFloat64Pointer(velocity.pointerOffset, [20, 0, 0]);
  const angularVelocity = builder.writeStructPointer(liveLocation.pointerOffset + 12 * 8, 1, 2);
  builder.setBool(angularVelocity.dataOffset, 0, true);
  builder.writeFloat64Pointer(angularVelocity.pointerOffset, [0, 0, 0.006]);
  return builder.finish();
}

function livePoseMessage(): Uint8Array {
  const builder = new SegmentBuilder(1024);
  const event = builder.initEvent(127);
  const livePose = builder.writeStructPointer(event.pointerOffset, 2, 4);
  const velocity = builder.writeStructPointer(livePose.pointerOffset + 1 * 8, 4, 0);
  builder.view.setFloat32(velocity.dataOffset, 20, true);
  builder.view.setFloat32(velocity.dataOffset + 4, 0, true);
  builder.view.setFloat32(velocity.dataOffset + 8, 0, true);
  builder.setBool(velocity.dataOffset, 192, true);
  const angularVelocity = builder.writeStructPointer(livePose.pointerOffset + 3 * 8, 4, 0);
  builder.view.setFloat32(angularVelocity.dataOffset, 0, true);
  builder.view.setFloat32(angularVelocity.dataOffset + 4, 0, true);
  builder.view.setFloat32(angularVelocity.dataOffset + 8, 0.007, true);
  builder.setBool(angularVelocity.dataOffset, 192, true);
  return builder.finish();
}

class SegmentBuilder {
  readonly bytes: Uint8Array;
  readonly view: DataView;
  private cursor = 40;

  constructor(size: number) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
    this.view.setUint32(0, 0, true);
    writeStructPointer(this.view, 8, 0, 2, 1);
  }

  initEvent(unionTag: number): { dataOffset: number; pointerOffset: number } {
    const dataOffset = 16;
    const pointerOffset = 32;
    this.view.setBigUint64(dataOffset, 1n, true);
    this.view.setUint16(dataOffset + 8, unionTag, true);
    return { dataOffset, pointerOffset };
  }

  writeStructPointer(pointerOffset: number, dataWords: number, pointerCount: number): { dataOffset: number; pointerOffset: number } {
    const dataOffset = this.allocateWords(dataWords + pointerCount);
    const offsetWords = (dataOffset - pointerOffset - 8) / 8;
    writeStructPointer(this.view, pointerOffset, offsetWords, dataWords, pointerCount);
    return { dataOffset, pointerOffset: dataOffset + dataWords * 8 };
  }

  writeTextPointer(pointerOffset: number, value: string): void {
    const raw = new TextEncoder().encode(`${value}\0`);
    this.writeDataPointer(pointerOffset, raw);
  }

  writeDataPointer(pointerOffset: number, value: Uint8Array): void {
    const dataStart = this.allocateBytes(value.length);
    this.bytes.set(value, dataStart);
    this.writeListPointer(pointerOffset, dataStart, 2, value.length);
  }

  writeFloat32Pointer(pointerOffset: number, values: number[]): void {
    const dataStart = this.allocateBytes(values.length * 4);
    values.forEach((value, index) => this.view.setFloat32(dataStart + index * 4, value, true));
    this.writeListPointer(pointerOffset, dataStart, 4, values.length);
  }

  writeFloat64Pointer(pointerOffset: number, values: number[]): void {
    const dataStart = this.allocateBytes(values.length * 8);
    values.forEach((value, index) => this.view.setFloat64(dataStart + index * 8, value, true));
    this.writeListPointer(pointerOffset, dataStart, 5, values.length);
  }

  writeListPointer(pointerOffset: number, dataStart: number, elementSize: number, elementCount: number): void {
    const offsetWords = (dataStart - pointerOffset - 8) / 8;
    const raw = 1n | (BigInt(offsetWords) << 2n) | (BigInt(elementSize) << 32n) | (BigInt(elementCount) << 35n);
    this.view.setBigUint64(pointerOffset, raw, true);
  }

  writeCompositeTag(offset: number, elementCount: number, dataWords: number, pointerCount: number): void {
    const raw = (BigInt(elementCount) << 2n) | (BigInt(dataWords) << 32n) | (BigInt(pointerCount) << 48n);
    this.view.setBigUint64(offset, raw, true);
  }

  setBool(dataOffset: number, bitIndex: number, value: boolean): void {
    if (!value) return;
    const byteOffset = dataOffset + Math.floor(bitIndex / 8);
    this.bytes[byteOffset] |= 1 << (bitIndex % 8);
  }

  allocateWords(words: number): number {
    const offset = this.alignCursor();
    this.cursor = offset + words * 8;
    return offset;
  }

  allocateBytes(length: number): number {
    const offset = this.alignCursor();
    this.cursor = offset + length;
    return offset;
  }

  finish(): Uint8Array {
    const length = this.alignCursor();
    this.view.setUint32(4, (length - 8) / 8, true);
    return this.bytes.slice(0, length);
  }

  private alignCursor(): number {
    this.cursor = Math.ceil(this.cursor / 8) * 8;
    return this.cursor;
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
