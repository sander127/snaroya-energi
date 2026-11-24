"""Bygger den frittstående energirapporten til site/index.html.

Kjør fra repo-roten:  python3 rapport/build.py
Data ligger i rapport/data/*.json (rader). Malen er rapport/template.html og grafkoden rapport/app.js.
"""
import json, os, statistics

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'data')
SITE = os.path.join(HERE, '..', 'site')
os.makedirs(SITE, exist_ok=True)


def rows(name):
    data = json.load(open(os.path.join(OUT, name)))
    return data['rows'] if isinstance(data, dict) else data


okt_mai = rows('okt_mai.json')
maaned = rows('maaned.json')
uker = rows('uker.json')
temperatur = rows('temperatur.json')
grunnlast = rows('grunnlast.json')
sommerlast = rows('sommerlast.json')
okt_nov = rows('okt_nov.json')
vaertest = rows('vaertest.json')
hoest = rows('hoest.json')

MINUS = '−'
NBSP = ' '


def fmt(v, dec=1):
    s = f'{abs(v):,.{dec}f}'.replace(',', ' ').replace('.', ',').replace(' ', NBSP)
    return (MINUS if v < 0 else '') + s


def pct(v):
    sign = MINUS if v < 0 else '+'
    return sign + f'{abs(v):.1f}'.replace('.', ',') + NBSP + '%'


def cls(v):
    return 'good' if v < 0 else ('bad' if v > 0 else '')


def chg(a, b):
    return round((a / b - 1) * 1000) / 10


om = {r['sesong']: r for r in okt_mai}
cur, prev, r1415, r1718 = om['2025/26'], om['2024/25'], om['2014/15'], om['2017/18']
e_prev = chg(cur['Total'], prev['Total'])
e_1415 = chg(cur['Total'], r1415['Total'])
e_1718 = chg(cur['Total'], r1718['Total'])
e_ex_1415 = chg(cur['ekskl_antennevekst'], r1415['ekskl_antennevekst'])
e_ex_1718 = chg(cur['ekskl_antennevekst'], r1718['ekskl_antennevekst'])

gl = {r['aar']: r['kwh_dogn'] for r in grunnlast}
gl_ref = round(statistics.mean([gl[y] for y in (2018, 2019, 2020, 2021)]) + 1e-9)
sl = {r['aar']: r['kwh_dogn'] for r in sommerlast}

on = {r['aar']: r for r in okt_nov}
o26, o25 = on[2026], on[2025]
hist_okt = [on[y]['okt_kwh_dogn'] for y in range(2014, 2026)]
hist_nov = [on[y]['nov_kwh_dogn'] for y in range(2014, 2026)]
okt_snitt = statistics.mean(hist_okt)
nov_snitt = statistics.mean(hist_nov)
okt_fjor = chg(o26['okt_kwh_dogn'], o25['okt_kwh_dogn'])
okt_vs_snitt = chg(o26['okt_kwh_dogn'], okt_snitt)
okt_lavere = sum(1 for h in hist_okt if h < o26['okt_kwh_dogn'])
has_nov = o26.get('nov_kwh_dogn') is not None
if has_nov:
    nov_fjor = chg(o26['nov_kwh_dogn'], o25['nov_kwh_dogn'])
    nov_vs_snitt = chg(o26['nov_kwh_dogn'], nov_snitt)

mm = {(r['sesong'], r['maaned']): r for r in maaned}


def m(s, mon, f):
    return mm[(s, mon)][f]


def b(text, c=''):
    return f'<b class="{c}">{text}</b>' if c else f'<b>{text}</b>'


ctx = dict(
    om_total=fmt(cur['Total']), e_prev=b(pct(e_prev), cls(e_prev)), e_1415=b(pct(e_1415), cls(e_1415)),
    e_1718=b(pct(e_1718), cls(e_1718)), e_ex_1415=b(pct(e_ex_1415), cls(e_ex_1415)),
    e_ex_1718=pct(e_ex_1718), e_ex_1718_cls=cls(e_ex_1718), e_1415_plain=pct(e_1415), e_1415_cls=cls(e_1415),
    e_prev_plain=pct(e_prev), e_prev_cls=cls(e_prev), e_1718_plain=pct(e_1718), e_ex_1415_plain=pct(e_ex_1415),
    vaerkorr=fmt(cur['vaerkorr']), gl26=fmt(gl[2026], 0), gl_ref=fmt(gl_ref, 0),
    okt_mwh=fmt(o26['okt_mwh']), okt_kwh=fmt(o26['okt_kwh_dogn'], 0), okt_fjor=b(pct(okt_fjor), cls(okt_fjor)),
    okt_snitt=b(pct(okt_vs_snitt), cls(okt_vs_snitt)), okt_lavere=okt_lavere,
    okt_temp=fmt(o26['okt_temp']), okt_temp25=fmt(o25['okt_temp']),
    sl14=fmt(sl[2014], 0), sl17=fmt(sl[2017], 0), sl18=fmt(sl[2018], 0),
    om1415=fmt(r1415['Total']), om1516=fmt(om['2015/16']['Total']), om1617=fmt(om['2016/17']['Total']),
    om1718=fmt(r1718['Total']), om2223=fmt(om['2022/23']['Total']),
    vent2223=fmt(om['2022/23']['Vent']), vent2425=fmt(om['2024/25']['Vent']),
    jan16=fmt(m('2015/16', 'Jan', 'Total')), jan15=fmt(m('2014/15', 'Jan', 'Total')),
    vsep22=fmt(m('2022/23', 'Sep', 'Vent')), vsep23=fmt(m('2023/24', 'Sep', 'Vent')),
    rmai26=fmt(m('2025/26', 'Mai', 'Rest')), rmai25=fmt(m('2024/25', 'Mai', 'Rest')),
    rsep26=fmt(m('2026/27', 'Sep', 'Rest')), rsep25=fmt(m('2025/26', 'Sep', 'Rest')),
    tokt26=fmt(m('2026/27', 'Okt', 'Total')), tokt25=fmt(m('2025/26', 'Okt', 'Total')),
)

# ---- Autumn: same dates (1 Oct - 22 Nov) every year ----
ho = {r['aar']: r for r in hoest}
h26, h25, h14 = ho[2026], ho[2025], ho[2014]
h_hist = [ho[y] for y in range(2014, 2026)]
h_snitt = statistics.mean(r['kwh_dogn'] for r in h_hist)
h_tsnitt = statistics.mean(r['temp'] for r in h_hist)
h_vs_snitt, h_vs_fjor, h_vs_14 = chg(h26['kwh_dogn'], h_snitt), chg(h26['kwh_dogn'], h25['kwh_dogn']), chg(h26['kwh_dogn'], h14['kwh_dogn'])
assert sum(1 for r in h_hist if r['kwh_dogn'] < h26['kwh_dogn']) == 0, 'text says no earlier autumn was lower'
if h26['temp'] < h_tsnitt - 0.2:
    h_temp_text = f'Det var dessuten litt kaldere enn vanlig ({fmt(h26["temp"])} °C mot {fmt(h_tsnitt)} °C i snitt), så været forklarer ikke nedgangen.'
elif h26['temp'] > h_tsnitt + 0.2:
    h_temp_text = f'Det var litt mildere enn vanlig ({fmt(h26["temp"])} °C mot {fmt(h_tsnitt)} °C i snitt), men været betyr lite for totalen.'
else:
    h_temp_text = f'Temperaturen var omtrent som vanlig ({fmt(h26["temp"])} °C).'


def hrow(label, key):
    a, b = ho[2026][key], ho[2025][key]
    sn = statistics.mean(r[key] for r in h_hist)
    c = chg(a, sn)
    return (f'<tr><td>{label}</td><td>{fmt(a, 0)}</td><td>{fmt(b, 0)}</td><td>{fmt(sn, 0)}</td>'
            f'<td class="{cls(c)}">{pct(c)}</td></tr>')


h_rows = '\n'.join([hrow('Oktober (kWh/døgn)', 'okt_kwh'), hrow('1.–22. november (kWh/døgn)', 'nov22_kwh'),
                     hrow('1. oktober–22. november (kWh/døgn)', 'kwh_dogn')])

# ---- Since 2015 ----
jm = {}
for y in range(2014, 2027):
    s_ = f'{y - 1}/{str(y)[2:]}'
    jm[y] = sum(m(s_, mon, 'Total') for mon in ('Jan', 'Feb', 'Mar', 'Apr', 'Mai'))
jm_pre = (jm[2014] + jm[2015]) / 2
covid = {'2019/20', '2020/21'}
spart = {r['sesong']: r1415['Total'] - r['Total'] for r in okt_mai if r['sesong'] != '2014/15'}
cum = sum(v for k, v in spart.items() if k not in covid)
PRIS = 1.5928  # kr/kWh eks. mva.: spot 146,90 + energiledd 5,00 + elavgift 7,13 + nettleiehåndtering 0,25 øre (faktura okt. 2026)
spart_naa = spart['2025/26']
verdi = spart_naa * 1000 * PRIS
vk_chg = chg(cur['vaerkorr'], r1415['vaerkorr'])
winters = cum / cur['Total']
cum_winters = 'nesten tre' if 2.5 <= winters < 3 else fmt(winters, 1)
ctx.update(
    h_kwh=fmt(h26['kwh_dogn'], 0), h_mwh=fmt(h26['mwh']), h_snitt=fmt(h_snitt, 0), h25=fmt(h25['kwh_dogn'], 0),
    h_vs_snitt=b(pct(h_vs_snitt), cls(h_vs_snitt)), h_vs_fjor=b(pct(h_vs_fjor), cls(h_vs_fjor)), h_vs_14=b(pct(h_vs_14), cls(h_vs_14)),
    h_vs_snitt_plain=pct(h_vs_snitt), h_vs_snitt_cls=cls(h_vs_snitt), h_vs_fjor_plain=pct(h_vs_fjor), h_vs_fjor_cls=cls(h_vs_fjor),
    h20=fmt(ho[2020]['kwh_dogn'], 0), h_vs_14_plain=pct(h_vs_14), h_vs_14_cls=cls(h_vs_14), h_temp_text=h_temp_text, h_rows=h_rows,
    jm_pre=fmt(jm_pre), jm26=fmt(jm[2026]), jm_chg=b(pct(chg(jm[2026], jm_pre)), cls(chg(jm[2026], jm_pre))),
    cum=fmt(round(cum, -1), 0), cum_winters=cum_winters, spart_naa=fmt(spart_naa, 0), pris=fmt(PRIS, 2),
    verdi=fmt(round(verdi, -4), 0), verdi_mva=fmt(round(verdi * 1.25, -4), 0), vk_chg=pct(vk_chg), vk_cls=cls(vk_chg),
)

# ---- Energy-crisis winter 2022/23 vs 2025/26 ----
ek_a = om['2022/23']
ek_mwh = cur['Total'] - ek_a['Total']
ek_parts = [('Ny del + Resterende', (cur['NyDel'] + cur['Rest']) - (ek_a['NyDel'] + ek_a['Rest'])),
            ('Ventilasjon', cur['Vent'] - ek_a['Vent']), ('Kompressorer', cur['Komp'] - ek_a['Komp']),
            ('Avfukter', cur['Avf'] - ek_a['Avf'])]
assert abs(sum(v for _, v in ek_parts) - ek_mwh) < 0.5, 'meters must add up to the total'
energikrise = [dict(navn=n, mwh=round(v, 1), kr=round(v * 1000 * PRIS, -2)) for n, v in sorted(ek_parts, key=lambda t: -t[1])]
energikrise.append(dict(navn='Totalt', mwh=round(ek_mwh, 1), kr=round(ek_mwh * 1000 * PRIS, -2), total=True))
ek_kr = ek_mwh * 1000 * PRIS
ek_vk = cur['vaerkorr'] - ek_a['vaerkorr']
ek_c = chg(ek_a['Total'], cur['Total'])
ctx.update(ek_mwh=fmt(ek_mwh), ek_pct=b(pct(ek_c), cls(ek_c)), ek_pct_plain=pct(ek_c),
           ek_kr=fmt(round(ek_kr, -4), 0), ek_kr_mva=fmt(round(ek_kr * 1.25, -4), 0),
           ek_vk_mwh=fmt(ek_vk), ek_vk_kr=fmt(round(ek_vk * 1000 * PRIS, -4), 0),
           ek_ant=fmt(cur['antennevekst'] - ek_a['antennevekst'], 0))

if has_nov:
    nov_para = (f'<p>November 2026 så langt ({o26["nov_dager"]} dager): {b(fmt(o26["nov_kwh_dogn"], 0))} kWh i døgnet, '
                f'{b(pct(nov_fjor), cls(nov_fjor))} mot november 2025 og {b(pct(nov_vs_snitt), cls(nov_vs_snitt))} mot snittet for 2014–2025, '
                f'selv om det har vært kaldere: {fmt(o26["nov_temp"])} °C mot {fmt(o25["nov_temp"])} °C i fjor. '
                f'Starten av november er ofte mildere enn resten av måneden, så tallet kan stige.</p>')
else:
    nov_para = '<p class="muted">November 2026 er ikke med ennå.</p>'
ctx['nov_para'] = nov_para

vt_rows = '\n'.join(
    f'<tr><td>{r["forhold"]}</td><td>{r["uker"]}</td><td>{("+" if r["effekt_kwh"] > 0 else "")}{fmt(r["effekt_kwh"], 0)}</td>'
    f'<td>±{fmt(r["usikkerhet_kwh"], 0)}</td><td>{r["konklusjon"]}</td></tr>' for r in vaertest)
ctx['vt_rows'] = vt_rows

data = dict(okt_mai=okt_mai, maaned=maaned, uker=uker, temperatur=temperatur, grunnlast=grunnlast,
            sommerlast=sommerlast, okt_nov=okt_nov, hoest=hoest, energikrise=energikrise, antenne=300)
ctx['data_json'] = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
ctx['d3'] = open(os.path.join(HERE, 'vendor', 'd3.min.js')).read()
ctx['app_js'] = open(os.path.join(HERE, 'app.js')).read()

tpl = open(os.path.join(HERE, 'template.html')).read()
late = ('data_json', 'd3', 'app_js')
for k, v in ctx.items():
    if k not in late:
        tpl = tpl.replace('{{' + k + '}}', str(v))
left = [p for p in tpl.split('{{')[1:] if p.split('}}')[0] not in late]
assert not left, left[:2]
for k in late:
    tpl = tpl.replace('{{' + k + '}}', ctx[k].replace('</script', '<\\/script'))
open(os.path.join(SITE, 'index.html'), 'w').write(tpl)
print('ok', os.path.getsize(os.path.join(SITE, 'index.html')))
