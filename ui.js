/* Vibra 0.6 — componentes de interface reutilizáveis.
   Sem lógica de processamento: apenas apresentação de estado. */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id);

  /* ── Fluxo de 4 etapas (gravar → região → filtro → amplificar) ── */
  const flowItems = [...document.querySelectorAll('#flow li')];
  function flow(done) {
    let active = flowItems.findIndex((_, i) => !done[i]);
    flowItems.forEach((li, i) => { li.dataset.state = done[i] ? 'done' : i === active ? 'active' : 'pending'; });
  }
  flowItems.forEach(li => li.addEventListener('click', () => {
    const panel = $(li.dataset.target); if (!panel) return;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel.classList.add('is-focus'); setTimeout(() => panel.classList.remove('is-focus'), 1200);
  }));

  /* ── Pílula de estado da bancada ── */
  function state(text, tone = 'idle') { const p = $('state'); p.textContent = text; p.dataset.tone = tone; }

  /* ── Preenchimento dos sliders (trilha colorida até o polegar) ── */
  function fill(input) {
    const min = +input.min || 0, max = +input.max || 100, v = +input.value;
    input.style.setProperty('--p', (max > min ? (v - min) / (max - min) * 100 : 0) + '%');
  }
  document.querySelectorAll('input[type=range]').forEach(r => { fill(r); r.addEventListener('input', () => fill(r)); });

  /* ── Visualização da faixa de passagem sobre 0…Nyquist ── */
  function band(lo, hi, fs, frames) {
    const nyq = fs / 2, pass = $('bandPass'), ok = lo > 0 && lo < hi && hi < nyq;
    const L = Math.max(0, Math.min(1, lo / nyq)), H = Math.max(0, Math.min(1, hi / nyq));
    pass.style.left = (L * 100) + '%'; pass.style.width = Math.max(1, (H - L) * 100) + '%';
    pass.classList.toggle('is-bad', !ok);
    $('bandNyq').textContent = 'Nyquist ' + VibraCharts.fmt(nyq, 1) + ' Hz';
    $('bandHint').textContent = ok
      ? `Passa ${VibraCharts.fmt(lo, 2)}–${VibraCharts.fmt(hi, 2)} Hz. Resolução Δf = ${VibraCharts.fmt(fs / frames, 2)} Hz com ${frames} quadros.`
      : 'Faixa inválida: use 0 < mínima < máxima < Nyquist (metade dos FPS físicos).';
  }

  /* ── Indicador de processamento sobre o painel amplificado ── */
  const proc = (() => {
    const box = $('proc'), arc = $('procArc'), pct = $('procPct'), clock = $('procClock');
    const steps = [...document.querySelectorAll('#procSteps li')], C = 2 * Math.PI * 52;
    let timer = 0, t0 = 0;
    function show(labels = {}) {
      steps.forEach(li => { li.className = ''; if (labels[li.dataset.k]) li.textContent = labels[li.dataset.k]; });
      t0 = performance.now(); clearInterval(timer);
      timer = setInterval(() => { clock.textContent = VibraCharts.fmt((performance.now() - t0) / 1000, 1) + ' s'; }, 100);
      box.hidden = false; update(0, 'read');
    }
    function update(p, key) {
      p = Math.max(0, Math.min(1, p));
      arc.style.strokeDashoffset = String(C * (1 - p)); pct.textContent = Math.round(p * 100);
      if (key) {
        const idx = steps.findIndex(li => li.dataset.k === key);
        steps.forEach((li, i) => { li.className = i < idx ? 'is-done' : i === idx ? 'is-on' : ''; });
      }
    }
    function hide() { clearInterval(timer); box.hidden = true; }
    return { show, update, hide };
  })();

  /* ── Botão em espera (spinner) ── */
  function busy(btn, on) { btn.classList.toggle('is-busy', on); btn.setAttribute('aria-busy', on ? 'true' : 'false'); }

  root.VibraUI = { flow, state, fill, band, proc, busy };
})(window);
