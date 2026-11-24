(function () {
  'use strict';
  const D = window.PRIS_DATA;
  const nb = d3.formatLocale({ decimal: ',', thousands: ' ', grouping: [3], currency: ['', ' kr'], minus: '−' });
  const d0 = nb.format(',.0f'), d1 = nb.format(',.1f'), sgn0 = nb.format('+.0f');
  const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  const KOMPRESSOR_KW = 17; // typisk kompressorlast vinterstid (målt 2025/26)
  const EFFEKT_KR_PER_KW = 111; // Elvia, oktober–mars

  const hh = (h) => String(h).padStart(2, '0');
  const osloDate = (offDays) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(new Date(Date.now() + offDays * 86400000));
  const osloHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', hour12: false }).format(new Date())) % 24;

  function el(tag, attrs, text) {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (text != null) e.textContent = text;
    return e;
  }

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

  function tip(host) {
    const t = el('div', { class: 'tip' });
    t.hidden = true;
    host.appendChild(t);
    return {
      show(evt, head, lines) {
        t.replaceChildren(el('div', { class: 'h' }, head), ...lines.map((l) => el('div', null, l)));
        t.hidden = false;
        const r = host.getBoundingClientRect();
        let x = evt.clientX - r.left + 12;
        const y = evt.clientY - r.top + 12;
        if (x + t.offsetWidth > r.width) x = Math.max(0, evt.clientX - r.left - t.offsetWidth - 12);
        t.style.left = x + 'px';
        t.style.top = y + 'px';
      },
      hide() { t.hidden = true; }
    };
  }

  function yGrid(svg, y, x0, x1, ticks) {
    const g = svg.append('g').attr('class', 'grid').attr('transform', 'translate(' + x0 + ',0)');
    g.call(d3.axisLeft(y).ticks(ticks || 5).tickSize(-(x1 - x0)).tickFormat(d0));
    g.selectAll('.tick text').attr('x', -6);
  }

  // ------------------------------------------------------------------ live prices
  const live = { idag: null, imorgen: null, datoIdag: osloDate(0), datoImorgen: osloDate(1) };

  async function getDay(dato) {
    try {
      const r = await fetch('/api/priser?dato=' + dato, { headers: { accept: 'application/json' } });
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.tilgjengelig ? j : null;
    } catch (e) {
      return null;
    }
  }

  function hourOf(p) { return Number(String(p.start).slice(11, 13)); }

  function cheapest(prices) { return prices.reduce((a, b) => (b.ore_per_kwh < a.ore_per_kwh ? b : a)); }
  function dearest(prices) { return prices.reduce((a, b) => (b.ore_per_kwh > a.ore_per_kwh ? b : a)); }

  function card(label, big, unit, sub, cls) {
    const c = el('div', { class: 'card' });
    c.appendChild(el('span', { class: 'label' }, label));
    const b = el('span');
    b.appendChild(el('span', { class: 'big' + (cls ? ' ' + cls : '') }, big));
    if (unit) b.appendChild(el('span', { class: 'unit' }, unit));
    c.appendChild(b);
    if (sub) c.appendChild(el('span', { class: 'label' }, sub));
    return c;
  }

  function renderCards() {
    const box = document.getElementById('pris-kort');
    if (!box) return;
    box.replaceChildren();
    const t = live.idag, m = live.imorgen;
    if (t) {
      const h = osloHour();
      const now = t.priser.find((p) => hourOf(p) === h);
      if (now) box.appendChild(card('Nå (kl. ' + hh(h) + '–' + hh((h + 1) % 24) + ')', d0(now.ore_per_kwh), 'øre/kWh',
        now.ore_per_kwh > t.snitt ? 'Over dagens snitt' : 'Under dagens snitt', now.ore_per_kwh > t.snitt ? 'bad' : 'good'));
      box.appendChild(card('Snitt i dag', d0(t.snitt), 'øre/kWh', 'Fra ' + d0(t.min) + ' til ' + d0(t.maks) + ' øre'));
      const c = cheapest(t.priser), x = dearest(t.priser);
      box.appendChild(card('Billigste og dyreste time i dag', 'kl. ' + hh(hourOf(c)), null, 'Billigst ' + d0(c.ore_per_kwh) + ' øre · dyrest kl. ' + hh(hourOf(x)) + ' (' + d0(x.ore_per_kwh) + ' øre)'));
    }
    if (m) {
      const diff = t ? m.snitt - t.snitt : null;
      box.appendChild(card('Snitt i morgen', d0(m.snitt), 'øre/kWh', diff == null ? '' : sgn0(diff) + ' øre mot i dag', diff == null ? '' : (diff > 0 ? 'bad' : 'good')));
    } else {
      box.appendChild(card('I morgen', 'ca. kl. 13', null, 'Morgendagens priser er ikke publisert ennå'));
    }
  }

  function drawDay() {
    const host = document.getElementById('dagchart');
    if (!host) return;
    host.replaceChildren();
    const days = [];
    if (live.idag) days.push({ navn: 'I dag', dato: live.datoIdag, d: live.idag });
    if (live.imorgen) days.push({ navn: 'I morgen', dato: live.datoImorgen, d: live.imorgen });
    if (!days.length) return;
    const slots = [];
    days.forEach((day, di) => day.d.priser.forEach((p) => slots.push({ key: di + '-' + p.start, day: di, navn: day.navn, h: hourOf(p), v: p.ore_per_kwh, snitt: day.d.snitt })));
    const W = Math.max(280, host.clientWidth || 600), H = 280, mt = 28, mb = 26;
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
      .attr('aria-label', 'Stolpediagram over spotprisen time for time i dag' + (days.length > 1 ? ' og i morgen' : '') + '.');
    const y = d3.scaleLinear().domain([0, d3.max(slots, (s) => s.v) * 1.08]).nice().range([H - mb, mt]);
    const ml = measure(svg, y.ticks(5).map(d0)) + 10;
    const x = d3.scaleBand().domain(slots.map((s) => s.key)).range([ml, W - 2]).paddingInner(0.12);
    yGrid(svg, y, ml, W - 2);
    const every = x.bandwidth() < 9 ? 6 : (x.bandwidth() < 16 ? 3 : 2);
    svg.append('g').attr('transform', 'translate(0,' + (H - mb) + ')')
      .call(d3.axisBottom(x).tickSizeOuter(0).tickValues(slots.filter((s) => s.h % every === 0).map((s) => s.key))
        .tickFormat((k) => hh(slots.find((s) => s.key === k).h)));
    const color = (s) => (s.v < s.snitt * 0.92 ? 'var(--ok)' : (s.v > s.snitt * 1.08 ? 'var(--bad)' : 'var(--c3)'));
    const nowH = osloHour();
    const t = tip(host);
    svg.append('g').selectAll('rect').data(slots).join('rect')
      .attr('x', (s) => x(s.key)).attr('width', x.bandwidth())
      .attr('y', (s) => y(s.v)).attr('height', (s) => Math.max(0, y(0) - y(s.v)))
      .style('fill', color)
      .style('stroke', (s) => (s.day === 0 && s.h === nowH ? 'var(--fg)' : null)).attr('stroke-width', 2)
      .on('pointermove pointerdown', (evt, s) => t.show(evt, s.navn + ' kl. ' + hh(s.h) + '–' + hh((s.h + 1) % 24),
        [d1(s.v) + ' øre/kWh', (s.v >= s.snitt ? '+' : '') + d0(s.v - s.snitt) + ' øre mot dagens snitt']))
      .on('pointerleave', () => t.hide());
    days.forEach((day, di) => {
      const first = slots.find((s) => s.day === di);
      const last = slots.filter((s) => s.day === di).slice(-1)[0];
      const x0 = x(first.key), x1 = x(last.key) + x.bandwidth();
      svg.append('text').attr('class', 'axlab').attr('x', (x0 + x1) / 2).attr('y', 12).attr('text-anchor', 'middle')
        .style('font-weight', 600).text(day.navn + ' · snitt ' + d0(day.d.snitt) + ' øre');
      if (di > 0) svg.append('line').attr('x1', x0 - x.step() * x.paddingInner() / 2).attr('x2', x0 - x.step() * x.paddingInner() / 2)
        .attr('y1', 18).attr('y2', H - mb).style('stroke', 'var(--ref)').attr('stroke-dasharray', '3 3');
    });
  }

  function blockAvg(prices, start, len) {
    const seg = prices.slice(start, start + len);
    return seg.length === len ? d3.mean(seg, (p) => p.ore_per_kwh) : null;
  }

  function renderAdvice() {
    const box = document.getElementById('raad');
    if (!box) return;
    const day = live.imorgen ? { navn: 'i morgen', d: live.imorgen } : (live.idag ? { navn: 'i dag', d: live.idag } : null);
    box.replaceChildren();
    if (!day || day.d.priser.length < 20) { box.hidden = true; return; }
    const pr = day.d.priser, L = 3;
    let best = null;
    for (let i = 0; i + L <= pr.length; i++) {
      const h = hourOf(pr[i]);
      if (h < 6 || h > 21) continue;
      const a = blockAvg(pr, i, L);
      if (a != null && (!best || a > best.a)) best = { i, a };
    }
    if (!best) { box.hidden = true; return; }
    let pre = null;
    for (let i = Math.max(0, best.i - 8); i + L <= best.i; i++) {
      const a = blockAvg(pr, i, L);
      if (a != null && (!pre || a < pre.a)) pre = { i, a };
    }
    const diff = pre ? best.a - pre.a : 0;
    const span = (i) => 'kl. ' + hh(hourOf(pr[i])) + '–' + hh((hourOf(pr[i]) + L) % 24);
    box.appendChild(el('h3', null, 'Forslag for isanlegget ' + day.navn));
    if (!pre || diff < 15) {
      box.appendChild(el('p', null, 'Prisene er jevne ' + day.navn + ' (under 15 øre forskjell mellom den dyreste perioden og timene før). Det er lite å hente på å flytte kompressordrift.'));
    } else {
      const kr = KOMPRESSOR_KW * L * diff / 100;
      box.appendChild(el('p', null, 'Dyreste periode: ' + span(best.i) + ' (snitt ' + d0(best.a) + ' øre/kWh). Kjøl isen litt ekstra ' + span(pre.i) +
        ' (snitt ' + d0(pre.a) + ' øre) og la kompressorene gå roligere i den dyre perioden.'));
      box.appendChild(el('p', null, 'Forskjellen er ' + d0(diff) + ' øre/kWh. Flyttes rundt ' + KOMPRESSOR_KW + ' kW kompressorlast i ' + L + ' timer, sparer det omtrent ' + d0(kr) + ' kr den dagen.'));
    }
    box.appendChild(el('p', { class: 'muted' }, 'Pass på at forkjølingen ikke lager en ny effekttopp: nettleien tar ' + EFFEKT_KR_PER_KW + ' kr/kW for månedens høyeste time i vintermånedene.'));
    box.hidden = false;
  }

  async function loadLive() {
    const status = document.getElementById('status');
    const [a, b] = await Promise.all([getDay(live.datoIdag), getDay(live.datoImorgen)]);
    live.idag = a; live.imorgen = b;
    if (status) {
      if (!a && !b) status.textContent = 'Fikk ikke hentet dagens priser akkurat nå. Prøv å laste siden på nytt om litt.';
      else status.textContent = 'Oppdatert ' + new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' }).format(new Date()) +
        (b ? '. Morgendagens priser er klare.' : '. Morgendagens priser kommer ca. kl. 13.');
    }
    renderCards();
    drawDay();
    renderAdvice();
  }

  // ------------------------------------------------------------------ year heatmap
  let heatMode = 'rel';
  const monthLabel = (mk) => MND[Number(mk.slice(5, 7)) - 1] + ' ' + mk.slice(2, 4);

  function drawHeat() {
    const host = document.getElementById('heatchart');
    if (!host) return;
    host.replaceChildren();
    const rows = D.maaned.map((m) => {
      const mean = d3.mean(m.timer);
      return { mk: m.mnd, label: monthLabel(m.mnd) + (m.dager < 28 ? '*' : ''), dager: m.dager, mean, cells: m.timer.map((v, h) => ({ h, v, rel: v / mean - 1 })) };
    });
    const W = Math.max(280, host.clientWidth || 600);
    const ml = 58, mt = 6, mb = 24;
    const cw = (W - ml - 2) / 24;
    const ch = Math.max(16, Math.min(26, cw * 1.1));
    const H = mt + mb + rows.length * ch;
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
      .attr('aria-label', 'Varmekart: snittpris per time i døgnet for hver måned det siste året.');
    const all = rows.flatMap((r) => r.cells);
    let color, scaleLabel;
    if (heatMode === 'rel') {
      const m = d3.max(all, (c) => Math.abs(c.rel));
      const sc = d3.scaleSequential(d3.interpolateRdYlGn).domain([m, -m]);
      color = (c) => sc(c.rel);
      scaleLabel = [sc, '−' + d0(m * 100) + ' % (billigere)', '+' + d0(m * 100) + ' % (dyrere)', true];
    } else {
      const ext = d3.extent(all, (c) => c.v);
      const sc = d3.scaleSequential(d3.interpolateYlOrRd).domain(ext);
      color = (c) => sc(c.v);
      scaleLabel = [sc, d0(ext[0]) + ' øre', d0(ext[1]) + ' øre', false];
    }
    const t = tip(host);
    rows.forEach((r, i) => {
      const y = mt + i * ch;
      svg.append('text').attr('class', 'axlab').attr('x', ml - 6).attr('y', y + ch / 2 + 4).attr('text-anchor', 'end').text(r.label);
      svg.append('g').selectAll('rect').data(r.cells).join('rect')
        .attr('x', (c) => ml + c.h * cw).attr('y', y).attr('width', Math.max(1, cw - 1)).attr('height', ch - 1)
        .style('fill', color)
        .on('pointermove pointerdown', (evt, c) => t.show(evt, monthLabel(r.mk) + ' kl. ' + hh(c.h) + '–' + hh((c.h + 1) % 24),
          [d1(c.v) + ' øre/kWh', (c.rel >= 0 ? '+' : '') + d0(c.rel * 100) + ' % mot månedens snitt (' + d0(r.mean) + ' øre)'].concat(r.dager < 28 ? ['Bare ' + r.dager + ' dager med'] : [])))
        .on('pointerleave', () => t.hide());
    });
    const every = cw < 16 ? 3 : 2;
    const ax = svg.append('g').attr('transform', 'translate(0,' + (mt + rows.length * ch + 4) + ')');
    d3.range(0, 24, every).forEach((h) => {
      ax.append('text').attr('class', 'axlab').attr('x', ml + h * cw + cw / 2).attr('y', 12).attr('text-anchor', 'middle').text(hh(h));
    });
    const sk = document.getElementById('heat-skala');
    if (sk) {
      const [sc, lo, hi, rev] = scaleLabel;
      const dom = sc.domain();
      const stops = d3.range(0, 1.0001, 0.1).map((f) => sc(dom[0] + (dom[1] - dom[0]) * f));
      const g = el('span', { class: 'gradient' });
      g.style.background = 'linear-gradient(to right, ' + (rev ? stops.slice().reverse() : stops).join(',') + ')';
      sk.replaceChildren(el('span', null, rev ? lo : lo), g, el('span', null, hi));
    }
    const fk = document.getElementById('heat-forklaring');
    if (fk) fk.textContent = heatMode === 'rel'
      ? 'Hver rute er snittprisen for den timen i måneden. Rødt er dyrere og grønt billigere enn månedens snitt, slik at mønsteret gjennom døgnet trer fram. Pek eller trykk på en rute for tall. * = måneden er bare delvis med.'
      : 'Hver rute er snittprisen for den timen i måneden, i øre/kWh. Mørkere er dyrere. Pek eller trykk på en rute for tall. * = måneden er bare delvis med.';
  }

  function setHeatMode(m) {
    heatMode = m;
    document.querySelectorAll('#vis-rel, #vis-abs').forEach((b) => b.setAttribute('aria-pressed', String(b.id === 'vis-' + m)));
    drawHeat();
  }

  // ------------------------------------------------------------------ profiles
  function drawProfile(id, a, b, la, lb, ca, cb) {
    const host = document.getElementById(id);
    if (!host) return;
    host.replaceChildren();
    const W = Math.max(260, host.clientWidth || 500), H = 240, mt = 10, mb = 24;
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
      .attr('aria-label', 'Linjediagram: snittpris per time i døgnet, ' + la + ' og ' + lb + '.');
    const y = d3.scaleLinear().domain([0, d3.max(a.concat(b)) * 1.08]).nice().range([H - mb, mt]);
    const ml = measure(svg, y.ticks(4).map(d0)) + 10;
    const x = d3.scaleLinear().domain([0, 23]).range([ml + 4, W - 6]);
    yGrid(svg, y, ml, W - 2, 4);
    svg.append('g').attr('transform', 'translate(0,' + (H - mb) + ')')
      .call(d3.axisBottom(x).tickValues(d3.range(0, 24, W < 400 ? 6 : 3)).tickFormat((h) => hh(h)).tickSizeOuter(0));
    const line = d3.line().x((v, h) => x(h)).y((v) => y(v));
    [[a, ca], [b, cb]].forEach(([s, c]) => svg.append('path').datum(s).attr('fill', 'none').style('stroke', c).attr('stroke-width', 2).attr('d', line));
    const dots = [ca, cb].map((c) => svg.append('circle').attr('r', 3.5).style('fill', c).attr('visibility', 'hidden'));
    const t = tip(host);
    svg.append('rect').attr('x', ml).attr('y', mt).attr('width', W - ml).attr('height', H - mt - mb).attr('fill', 'transparent')
      .on('pointermove pointerdown', (evt) => {
        const h = Math.max(0, Math.min(23, Math.round(x.invert(d3.pointer(evt)[0]))));
        dots[0].attr('cx', x(h)).attr('cy', y(a[h])).attr('visibility', 'visible');
        dots[1].attr('cx', x(h)).attr('cy', y(b[h])).attr('visibility', 'visible');
        t.show(evt, 'Kl. ' + hh(h) + '–' + hh((h + 1) % 24), [la + ': ' + d1(a[h]) + ' øre', lb + ': ' + d1(b[h]) + ' øre']);
      })
      .on('pointerleave', () => { t.hide(); dots.forEach((d) => d.attr('visibility', 'hidden')); });
  }

  // ------------------------------------------------------------------ dearest / cheapest counts
  function drawCounts() {
    const host = document.getElementById('tellerchart');
    if (!host) return;
    host.replaceChildren();
    const rows = d3.range(24).map((h) => ({ h, up: D.dyrest_teller[h], down: D.billigst_teller[h] }));
    const W = Math.max(280, host.clientWidth || 600), H = 280, mt = 10, mb = 24;
    const m = d3.max(rows, (r) => Math.max(r.up, r.down));
    const svg = d3.select(host).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
      .attr('aria-label', 'Stolpediagram: hvor mange dager hver time var døgnets dyreste (opp) og billigste (ned) det siste året.');
    const y = d3.scaleLinear().domain([-m * 1.1, m * 1.1]).nice().range([H - mb, mt]);
    const ml = measure(svg, ['000']) + 12;
    const x = d3.scaleBand().domain(d3.range(24)).range([ml, W - 2]).padding(0.15);
    const g = svg.append('g').attr('class', 'grid').attr('transform', 'translate(' + ml + ',0)');
    g.call(d3.axisLeft(y).ticks(6).tickSize(-(W - 2 - ml)).tickFormat((v) => d0(Math.abs(v))));
    g.selectAll('.tick text').attr('x', -6);
    svg.append('line').attr('x1', ml).attr('x2', W - 2).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--axis)');
    svg.append('g').attr('transform', 'translate(0,' + (H - mb) + ')')
      .call(d3.axisBottom(x).tickValues(d3.range(0, 24, x.bandwidth() < 14 ? 3 : 2)).tickFormat((h) => hh(h)).tickSizeOuter(0));
    const t = tip(host);
    const show = (evt, r) => t.show(evt, 'Kl. ' + hh(r.h) + '–' + hh((r.h + 1) % 24), ['Dyrest: ' + r.up + ' dager', 'Billigst: ' + r.down + ' dager']);
    svg.append('g').selectAll('rect').data(rows).join('rect').style('fill', 'var(--bad)')
      .attr('x', (r) => x(r.h)).attr('width', x.bandwidth()).attr('y', (r) => y(r.up)).attr('height', (r) => y(0) - y(r.up))
      .on('pointermove pointerdown', show).on('pointerleave', () => t.hide());
    svg.append('g').selectAll('rect').data(rows).join('rect').style('fill', 'var(--ok)')
      .attr('x', (r) => x(r.h)).attr('width', x.bandwidth()).attr('y', y(0)).attr('height', (r) => y(-r.down) - y(0))
      .on('pointermove pointerdown', show).on('pointerleave', () => t.hide());
    svg.append('text').attr('class', 'axlab').attr('x', ml + 4).attr('y', mt + 10).text('Dyrest');
    svg.append('text').attr('class', 'axlab').attr('x', ml + 4).attr('y', H - mb - 6).text('Billigst');
  }

  function drawStatic() {
    drawHeat();
    drawProfile('profil-sesong', D.vinter, D.sommer, 'Vinter', 'Sommer', 'var(--c0)', 'var(--c3)');
    drawProfile('profil-uke', D.hverdag, D.helg, 'Hverdager', 'Helg', 'var(--c0)', 'var(--c4)');
    drawCounts();
  }

  document.querySelectorAll('#vis-rel').forEach((b) => b.addEventListener('click', () => setHeatMode('rel')));
  document.querySelectorAll('#vis-abs').forEach((b) => b.addEventListener('click', () => setHeatMode('abs')));
  let lastW = window.innerWidth, timer = null;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (Math.abs(window.innerWidth - lastW) > 20) { lastW = window.innerWidth; drawStatic(); drawDay(); } }, 150);
  });
  drawStatic();
  loadLive();
  // Refresh live prices every 15 minutes while the page is open (picks up tomorrow's prices after ~13:00).
  setInterval(() => { live.datoIdag = osloDate(0); live.datoImorgen = osloDate(1); loadLive(); }, 15 * 60 * 1000);
})();
