(function () {
  'use strict';
  const D = window.SC_DATA;
  const nb = d3.formatLocale({ decimal: ',', thousands: ' ', grouping: [3], currency: ['', ' kr'], minus: '−' });
  const d1 = nb.format(',.1f'), d0 = nb.format(',.0f');
  const MONTHS = ['Aug', 'Sep', 'Okt', 'Nov', 'Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul'];
  const NAMES = { Komp: 'Kompressorer', Avf: 'Avfukter', Rest: 'Resterende', NyDel: 'Ny del', Vent: 'Ventilasjon' };
  const parseDay = d3.utcParse('%Y-%m-%d'), fmtDay = d3.utcFormat('%d.%m.%Y');

  function measure(svg, labels) {
    const g = svg.append('g').attr('class', 'tick');
    let w = 0;
    labels.forEach((l) => {
      const t = g.append('text').text(l);
      let len = 0;
      try { len = t.node().getComputedTextLength(); } catch (e) { len = 0; }
      if (!len) len = String(l).length * 7;
      w = Math.max(w, len);
    });
    g.remove();
    return w;
  }

  function tip(el) {
    const t = document.createElement('div');
    t.className = 'tip';
    t.hidden = true;
    el.appendChild(t);
    return {
      show(evt, head, lines) {
        t.replaceChildren();
        const h = document.createElement('div'); h.className = 'h'; h.textContent = head; t.appendChild(h);
        lines.forEach((l) => { const d = document.createElement('div'); d.textContent = l; t.appendChild(d); });
        t.hidden = false;
        const r = el.getBoundingClientRect();
        let x = evt.clientX - r.left + 12;
        const y = evt.clientY - r.top + 12;
        const tw = t.offsetWidth;
        if (x + tw > r.width) x = Math.max(0, evt.clientX - r.left - tw - 12);
        t.style.left = x + 'px';
        t.style.top = y + 'px';
      },
      hide() { t.hidden = true; }
    };
  }

  function yGrid(svg, y, x0, x1) {
    const g = svg.append('g').attr('class', 'grid').attr('transform', 'translate(' + x0 + ',0)');
    g.call(d3.axisLeft(y).ticks(5).tickSize(-(x1 - x0)).tickFormat(d0));
    g.selectAll('.tick text').attr('x', -6);
  }

  function setup(id, H, mt, mb, ymax, label) {
    const el = document.getElementById(id);
    if (!el) return null;
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth || 600);
    const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', label);
    const y = d3.scaleLinear().domain([0, ymax]).nice().range([H - mb, mt]);
    const ml = measure(svg, y.ticks(5).map(d0)) + 10;
    return { el, W, H, svg, y, ml, mb, mt };
  }

  function bottomAxis(c, x, fmt) {
    c.svg.append('g').attr('transform', 'translate(0,' + (c.H - c.mb) + ')').call(d3.axisBottom(x).tickSizeOuter(0).tickFormat(fmt));
  }

  // ---- October / November ----
  function drawOktNov() {
    const rows = [...D.okt_nov].sort((a, b) => a.aar - b.aar);
    const keys = ['okt_kwh_dogn', 'nov_kwh_dogn'];
    const mn = { okt_kwh_dogn: 'Oktober', nov_kwh_dogn: 'November' };
    const col = { okt_kwh_dogn: 'var(--okt)', nov_kwh_dogn: 'var(--nov)' };
    const maxV = d3.max(rows, (r) => Math.max(r.okt_kwh_dogn || 0, r.nov_kwh_dogn || 0));
    const c = setup('oktnov', 260, 20, 24, maxV * 1.1, 'Grupperte stolper: forbruk per døgn i oktober og november hvert år fra 2014 til 2026.');
    if (!c) return;
    const x0 = d3.scaleBand().domain(rows.map((r) => String(r.aar))).range([c.ml, c.W - 2]).paddingInner(0.2).paddingOuter(0.05);
    const x1 = d3.scaleBand().domain(keys).range([0, x0.bandwidth()]).padding(0.08);
    if (x0('2026') != null) {
      c.svg.append('rect').attr('x', x0('2026') - x0.step() * 0.1).attr('width', x0.step()).attr('y', c.mt - 16).attr('height', c.H - c.mb - c.mt + 16)
        .style('fill', 'var(--panel)').style('stroke', 'var(--line)');
    }
    yGrid(c.svg, c.y, c.ml, c.W - 2);
    bottomAxis(c, x0, (s) => (x0.bandwidth() < 34 ? "'" + s.slice(2) : s));
    const t = tip(c.el);
    const cells = [];
    rows.forEach((r) => keys.forEach((k) => { if (r[k] != null) cells.push({ r, k }); }));
    c.svg.append('g').selectAll('rect').data(cells).join('rect')
      .style('fill', (d) => col[d.k])
      .attr('x', (d) => x0(String(d.r.aar)) + x1(d.k)).attr('width', x1.bandwidth())
      .attr('y', (d) => c.y(d.r[d.k])).attr('height', (d) => Math.max(0, c.y(0) - c.y(d.r[d.k])))
      .on('pointermove pointerdown', (evt, d) => {
        const p = d.k.slice(0, 3);
        const lines = [d0(d.r[d.k]) + ' kWh per døgn'];
        if (d.r[p + '_mwh'] != null) lines.push(d1(d.r[p + '_mwh']) + ' MWh i måneden');
        else lines.push('Så langt: ' + d.r[p + '_dager'] + ' dager');
        if (d.r[p + '_temp'] != null) lines.push('Snittemp. ute: ' + d1(d.r[p + '_temp']) + ' °C');
        t.show(evt, mn[d.k] + ' ' + d.r.aar, lines);
      })
      .on('pointerleave', () => t.hide());
  }

  // ---- Oct–May per season ----
  function drawOktMai() {
    const rows = D.okt_mai;
    const c = setup('oktmai', 300, 22, 26, d3.max(rows, (r) => r.Total) * 1.08, 'Stolpediagram over forbruk oktober–mai per sesong fra 2014/15 til 2025/26, delt i underliggende forbruk og anslått økt antennelast.');
    if (!c) return;
    const x = d3.scaleBand().domain(rows.map((r) => r.sesong)).range([c.ml, c.W - 2]).padding(0.22);
    const bw = x.bandwidth();
    yGrid(c.svg, c.y, c.ml, c.W - 2);
    bottomAxis(c, x, (s) => (bw < 30 ? "'" + s.slice(2, 4) : (bw < 44 ? s.slice(2) : s)));
    const stack = d3.stack().keys(['ekskl_antennevekst', 'antennevekst']).value((r, k) => r[k] || 0)(rows);
    const t = tip(c.el);
    c.svg.append('g').selectAll('g').data(stack).join('g')
      .style('fill', (d, i) => (i === 0 ? 'var(--c0)' : 'var(--c1)'))
      .selectAll('rect').data((d) => d).join('rect')
      .attr('x', (d) => x(d.data.sesong)).attr('width', x.bandwidth())
      .attr('y', (d) => c.y(d[1])).attr('height', (d) => Math.max(0, c.y(d[0]) - c.y(d[1])))
      .on('pointermove pointerdown', (evt, d) => {
        const r = d.data;
        const lines = ['Totalt: ' + d1(r.Total) + ' MWh', 'Antennevekst (anslag): ' + d1(r.antennevekst) + ' MWh', 'Værkorrigert: ' + d1(r.vaerkorr) + ' MWh'];
        if (r.merknad) lines.push(r.merknad);
        t.show(evt, 'Oktober–mai ' + r.sesong, lines);
      })
      .on('pointerleave', () => t.hide());
    if (x.bandwidth() >= 26) {
      c.svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'val')
        .attr('x', (r) => x(r.sesong) + x.bandwidth() / 2).attr('y', (r) => c.y(r.Total) - 4)
        .attr('text-anchor', 'middle').text((r) => d0(r.Total));
    }
    c.svg.append('g').selectAll('text').data(rows.filter((r) => r.merknad)).join('text').attr('class', 'val')
      .attr('x', (r) => x(r.sesong) + x.bandwidth() / 2).attr('y', (r) => c.y(r.Total) - (x.bandwidth() >= 26 ? 18 : 4))
      .attr('text-anchor', 'middle').text('*');
    const notes = document.getElementById('oktmai-notes');
    if (notes) {
      notes.replaceChildren();
      rows.filter((r) => r.merknad).forEach((r) => { const li = document.createElement('li'); li.textContent = '* ' + r.sesong + ': ' + r.merknad; notes.appendChild(li); });
    }
  }

  // ---- Month heat table ----
  function heat(v, med) {
    if (v == null || !med) return '';
    const ratio = v / med - 1;
    const a = Math.round(Math.min(Math.abs(ratio) / 0.25, 1) * 42);
    return 'color-mix(in srgb, ' + (ratio > 0 ? 'var(--bad)' : 'var(--ok)') + ' ' + a + '%, transparent)';
  }
  function drawHeat() {
    const tb = document.getElementById('heat-body');
    if (!tb) return;
    const sel = document.getElementById('maaler');
    const f = sel && sel.value ? sel.value : 'Total';
    tb.replaceChildren();
    const seasons = [...new Set(D.maaned.map((r) => r.sesong))];
    const idx = new Map(D.maaned.map((r) => [r.sesong + '|' + r.maaned, r]));
    const med = {};
    MONTHS.forEach((m) => { med[m] = d3.median(D.maaned.filter((r) => r.maaned === m && r[f] != null), (r) => r[f]); });
    const om = new Map(D.okt_mai.map((r) => [r.sesong, r]));
    const omMed = d3.median(D.okt_mai.filter((r) => r[f] != null), (r) => r[f]);
    seasons.forEach((s) => {
      const tr = tb.insertRow();
      const th = document.createElement('th'); th.scope = 'row'; th.textContent = s; tr.appendChild(th);
      MONTHS.forEach((m) => {
        const td = tr.insertCell();
        const r = idx.get(s + '|' + m);
        if (!r) return;
        if (r[f] == null) { td.textContent = '–'; return; }
        td.textContent = d1(r[f]);
        td.style.background = heat(r[f], med[m]);
      });
      const td = tr.insertCell(); td.className = 'om';
      const r = om.get(s);
      if (r && r[f] != null) { td.textContent = d1(r[f]); td.style.background = heat(r[f], omMed); }
      else if (r) td.textContent = '–';
    });
  }

  // ---- Weekly line ----
  function drawUker() {
    const rows = D.uker.map((r) => Object.assign({}, r, { d: parseDay(r.mandag) })).filter((r) => r.d && r.Total != null);
    const c = setup('ukechart', 260, 10, 24, d3.max(rows, (r) => r.Total), 'Linjediagram over totalt ukeforbruk i MWh fra januar 2014 til november 2026.');
    if (!c) return;
    const x = d3.scaleUtc().domain(d3.extent(rows, (r) => r.d)).range([c.ml, c.W - 6]);
    yGrid(c.svg, c.y, c.ml, c.W - 6);
    const every = c.W < 520 ? 3 : (c.W < 800 ? 2 : 1);
    c.svg.append('g').attr('transform', 'translate(0,' + (c.H - c.mb) + ')').call(d3.axisBottom(x).ticks(d3.utcYear.every(every)).tickFormat(d3.utcFormat('%Y')).tickSizeOuter(0));
    c.svg.append('path').datum(rows).attr('fill', 'none').style('stroke', 'var(--c0)').attr('stroke-width', 1.3)
      .attr('d', d3.line().x((r) => x(r.d)).y((r) => c.y(r.Total)));
    const dot = c.svg.append('circle').attr('r', 3.5).style('fill', 'var(--c0)').attr('visibility', 'hidden');
    const t = tip(c.el);
    const bis = d3.bisector((r) => r.d).center;
    c.svg.append('rect').attr('x', c.ml).attr('y', c.mt).attr('width', c.W - 6 - c.ml).attr('height', c.H - c.mb - c.mt).attr('fill', 'transparent')
      .on('pointermove pointerdown', (evt) => {
        const [px] = d3.pointer(evt);
        const r = rows[bis(rows, x.invert(px))];
        if (!r) return;
        dot.attr('cx', x(r.d)).attr('cy', c.y(r.Total)).attr('visibility', 'visible');
        const parts = String(r.uke).split('.');
        const lines = ['Totalt: ' + d1(r.Total) + ' MWh'];
        if (r.utetemp != null) lines.push('Snittemp. ute: ' + d1(r.utetemp) + ' °C');
        lines.push('Uka starter ' + fmtDay(r.d));
        t.show(evt, 'Uke ' + parts[0] + ', ' + parts[1], lines);
      })
      .on('pointerleave', () => { t.hide(); dot.attr('visibility', 'hidden'); });
  }

  // ---- Temperature bands ----
  function drawTemp() {
    const rows = [...D.temperatur].sort((a, b) => a.nr - b.nr);
    const keys = ['Komp', 'Avf', 'Rest', 'NyDel', 'Vent'];
    const c = setup('tempchart', 300, 20, 26, d3.max(rows, (r) => r.Total) * 1.08, 'Stablet stolpediagram: snitt ukeforbruk per måler etter utetemperatur.');
    if (!c) return;
    const x = d3.scaleBand().domain(rows.map((r) => r.utetemp)).range([c.ml, c.W - 2]).padding(0.2);
    const bw = x.bandwidth();
    const shortLab = (s) => s.replace('under ', '<').replace('over ', '>').replace(' til ', '…');
    yGrid(c.svg, c.y, c.ml, c.W - 2);
    bottomAxis(c, x, (s) => {
      if (bw >= 58) return s;
      if (bw >= 36) return shortLab(s);
      return rows.findIndex((r) => r.utetemp === s) % 2 === 0 ? shortLab(s) : '';
    });
    const stack = d3.stack().keys(keys).value((r, k) => r[k] || 0)(rows);
    const t = tip(c.el);
    c.svg.append('g').selectAll('g').data(stack).join('g')
      .style('fill', (d, i) => 'var(--c' + i + ')')
      .selectAll('rect').data((d) => d).join('rect')
      .attr('x', (d) => x(d.data.utetemp)).attr('width', x.bandwidth())
      .attr('y', (d) => c.y(d[1])).attr('height', (d) => Math.max(0, c.y(d[0]) - c.y(d[1])))
      .on('pointermove pointerdown', (evt, d) => {
        const r = d.data;
        const lines = keys.slice().reverse().map((k) => NAMES[k] + ': ' + d1(r[k]) + ' MWh');
        lines.push('Totalt: ' + d1(r.Total) + ' MWh per uke', r.uker + ' uker');
        t.show(evt, 'Utetemp. ' + r.utetemp + ' °C', lines);
      })
      .on('pointerleave', () => t.hide());
    c.svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'val')
      .attr('x', (r) => x(r.utetemp) + x.bandwidth() / 2).attr('y', (r) => c.y(r.Total) - 4)
      .attr('text-anchor', 'middle').text((r) => (x.bandwidth() < 34 ? d0(r.Total) : d1(r.Total)));
  }

  // ---- Simple yearly bars ----
  function yearBars(id, rows, label, colorFn, tipLines, refValue, refLabel) {
    rows = [...rows].sort((a, b) => a.aar - b.aar);
    const ymax = Math.max(d3.max(rows, (r) => r.kwh_dogn), refValue || 0) * 1.12;
    const c = setup(id, 260, 22, 24, ymax, label);
    if (!c) return;
    const x = d3.scaleBand().domain(rows.map((r) => String(r.aar))).range([c.ml, c.W - 2]).padding(0.25);
    yGrid(c.svg, c.y, c.ml, c.W - 2);
    bottomAxis(c, x, (s) => (x.bandwidth() < 34 ? "'" + s.slice(2) : s));
    const t = tip(c.el);
    c.svg.append('g').selectAll('rect').data(rows).join('rect')
      .style('fill', colorFn)
      .attr('x', (r) => x(String(r.aar))).attr('width', x.bandwidth())
      .attr('y', (r) => c.y(r.kwh_dogn)).attr('height', (r) => Math.max(0, c.y(0) - c.y(r.kwh_dogn)))
      .on('pointermove pointerdown', (evt, r) => t.show(evt, 'Sommeren ' + r.aar, tipLines(r)))
      .on('pointerleave', () => t.hide());
    if (x.bandwidth() >= 24) {
      c.svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'val')
        .attr('x', (r) => x(String(r.aar)) + x.bandwidth() / 2).attr('y', (r) => c.y(r.kwh_dogn) - 4)
        .attr('text-anchor', 'middle').text((r) => d0(r.kwh_dogn));
    }
    if (refValue) {
      c.svg.append('line').attr('x1', c.ml).attr('x2', c.W - 2).attr('y1', c.y(refValue)).attr('y2', c.y(refValue))
        .style('stroke', 'var(--ref)').attr('stroke-dasharray', '4 3');
      c.svg.append('text').attr('class', 'axlab').attr('x', c.ml + 4).attr('y', c.y(refValue) - 6).text(refLabel);
    }
  }

  function drawAll() {
    drawOktNov();
    drawOktMai();
    drawHeat();
    drawUker();
    drawTemp();
    yearBars('sommerchart', D.sommerlast, 'Stolpediagram over hallens totale sommerforbruk uten isanlegg i kWh per døgn per år 2014–2026.',
      (r) => (r.aar <= 2017 ? 'var(--muted-bar)' : 'var(--c0)'),
      (r) => [d0(r.kwh_dogn) + ' kWh/døgn, hele hallen', 'Median av ' + r.uker + ' uker uten isanlegg']);
    yearBars('grunnlastchart', D.grunnlast, 'Stolpediagram over sommer-grunnlast på Resterende forbruk i kWh per døgn 2018–2026, med linje for antenneanslaget.',
      () => 'var(--c0)', (r) => [d0(r.kwh_dogn) + ' kWh/døgn', 'Median av ' + r.uker + ' uker'],
      D.antenne, 'Anslag for antennene: ' + d0(D.antenne) + ' kWh/døgn');
  }

  const sel = document.getElementById('maaler');
  if (sel) sel.addEventListener('change', drawHeat);
  let lastW = 0, timer = null;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (Math.abs(window.innerWidth - lastW) > 20) { lastW = window.innerWidth; drawAll(); } }, 150);
  });
  lastW = window.innerWidth;
  drawAll();
})();
