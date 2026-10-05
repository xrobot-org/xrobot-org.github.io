/* UsbDebug data and encoders. No DOM: runs in the browser and under node (sim.test.mjs, node 24+ type stripping).

   1. USB descriptors. The bytes below are the output of LibXR's own XRUSB classes (libxr master 4e96701: DeviceCore,
      DeviceComposition, DapLinkV2Class, CDCUart, DfuRuntimeClass) built as a host program and asked for their descriptors
      the way Linux enumerates a device.
      Class list {{&dap (EP1), &cdc (EP2 bulk + EP3 interrupt), &dfu_rt}}, VID:PID 0D28:2041, USB 2.10, high speed,
      EP0 64 B; the serial number is built from a placeholder UID. The parsers here only read them.
   2. SWD. One DP read of DPIDR as SwdGeneralGPIO (src/driver/debug/swd_general_gpio.hpp) clocks it: each cycle is SWCLK low
      for half a period, then high; the host writes SWDIO at the start of the low half, the target samples on the rising
      edge; the target drives its bits from the rising edge before the cycle in which the host samples them (low half).
      Request 0xA5 (8 cycles) -> turnaround -> ACK 100 (OK, LSB first) -> 32 data bits LSB first -> even parity ->
      turnaround: 46 cycles.
   3. CMSIS-DAP. DAP_Transfer on the bulk endpoint pair: request 05 00 01 02 (read DP 0x0), reply 05 01 01 77 14 A0 2B
      (the same host program, DapLinkV2Class answering through a simulated SW-DP). */

// ============================================================================ bytes
export const hex = (s: string): number[] => {
  const o: number[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) o.push(parseInt(s.substr(i, 2), 16));
  return o;
};
export const h2 = (v: number): string => (v & 255).toString(16).toUpperCase().padStart(2, '0');
export const h4 = (v: number): string => '0x' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
export const h8 = (v: number): string => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
const w16 = (b: number[], i: number): number => b[i] | (b[i + 1] << 8);
const w32 = (b: number[], i: number): number => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const utf16 = (b: number[], o: number, n: number): string => {
  let s = '';
  for (let i = o; i + 1 < o + n; i += 2) s += String.fromCharCode(b[i] | (b[i + 1] << 8));
  return s;
};

// ============================================================================ 1. descriptor bytes (generated, see the header)
export const USB = {
  dev: hex('12011002EF020140280D4120020201020301'),
  cfg: hex(
    '0902740004010080320904000002FF0000040705010200020007058102000200080B010202020000090401000102020005052400100105240100' +
      '020424020205240601020705830310000409040200020A00000607050202000200070582020002000904030000FE010107092108320000001001',
  ),
  bos: hex(
    '050F4400031C100500DF60DDD88945C74C9CD2659D9E648A9F00000306B20020001C100500DF60DDD88945C74C9CD2659D9E648A9F00000306B2' +
      '00200007100200000000',
  ),
  str: [
    '04030904',
    '0E03580052006F0062006F007400',
    '140343004D005300490053002D00440041005000',
    '5403580052005500530042002D00440045004D004F002D00580052004400410050002D00330046003200410039003100430034003700450030003500420038004400320031003600360043004100330030004600',
    '1A0343004D005300490053002D00440041005000200076003200',
    '2403580052005500530042002000430044004300200043006F006E00740072006F006C00',
    '1E0358005200550053004200200043004400430020004400610074006100',
    '1A03580052005500530042002000440046005500200052005400',
  ].map(hex),
  /** DAP_Transfer read of DP 0x0 (DPIDR) on EP1 OUT, and the reply on EP1 IN */
  dapReq: hex('05000102'),
  dapResp: hex('0501017714A02B'),
};

/** the text of string descriptor i (UTF-16LE after the 2-byte header); index 0 is the language list */
export const stringText = (i: number): string => {
  const b = USB.str[i];
  return b && i > 0 ? utf16(b, 2, b[0] - 2) : '';
};

// ============================================================================ descriptor fields
export type DescKind =
  | 'device' | 'config' | 'interface' | 'endpoint' | 'iad' | 'cdcHeader' | 'cdcCall' | 'cdcAcm' | 'cdcUnion' | 'dfuFunc'
  | 'bos' | 'msos' | 'usb2ext' | 'string' | 'other';
export type Field = { o: number; n: number; name: string; value: string };
export type Desc = { o: number; len: number; type: number; kind: DescKind; b: number[]; fields: Field[] };

const MSOS_UUID = 'D8DD60DF-4589-4CC7-9CD2-659D9E648A9F';
const guid = (b: number[], o: number): string => {
  const le = (i: number, n: number) => { let s = ''; for (let k = n - 1; k >= 0; k--) s += h2(b[o + i + k]); return s; };
  const be = (i: number, n: number) => { let s = ''; for (let k = 0; k < n; k++) s += h2(b[o + i + k]); return s; };
  return `${le(0, 4)}-${le(4, 2)}-${le(6, 2)}-${be(8, 2)}-${be(10, 6)}`;
};

export function describe(b: number[], o = 0): Desc {
  const type = b[1];
  const F = (fo: number, n: number, name: string, value: string | number): Field => ({ o: fo, n, name, value: String(value) });
  const f: Field[] = [F(0, 1, 'bLength', b[0]), F(1, 1, 'bDescriptorType', '0x' + h2(type))];
  let kind: DescKind = 'other';
  if (type === 1) {
    kind = 'device';
    f.push(F(2, 2, 'bcdUSB', h4(w16(b, 2))), F(4, 1, 'bDeviceClass', '0x' + h2(b[4])), F(5, 1, 'bDeviceSubClass', '0x' + h2(b[5])),
      F(6, 1, 'bDeviceProtocol', '0x' + h2(b[6])), F(7, 1, 'bMaxPacketSize0', b[7]), F(8, 2, 'idVendor', h4(w16(b, 8))),
      F(10, 2, 'idProduct', h4(w16(b, 10))), F(12, 2, 'bcdDevice', h4(w16(b, 12))), F(14, 1, 'iManufacturer', b[14]),
      F(15, 1, 'iProduct', b[15]), F(16, 1, 'iSerialNumber', b[16]), F(17, 1, 'bNumConfigurations', b[17]));
  } else if (type === 2) {
    kind = 'config';
    f.push(F(2, 2, 'wTotalLength', w16(b, 2)), F(4, 1, 'bNumInterfaces', b[4]), F(5, 1, 'bConfigurationValue', b[5]),
      F(6, 1, 'iConfiguration', b[6]), F(7, 1, 'bmAttributes', '0x' + h2(b[7])), F(8, 1, 'bMaxPower', `0x${h2(b[8])} (${b[8] * 2} mA)`));
  } else if (type === 4) {
    kind = 'interface';
    const s = stringText(b[8]);
    f.push(F(2, 1, 'bInterfaceNumber', b[2]), F(3, 1, 'bAlternateSetting', b[3]), F(4, 1, 'bNumEndpoints', b[4]),
      F(5, 1, 'bInterfaceClass', '0x' + h2(b[5])), F(6, 1, 'bInterfaceSubClass', '0x' + h2(b[6])),
      F(7, 1, 'bInterfaceProtocol', '0x' + h2(b[7])), F(8, 1, 'iInterface', s ? `${b[8]} "${s}"` : b[8]));
  } else if (type === 5) {
    kind = 'endpoint';
    const a = b[2];
    f.push(F(2, 1, 'bEndpointAddress', `0x${h2(a)} (EP${a & 15} ${a & 0x80 ? 'IN' : 'OUT'})`),
      F(3, 1, 'bmAttributes', `0x${h2(b[3])} (${['Control', 'Isochronous', 'Bulk', 'Interrupt'][b[3] & 3]})`),
      F(4, 2, 'wMaxPacketSize', w16(b, 4)), F(6, 1, 'bInterval', b[6]));
  } else if (type === 0x0b) {
    kind = 'iad';
    f.push(F(2, 1, 'bFirstInterface', b[2]), F(3, 1, 'bInterfaceCount', b[3]), F(4, 1, 'bFunctionClass', '0x' + h2(b[4])),
      F(5, 1, 'bFunctionSubClass', '0x' + h2(b[5])), F(6, 1, 'bFunctionProtocol', '0x' + h2(b[6])), F(7, 1, 'iFunction', b[7]));
  } else if (type === 0x24) {
    const st = b[2];
    f.push(F(2, 1, 'bDescriptorSubtype', '0x' + h2(st)));
    if (st === 0) { kind = 'cdcHeader'; f.push(F(3, 2, 'bcdCDC', h4(w16(b, 3)))); }
    else if (st === 1) { kind = 'cdcCall'; f.push(F(3, 1, 'bmCapabilities', '0x' + h2(b[3])), F(4, 1, 'bDataInterface', b[4])); }
    else if (st === 2) { kind = 'cdcAcm'; f.push(F(3, 1, 'bmCapabilities', '0x' + h2(b[3]))); }
    else if (st === 6) { kind = 'cdcUnion'; f.push(F(3, 1, 'bControlInterface', b[3]), F(4, 1, 'bSubordinateInterface0', b[4])); }
  } else if (type === 0x21) {
    kind = 'dfuFunc';
    f.push(F(2, 1, 'bmAttributes', '0x' + h2(b[2])), F(3, 2, 'wDetachTimeOut', w16(b, 3)), F(5, 2, 'wTransferSize', w16(b, 5)),
      F(7, 2, 'bcdDFUVersion', h4(w16(b, 7))));
  } else if (type === 0x0f) {
    kind = 'bos';
    f.push(F(2, 2, 'wTotalLength', w16(b, 2)), F(4, 1, 'bNumDeviceCaps', b[4]));
  } else if (type === 0x10 && b[2] === 5) {
    kind = 'msos';
    const g = guid(b, 4);
    f.push(F(2, 1, 'bDevCapabilityType', '0x05'), F(3, 1, 'bReserved', b[3]),
      F(4, 16, 'PlatformCapabilityUUID', g === MSOS_UUID ? `{${g}} (MS OS 2.0)` : `{${g}}`),
      F(20, 4, 'dwWindowsVersion', h8(w32(b, 20))), F(24, 2, 'wMSOSDescriptorSetTotalLength', w16(b, 24)),
      F(26, 1, 'bMS_VendorCode', '0x' + h2(b[26])), F(27, 1, 'bAltEnumCode', b[27]));
  } else if (type === 0x10 && b[2] === 2) {
    kind = 'usb2ext';
    f.push(F(2, 1, 'bDevCapabilityType', '0x02'), F(3, 4, 'bmAttributes', h8(w32(b, 3))));
  } else if (type === 3) {
    kind = 'string';
    f.push(F(2, b[0] - 2, 'bString', `"${utf16(b, 2, b[0] - 2)}"`));
  }
  return { o, len: b[0], type, kind, b, fields: f };
}

/** split a run of descriptors (configuration or BOS: the BOS capabilities follow its 5-byte header) */
export function split(bytes: number[]): Desc[] {
  const out: Desc[] = [];
  let o = 0;
  while (o < bytes.length && bytes[o]) {
    out.push(describe(bytes.slice(o, o + bytes[o]), o));
    o += bytes[o];
  }
  return out;
}

// ============================================================================ the composite device
export type FuncKey = 'dap' | 'cdc' | 'dfu';
export type BlockKey = 'dev' | 'cfg' | FuncKey | 'bos';
export type Endpoint = { ep: number; dir: 'IN' | 'OUT'; type: 'Bulk' | 'Interrupt' | 'Isochronous' | 'Control'; mps: number };
export type Func = {
  key: FuncKey;
  /** class-list entry, in order */
  entry: string;
  o: number;
  len: number;
  descs: Desc[];
  /** interface numbers this class took from the start_itf cursor */
  itfs: number[];
  eps: Endpoint[];
  /** iInterface of its first interface */
  name: string;
  /** class / subclass / protocol of its first interface */
  triple: string;
};
export type Device = {
  dev: Desc;
  cfgHeader: Desc;
  total: number;
  numInterfaces: number;
  funcs: Func[];
  bos: { total: number; parts: { key: 'hdr' | FuncKey | 'stack'; o: number; len: number; desc: Desc }[] };
  vidpid: string;
};

const ENTRY: Record<FuncKey, string> = { dap: '&dap', cdc: '&cdc', dfu: '&dfu_rt' };

function funcOf(d: Desc): FuncKey | null {
  if (d.kind === 'iad') return 'cdc';
  if (d.kind !== 'interface') return null;
  const c = d.b[5];
  return c === 0xff ? 'dap' : c === 0x02 || c === 0x0a ? 'cdc' : c === 0xfe ? 'dfu' : null;
}

export function device(): Device {
  const descs = split(USB.cfg);
  const funcs: Func[] = [];
  let cur: Func | null = null;
  for (const d of descs.slice(1)) {
    const k = funcOf(d);
    if (k && (!cur || cur.key !== k)) {
      cur = { key: k, entry: ENTRY[k], o: d.o, len: 0, descs: [], itfs: [], eps: [], name: '', triple: '' };
      funcs.push(cur);
    }
    if (!cur) continue;
    cur.descs.push(d);
    cur.len += d.len;
    if (d.kind === 'interface') {
      cur.itfs.push(d.b[2]);
      if (!cur.name) { cur.name = stringText(d.b[8]); cur.triple = `${h2(d.b[5])}/${h2(d.b[6])}/${h2(d.b[7])}`; }
    }
    if (d.kind === 'endpoint') {
      const a = d.b[2];
      cur.eps.push({ ep: a & 15, dir: a & 0x80 ? 'IN' : 'OUT', type: (['Control', 'Isochronous', 'Bulk', 'Interrupt'] as const)[d.b[3] & 3], mps: w16(d.b, 4) });
    }
  }
  // BOS: header, then the capabilities in the order the classes registered them; the USB 2.0 extension is added by the stack
  const caps = split(USB.bos.slice(5)).map((d) => ({ ...d, o: d.o + 5 }));
  const owners: ('dap' | 'dfu' | 'stack')[] = ['dap', 'dfu', 'stack'];
  const bosHdr = describe(USB.bos.slice(0, 5), 0);
  const dev = describe(USB.dev, 0);
  return {
    dev,
    cfgHeader: descs[0],
    total: w16(USB.cfg, 2),
    numInterfaces: USB.cfg[4],
    funcs,
    bos: {
      total: w16(USB.bos, 2),
      parts: [{ key: 'hdr', o: 0, len: 5, desc: bosHdr }, ...caps.map((d, i) => ({ key: owners[i] ?? 'stack', o: d.o, len: d.len, desc: d }))],
    },
    vidpid: `${h4(w16(USB.dev, 8)).slice(2)}:${h4(w16(USB.dev, 10)).slice(2)}`,
  };
}

/** the bytes and descriptors of one block of the picture */
export function blockBytes(d: Device, key: BlockKey): { bytes: number[]; descs: Desc[]; owner?: (string | null)[] } {
  if (key === 'dev') return { bytes: USB.dev, descs: [d.dev] };
  if (key === 'cfg') return { bytes: d.cfgHeader.b, descs: [{ ...d.cfgHeader, o: 0 }] };
  if (key === 'bos') {
    const owner: (string | null)[] = [];
    for (const p of d.bos.parts) for (let i = 0; i < p.len; i++) owner.push(p.key);
    return { bytes: USB.bos, descs: d.bos.parts.map((p) => ({ ...p.desc, o: p.o })), owner };
  }
  const f = d.funcs.find((x) => x.key === key)!;
  return { bytes: USB.cfg.slice(f.o, f.o + f.len), descs: f.descs.map((x) => ({ ...x, o: x.o - f.o })) };
}

/** which descriptor and field byte i of a block belongs to */
export function byteAt(descs: Desc[], i: number): { desc: Desc; field: Field | null; rel: number } | null {
  for (const d of descs) {
    if (i < d.o || i >= d.o + d.len) continue;
    const rel = i - d.o;
    return { desc: d, rel, field: d.fields.find((f) => rel >= f.o && rel < f.o + f.n) ?? null };
  }
  return null;
}

// ============================================================================ 2. SWD
export const DPIDR = 0x2ba01477;
export const SWD_HZ = 1_000_000; // DapLinkV2Class default swj_clock_hz (docs/xrusb/dev_stack/dap.md, 5.1)
export const ACK = { OK: 0b001, WAIT: 0b010, FAULT: 0b100 } as const;

export const bitsLSB = (v: number, n: number): number[] => Array.from({ length: n }, (_, i) => (v >>> i) & 1);
export const parity = (bits: number[]): number => bits.reduce((a, b) => a ^ b, 0);

/** request byte: Start, APnDP, RnW, A[2], A[3], Parity, Stop, Park (sent LSB first) */
export function request(ap: number, rnw: number, addr: number): number {
  const a2 = (addr >> 2) & 1, a3 = (addr >> 3) & 1, par = (ap ^ rnw ^ a2 ^ a3) & 1;
  return 1 | (ap << 1) | (rnw << 2) | (a2 << 3) | (a3 << 4) | (par << 5) | (0 << 6) | (1 << 7);
}

export type Drv = 'host' | 'target' | 'z';
export type FieldKey = 'req' | 'trn' | 'ack' | 'data' | 'par' | 'trn2';
/** a level held on SWDIO from t0 to t1 (in clock cycles); null = released, held high by the pull-up */
export type Seg = { t0: number; t1: number; v: 0 | 1 | null; drv: Drv };
/** one clock cycle k: [k, k + 1), SWCLK low in the first half, rising edge at k + 0.5 */
export type Cycle = { k: number; field: FieldKey; name: string; v: 0 | 1 | null; drv: Drv; i: number };
export type SwdTrace = {
  cycles: Cycle[];
  segs: Seg[];
  fields: { key: FieldKey; c0: number; c1: number }[];
  req: number;
  ack: number;
  data: number;
  par: number;
  n: number;
};

const REQ_NAMES = ['Start', 'APnDP', 'RnW', 'A[2]', 'A[3]', 'Parity', 'Stop', 'Park'];

/** a DP read (default: DPIDR at 0x0) as SwdGeneralGPIO clocks it */
export function readDP(addr = 0, data = DPIDR, ack: number = ACK.OK): SwdTrace {
  const req = request(0, 1, addr);
  const cycles: Cycle[] = [];
  const push = (field: FieldKey, name: string, v: 0 | 1 | null, drv: Drv, i = -1) => cycles.push({ k: cycles.length, field, name, v, drv, i });
  bitsLSB(req, 8).forEach((b, i) => push('req', REQ_NAMES[i], b as 0 | 1, 'host', i));
  push('trn', 'Trn', null, 'z');
  bitsLSB(ack, 3).forEach((b, i) => push('ack', `ACK[${i}]`, b as 0 | 1, 'target', i));
  const db = bitsLSB(data >>> 0, 32);
  const par = parity(db);
  if (ack === ACK.OK) {
    db.forEach((b, i) => push('data', `DATA[${i}]`, b as 0 | 1, 'target', i));
    push('par', 'Parity', par as 0 | 1, 'target');
  }
  push('trn2', 'Trn', null, 'z');

  // SWDIO: the host writes at the start of a cycle; the target drives from the rising edge before the cycle in which the
  // host samples (k - 0.5); after the last target bit the line is released until the host takes it back at the start of the
  // final turnaround cycle and drives it high (SwdGeneralGPIO writes 1 there and leaves it high).
  const segs: Seg[] = [];
  const seg = (t0: number, t1: number, v: 0 | 1 | null, drv: Drv) => {
    const last = segs[segs.length - 1];
    if (last && last.v === v && last.drv === drv && Math.abs(last.t1 - t0) < 1e-9) last.t1 = t1;
    else if (t1 > t0) segs.push({ t0, t1, v, drv });
  };
  for (const c of cycles) {
    if (c.drv === 'host') seg(c.k, c.k + 1, c.v, 'host');
    else if (c.drv === 'target') seg(c.k - 0.5, c.k + 0.5, c.v, 'target');
    else if (c.field === 'trn') seg(c.k, c.k + 0.5, null, 'z');
    else { seg(c.k - 0.5, c.k, null, 'z'); seg(c.k, c.k + 1, 1, 'host'); }
  }
  const fields: SwdTrace['fields'] = [];
  for (const c of cycles) {
    const last = fields[fields.length - 1];
    if (last && last.key === c.field) last.c1 = c.k + 1;
    else fields.push({ key: c.field, c0: c.k, c1: c.k + 1 });
  }
  return { cycles, segs, fields, req, ack, data: data >>> 0, par, n: cycles.length };
}

/** the value as far as the host has sampled it at time t (cycles): unknown nibbles are '·' (LSB first fills from the right) */
export function partialHex(tr: SwdTrace, t: number): { text: string; known: number } {
  const first = tr.cycles.findIndex((c) => c.field === 'data');
  if (first < 0) return { text: '0x········', known: 0 };
  let known = 0;
  for (let i = 0; i < 32; i++) if (t >= first + i + 0.5) known = i + 1; // sampled on the rising edge of its cycle
  const nib = Math.floor(known / 4);
  const full = (tr.data >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return { text: '0x' + '·'.repeat(8 - nib) + full.slice(8 - nib), known };
}

/** DPIDR fields (ADIv5) */
export function dpidrFields(v: number): { name: string; bits: string; value: string }[] {
  const g = (hi: number, lo: number) => (v >>> lo) & ((1 << (hi - lo + 1)) - 1);
  return [
    { name: 'REVISION', bits: '31:28', value: '0x' + g(31, 28).toString(16).toUpperCase() },
    { name: 'PARTNO', bits: '27:20', value: '0x' + h2(g(27, 20)) },
    { name: 'MIN', bits: '16', value: String(g(16, 16)) },
    { name: 'VERSION', bits: '15:12', value: String(g(15, 12)) },
    { name: 'DESIGNER', bits: '11:1', value: '0x' + g(11, 1).toString(16).toUpperCase().padStart(3, '0') },
    { name: 'RAO', bits: '0', value: String(g(0, 0)) },
  ];
}

// ============================================================================ 3. CMSIS-DAP
/** DAP_Transfer (0x05), DAP index 0, one transfer, transfer request: bit 0 APnDP, bit 1 RnW, bits 2-3 A[3:2] */
export function dapTransferRead(ap: number, addr: number): number[] {
  return [0x05, 0x00, 0x01, (ap & 1) | 0x02 | (((addr >> 2) & 3) << 2)];
}
/** reply: command, transfers done, last ACK, then the read word little-endian */
export function dapTransferReply(ack: number, data: number): number[] {
  return [0x05, 0x01, ack & 7, data & 255, (data >>> 8) & 255, (data >>> 16) & 255, (data >>> 24) & 255];
}

// ============================================================================ 3. self-playing loop
// read the chip ID (the waveform scans bit by bit) -> rest -> light the three device classes one after another, each with
// some of its descriptors -> read again. The page walks `autoPlan(...).steps`, waiting `wait` ms after each step.
export const AUTO = {
  firstMs: 250,   // after the widget becomes active: the first read starts at once
  restMs: 2000,   // the finished capture stays on screen
  blockMs: 450,   // a class is selected before its descriptors are lit
  descMs: 800,    // one descriptor lit
  maxDesc: 4,     // descriptors lit per class (spread over the block)
  endMs: 500,     // highlight off before the next read
};
export type AutoStep =
  | { kind: 'read'; wait: number }
  | { kind: 'block'; block: FuncKey; wait: number }
  | { kind: 'desc'; block: FuncKey; o: number; len: number; descKind: DescKind; wait: number }
  | { kind: 'clear'; wait: number };

/** indices of at most `max` items spread evenly over `n` (first and last included) */
export function spread(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  return Array.from({ length: max }, (_, i) => Math.round((i * (n - 1)) / (max - 1)));
}

export function autoPlan(d: Device, readMs: number): { steps: AutoStep[]; periodMs: number } {
  const steps: AutoStep[] = [{ kind: 'read', wait: readMs + AUTO.restMs }];
  for (const f of d.funcs) {
    steps.push({ kind: 'block', block: f.key, wait: AUTO.blockMs });
    const { descs } = blockBytes(d, f.key);
    for (const i of spread(descs.length, AUTO.maxDesc)) {
      steps.push({ kind: 'desc', block: f.key, o: descs[i].o, len: descs[i].len, descKind: descs[i].kind, wait: AUTO.descMs });
    }
  }
  steps.push({ kind: 'clear', wait: AUTO.endMs });
  return { steps, periodMs: steps.reduce((a, s) => a + s.wait, 0) };
}
