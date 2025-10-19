(function () {
  'use strict';

  function computeMetrics() {
    // Time-to-target and AUC for training curves
    const container = document.getElementById('train_metrics');
    if (container) {
      const defs = [
        ['Aesthetic', 'aesthetic', 5.19],
        ['ImageReward', 'imagereward', 0.541],
        ['Pick', 'pick', 0.2118],
        ['HPSv2', 'hpsv2', 0.2477]
      ];
      defs.forEach(([label, key, target]) => {
        const base = window.MIRO_DATA.trainingCurves[key].baseline;
        const miro = window.MIRO_DATA.trainingCurves[key].miro;
        function ttt(arr) {
          for (const [x, y] of arr) { if (y >= target) return x; }
          return arr[arr.length - 1][0];
        }
        function auc(arr) {
          let area = 0; for (let i = 1; i < arr.length; i++) { const [x0, y0] = arr[i - 1]; const [x1, y1] = arr[i]; area += (x1 - x0) * (y0 + y1) / 2; } return area;
        }
        const tBase = ttt(base), tM = ttt(miro);
        const speed = (tBase / tM).toFixed(1) + '×';
        const aBase = auc(base), aM = auc(miro);
        const card = document.createElement('div'); card.className = 'kpi card';
        card.innerHTML = `<div class="kpi-num">${speed}</div><div class="kpi-label">${label} speedup (TTT)</div>`;
        container.appendChild(card);
      });
    }

    // Equivalent samples for TTS
    const tts = document.getElementById('tts_metrics');
    if (tts) {
      function eqSamples(metric) {
        const xs = window.MIRO_DATA.testTimeScaling.x; const m = window.MIRO_DATA.testTimeScaling[metric];
        // find k where baseline at max matches MIRO at xs[k]
        const target = m.miro[m.miro.length - 1];
        let k = 0; while (k < m.baseline.length && m.baseline[k] < target) k++;
        const factor = k > 0 ? (xs[xs.length - 1] / xs[Math.min(k, xs.length - 1)]) : Infinity;
        return !isFinite(factor) ? '>' + (xs[xs.length - 1]) + '×' : (factor.toFixed(1) + '×');
      }
      const defs = [['Aesthetic', 'aesthetic'], ['ImageReward', 'imagereward'], ['Pick', 'pick'], ['HPSv2', 'hpsv2']];
      defs.forEach(([label, key]) => {
        const card = document.createElement('div'); card.className = 'kpi card';
        card.innerHTML = `<div class="kpi-num">${eqSamples(key)}</div><div class="kpi-label">${label} eq. samples</div>`;
        tts.appendChild(card);
      });
    }
  }

  // Expose to global namespace
  window.MIRO = window.MIRO || {};
  window.MIRO.computeMetrics = computeMetrics;
})();
