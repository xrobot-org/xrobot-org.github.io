// UsbDebug data and encoders (sim.ts) under node 24+ (type stripping).
//   node --test src/components/showcase/UsbDebug/sim.test.mjs
// The descriptor checks restate what the host build of XRUSB produced (qaA/reports/2-2.md); the SWD checks match the v5 engine
// tests (tests5/proto5.test.mjs, "SWD DPIDR read") and the timing of SwdGeneralGPIO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from './sim.ts';

test('configuration descriptor: 116 B = 9 + 23 + 66 + 18 in class-list order', () => {
  const d = S.device();
  assert.equal(S.USB.cfg.length, 116);
  assert.equal(d.total, 116);
  assert.equal(d.cfgHeader.len, 9);
  assert.deepEqual(d.funcs.map((f) => f.key), ['dap', 'cdc', 'dfu']);
  assert.deepEqual(d.funcs.map((f) => f.len), [23, 66, 18]);
  assert.equal(9 + d.funcs.reduce((a, f) => a + f.len, 0), d.total);
});

test('interface numbers follow the start_itf cursor: 0 | 1 2 | 3, bNumInterfaces 4', () => {
  const d = S.device();
  assert.deepEqual(d.funcs.map((f) => f.itfs), [[0], [1, 2], [3]]);
  assert.equal(d.numInterfaces, 4);
  const iad = d.funcs[1].descs.find((x) => x.kind === 'iad');
  assert.equal(iad.b[2], 1);                       // bFirstInterface
  assert.equal(iad.b[3], 2);                       // bInterfaceCount
  const union = d.funcs[1].descs.find((x) => x.kind === 'cdcUnion');
  assert.deepEqual([union.b[3], union.b[4]], [1, 2]);
});

test('endpoints: DAP EP1 OUT/IN bulk 512, CDC EP3 IN interrupt 16 + EP2 OUT/IN bulk 512, DFU runtime only EP0', () => {
  const d = S.device();
  const eps = (k) => d.funcs.find((f) => f.key === k).eps.map((e) => `EP${e.ep} ${e.dir} ${e.type} ${e.mps}`);
  assert.deepEqual(eps('dap'), ['EP1 OUT Bulk 512', 'EP1 IN Bulk 512']);
  assert.deepEqual(eps('cdc'), ['EP3 IN Interrupt 16', 'EP2 OUT Bulk 512', 'EP2 IN Bulk 512']);
  assert.deepEqual(eps('dfu'), []);
  assert.deepEqual(d.funcs.map((f) => f.name), ['CMSIS-DAP v2', 'XRUSB CDC Control', 'XRUSB DFU RT']);
  assert.deepEqual(d.funcs.map((f) => f.triple), ['FF/00/00', '02/02/00', 'FE/01/01']);
});

test('device descriptor: USB 2.10, IAD composite EF/02/01, 0D28:2041, EP0 64 B', () => {
  const d = S.device();
  assert.equal(S.USB.dev.length, 18);
  assert.equal(d.vidpid, '0D28:2041');
  const f = Object.fromEntries(d.dev.fields.map((x) => [x.name, x.value]));
  assert.equal(f.bcdUSB, '0x0210');
  assert.deepEqual([f.bDeviceClass, f.bDeviceSubClass, f.bDeviceProtocol], ['0xEF', '0x02', '0x01']);
  assert.equal(f.bMaxPacketSize0, '64');
  assert.equal(S.stringText(2), 'CMSIS-DAP');
});

test('BOS: 68 B = 5 + 28 (DAP, MS OS 2.0) + 28 (DFU runtime, MS OS 2.0) + 7 (USB 2.0 extension from the stack)', () => {
  const d = S.device();
  assert.equal(S.USB.bos.length, 68);
  assert.equal(d.bos.total, 68);
  assert.deepEqual(d.bos.parts.map((p) => [p.key, p.len]), [['hdr', 5], ['dap', 28], ['dfu', 28], ['stack', 7]]);
  assert.deepEqual(d.bos.parts.map((p) => p.desc.kind), ['bos', 'msos', 'msos', 'usb2ext']);
  const uuid = d.bos.parts[1].desc.fields.find((f) => f.name === 'PlatformCapabilityUUID').value;
  assert.match(uuid, /D8DD60DF-4589-4CC7-9CD2-659D9E648A9F/);
  assert.equal(d.bos.parts[1].desc.fields.find((f) => f.name === 'bMS_VendorCode').value, '0x20');
});

test('byteAt finds descriptor and field; blocks cover every byte', () => {
  const d = S.device();
  for (const k of ['dev', 'cfg', 'dap', 'cdc', 'dfu', 'bos']) {
    const blk = S.blockBytes(d, k);
    for (let i = 0; i < blk.bytes.length; i++) assert.ok(S.byteAt(blk.descs, i), `${k} byte ${i}`);
  }
  const dap = S.blockBytes(d, 'dap');
  const at = S.byteAt(dap.descs, 2);
  assert.equal(at.desc.kind, 'interface');
  assert.equal(at.field.name, 'bInterfaceNumber');
  const ep = S.byteAt(dap.descs, 9 + 2);
  assert.equal(ep.field.name, 'bEndpointAddress');
  assert.match(ep.field.value, /EP1 OUT/);
});

test('SWD DPIDR read: 0xA5, Trn, ACK 100, 0x2BA01477 LSB first, even parity 0, 46 cycles', () => {
  assert.equal(S.request(0, 1, 0), 0xa5);
  const tr = S.readDP();
  assert.equal(tr.n, 46);
  const v = tr.cycles.map((c) => c.v);
  assert.deepEqual(v.slice(0, 8), [1, 0, 1, 0, 0, 1, 0, 1]);
  assert.equal(v[8], null);
  assert.deepEqual(v.slice(9, 12), [1, 0, 0]);
  assert.equal(v.slice(12, 44).reduce((a, b, i) => a + b * 2 ** i, 0), 0x2ba01477);
  assert.equal(v[44], 0);
  assert.equal(tr.par, 0);
  assert.deepEqual(tr.fields.map((f) => [f.key, f.c0, f.c1]), [['req', 0, 8], ['trn', 8, 9], ['ack', 9, 12], ['data', 12, 44], ['par', 44, 45], ['trn2', 45, 46]]);
});

test('SWD request parity matches the engine (SELECT write, AP DRW read, RDBUFF read)', () => {
  assert.equal(S.request(0, 0, 0x8), 0xb1);
  assert.equal(S.request(1, 1, 0xc), 0x9f);
  assert.equal(S.request(0, 1, 0xc), 0xbd);
});

test('SWDIO timing: host bits change at the start of a cycle, target bits half a cycle earlier (rising edge)', () => {
  const tr = S.readDP();
  const host = tr.segs.filter((s) => s.drv === 'host');
  const target = tr.segs.filter((s) => s.drv === 'target');
  assert.ok(host.every((s) => Number.isInteger(s.t0)));
  assert.equal(target[0].t0, 8.5);                 // the target takes the line on the rising edge of the turnaround cycle
  assert.equal(target[target.length - 1].t1, 44.5);
  const z = tr.segs.filter((s) => s.v === null).map((s) => [s.t0, s.t1]);
  assert.deepEqual(z, [[8, 8.5], [44.5, 45]]);
  for (let i = 1; i < tr.segs.length; i++) assert.equal(tr.segs[i].t0, tr.segs[i - 1].t1);   // continuous
  assert.equal(tr.segs[tr.segs.length - 1].t1, 46);
});

test('partial value fills from the low nibble', () => {
  const tr = S.readDP();
  assert.equal(S.partialHex(tr, 0).text, '0x········');
  assert.equal(S.partialHex(tr, 12 + 3.5).text, '0x·······7');
  assert.equal(S.partialHex(tr, 12 + 15.5).text, '0x····1477');
  assert.equal(S.partialHex(tr, 46).text, '0x2BA01477');
});

test('DPIDR fields: REVISION 2, PARTNO 0xBA, VERSION 1, DESIGNER 0x23B (Arm), RAO 1', () => {
  const f = Object.fromEntries(S.dpidrFields(0x2ba01477).map((x) => [x.name, x.value]));
  assert.deepEqual(f, { REVISION: '0x2', PARTNO: '0xBA', MIN: '0', VERSION: '1', DESIGNER: '0x23B', RAO: '1' });
});

test('DAP_Transfer: request and reply equal the bytes the host build of DapLinkV2Class exchanged', () => {
  assert.deepEqual(S.dapTransferRead(0, 0), S.USB.dapReq);
  assert.deepEqual(S.dapTransferReply(S.ACK.OK, S.DPIDR), S.USB.dapResp);
});

test('self-playing plan: read, rest 2 s, the three classes in list order with their descriptors, then around again', () => {
  const dev = S.device();
  const plan = S.autoPlan(dev, 4000);
  assert.equal(plan.steps[0].kind, 'read');
  assert.equal(plan.steps[0].wait, 4000 + S.AUTO.restMs);
  const blocks = plan.steps.filter((s) => s.kind === 'block').map((s) => s.block);
  assert.deepEqual(blocks, dev.funcs.map((f) => f.key));
  assert.equal(plan.steps[plan.steps.length - 1].kind, 'clear');
  // every lit descriptor lies inside its block and starts at a descriptor boundary
  for (const s of plan.steps.filter((x) => x.kind === 'desc')) {
    const b = S.blockBytes(dev, s.block);
    assert.ok(b.descs.some((x) => x.o === s.o && x.len === s.len));
    assert.ok(s.o + s.len <= b.bytes.length);
  }
  for (const f of dev.funcs) {
    const n = plan.steps.filter((s) => s.kind === 'desc' && s.block === f.key).length;
    assert.ok(n >= 1 && n <= S.AUTO.maxDesc);
  }
  assert.equal(plan.periodMs, plan.steps.reduce((a, s) => a + s.wait, 0));
});

test('spread: evenly spaced, ends included, never more than asked', () => {
  assert.deepEqual(S.spread(3, 4), [0, 1, 2]);
  assert.deepEqual(S.spread(10, 4), [0, 3, 6, 9]);
  assert.deepEqual(S.spread(1, 4), [0]);
});
