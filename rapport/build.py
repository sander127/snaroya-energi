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
            sommerlast=sommerlast, okt_nov=okt_nov, antenne=300)
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
