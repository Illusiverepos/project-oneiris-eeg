/**
 * Project ONEIRIS — Zero-Dependency Web Bluetooth Adapter for Muse 2 / Muse S Headbands
 *
 * Maps the exact 4 Muse electrodes onto our 12-Lab ONEIRIS circuit:
 *   - TP9  (273e0003) & TP10 (273e0006) -> Posterior Hot Zone (Right_TPJ = TP10)
 *   - AF7  (273e0004) & AF8  (273e0005) -> Frontal Steering Wheel (Right_Frontal = AF8) + Horizontal EOG (AF8 - AF7)
 *
 * Unpacks 12-bit Muse EEG packets (256 Hz), detects deliberate LRLR eye-movements on (AF8 - AF7),
 * and streams 2-second rolling buffers to `POST /eeg-chunk` for live Goldilocks closed-loop gating.
 */

(function (global) {
  const MUSE_SERVICE = 0xfe8d;
  const CHAR_CTRL = '273e0001-4c4d-454d-96be-f03bac821358';
  const EEG_CHARS = {
    TP9:  '273e0003-4c4d-454d-96be-f03bac821358',
    AF7:  '273e0004-4c4d-454d-96be-f03bac821358',
    AF8:  '273e0005-4c4d-454d-96be-f03bac821358',
    TP10: '273e0006-4c4d-454d-96be-f03bac821358',
  };

  function encodeCmd(str) {
    const bytes = new Uint8Array(str.length + 2);
    bytes[0] = str.length + 1;
    for (let i = 0; i < str.length; i++) bytes[i + 1] = str.charCodeAt(i);
    bytes[bytes.length - 1] = 10; // '\n'
    return bytes;
  }

  function decode12BitSamples(dataView) {
    // Bytes 0..1 = sequence number; bytes 2..19 = 12 samples packed as 12-bit unsigned ints (uV scale 0.48828125)
    const out = new Float64Array(12);
    let idx = 0;
    for (let i = 2; i < 20; i += 3) {
      const b0 = dataView.getUint8(i), b1 = dataView.getUint8(i + 1), b2 = dataView.getUint8(i + 2);
      const s1 = (b0 << 4) | (b1 >> 4);
      const s2 = ((b1 & 0x0f) << 8) | b2;
      out[idx++] = (s1 - 2048) * 0.48828125;
      out[idx++] = (s2 - 2048) * 0.48828125;
    }
    return out;
  }

  class OneirisMuseAdapter {
    constructor(opts = {}) {
      this.onStatus = opts.onStatus || (() => {});
      this.onDecision = opts.onDecision || (() => {});
      this.onLRLR = opts.onLRLR || (() => {});
      this.device = null;
      this.buf = { TP9: [], AF7: [], AF8: [], TP10: [] };
      this.lastLRLRMs = 0;
      this.streamTimer = null;
    }

    async connect() {
      if (!navigator.bluetooth) {
        this.onStatus('Web Bluetooth requires Chrome or Edge on desktop/Android.');
        return false;
      }
      try {
        this.onStatus('Scanning for Muse 2 / Muse S headband...');
        this.device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [MUSE_SERVICE] }],
        });
        const server = await this.device.gatt.connect();
        const service = await server.getPrimaryService(MUSE_SERVICE);
        const ctrl = await service.getCharacteristic(CHAR_CTRL);

        for (const [name, uuid] of Object.entries(EEG_CHARS)) {
          const ch = await service.getCharacteristic(uuid);
          await ch.startNotifications();
          ch.addEventListener('characteristicvaluechanged', (ev) => {
            const samples = decode12BitSamples(ev.target.value);
            const arr = this.buf[name];
            for (let i = 0; i < samples.length; i++) arr.push(samples[i]);
            if (arr.length > 512) arr.splice(0, arr.length - 512);
          });
        }

        // Start Muse EEG preset p21 + resume ('d')
        await ctrl.writeValue(encodeCmd('h'));
        await ctrl.writeValue(encodeCmd('p21'));
        await ctrl.writeValue(encodeCmd('d'));
        this.onStatus(`Connected to ${this.device.name || 'Muse Headband'} (4-ch EEG streaming at 256 Hz)`);

        this.streamTimer = setInterval(() => this._tick(), 500);
        return true;
      } catch (err) {
        this.onStatus(`Muse BLE error: ${err.message}`);
        return false;
      }
    }

    async _tick() {
      if (this.buf.TP10.length < 400 || this.buf.AF8.length < 400) return;
      // Local differential montage: Posterior = TP10 - TP9, Right Frontal = AF8 - AF7
      const N = 400;
      const post = new Array(N), rf = new Array(N);
      const tp10 = this.buf.TP10.slice(-N), tp9 = this.buf.TP9.slice(-N);
      const af8 = this.buf.AF8.slice(-N), af7 = this.buf.AF7.slice(-N);
      let posPeaks = 0, negPeaks = 0, maxJump = 0;
      for (let i = 0; i < N; i++) {
        post[i] = tp10[i] - tp9[i];
        rf[i] = af8[i] - af7[i];
        if (rf[i] > 85) posPeaks++;
        if (rf[i] < -85) negPeaks++;
        if (i > 0) { const d = Math.abs(rf[i] - rf[i - 1]); if (d > maxJump) maxJump = d; }
      }
      // Deliberate LRLR eye-movement signature: strong alternating + and - deflections on AF8 - AF7
      const now = Date.now();
      if (posPeaks >= 12 && negPeaks >= 12 && now - this.lastLRLRMs > 8000) {
        this.lastLRLRMs = now;
        this.onLRLR();
      }
      try {
        const r = await fetch('/eeg-chunk', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post, rightFrontal: rf, eogArtifact: maxJump > 65 }),
        });
        if (r.ok) this.onDecision(await r.json());
      } catch (_) {}
    }

    disconnect() {
      if (this.streamTimer) { clearInterval(this.streamTimer); this.streamTimer = null; }
      if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
      this.onStatus('Muse headband disconnected.');
    }
  }

  global.OneirisMuseAdapter = OneirisMuseAdapter;
})(window);
