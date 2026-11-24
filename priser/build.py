"""Bygger strømprissiden til site/priser/index.html.

Kjør fra repo-roten:  python3 priser/build.py
Årsoversikten leses fra priser/data/timeprofil.json (timesnitt per måned for NO1).
Dagens og morgendagens priser hentes av siden selv fra /api/priser (netlify/functions/priser.mts).
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT_DIR = os.path.join(ROOT, 'site', 'priser')
os.makedirs(OUT_DIR, exist_ok=True)

D = json.load(open(os.path.join(HERE, 'data', 'timeprofil.json')))
MINUS = '−'


def fmt(v, dec=0):
    s = f'{abs(v):,.{dec}f}'.replace(',', ' ').replace('.', ',').replace(' ', ' ')
    return (MINUS if v < 0 else '') + s


def hh(h):
    return f'{h % 24:02d}'


def window(vals, length, best):
    """Start hour of the `length`-hour window with the highest (best=max) or lowest average."""
    avgs = [(sum(vals[i:i + length]) / length, i) for i in range(0, len(vals) - length + 1)]
    return (max if best == 'max' else min)(avgs)


def span(i, length):
    return f'kl. {hh(i)}–{hh(i + length)}'


alle, vin, som, hv, hg = D['alle'], D['vinter'], D['sommer'], D['hverdag'], D['helg']
dyr = window(alle, 3, 'max')
bil_dag = window(alle[8:18], 3, 'min')
bil_natt = window(alle[0:7], 3, 'min')
periode = D['periode'].split('/')
p0 = '.'.join(reversed(periode[0].split('-')))
p1 = '.'.join(reversed(periode[1].split('-')))

aar_lede = (f'Det siste året ({p0}–{p1}) var strømmen i snitt dyrest {span(dyr[1], 3)} ({fmt(dyr[0])} øre/kWh) '
            f'og billigst midt på dagen {span(bil_dag[1] + 8, 3)} ({fmt(bil_dag[0])} øre) og om natten {span(bil_natt[1], 3)} ({fmt(bil_natt[0])} øre). '
            f'Forskjellen mellom døgnets dyreste og billigste time var i snitt {fmt(D["snitt_spenn"])} øre/kWh. '
            'Mønsteret skifter med årstiden, se varmekartet.')

v_morgen = max(range(6, 12), key=lambda h: vin[h])
v_kveld = max(range(14, 22), key=lambda h: vin[h])
v_bil = min(range(24), key=lambda h: vin[h])
s_dyr = max(range(24), key=lambda h: som[h])
s_bil = min(range(24), key=lambda h: som[h])
helg_morgen = sum(hg[7:10]) / 3
hv_morgen = sum(hv[7:10]) / 3
profil_lede = (f'Om vinteren har prisen to topper: om morgenen rundt kl. {hh(v_morgen)} og på ettermiddagen rundt kl. {hh(v_kveld)}, '
               f'og den er billigst om natten (kl. {hh(v_bil)}). Om sommeren gjør solkraft midt på dagen strømmen billigst rundt kl. {hh(s_bil)}, '
               f'mens kvelden rundt kl. {hh(s_dyr)} er dyrest. I helgene forsvinner morgentoppen: kl. 07–10 kostet strømmen i snitt '
               f'{fmt(helg_morgen)} øre i helgene mot {fmt(hv_morgen)} øre på hverdager.')

dt, bt = D['dyrest_teller'], D['billigst_teller']
top_dyr = sorted(range(24), key=lambda h: -dt[h])[:3]
top_bil = sorted(range(24), key=lambda h: -bt[h])[:3]
kveld = sum(dt[h] for h in range(16, 22))
teller_lede = (f'Av {D["dager"]} dager var timen {", ".join("kl. " + hh(h) for h in sorted(top_dyr))} oftest døgnets dyreste, '
               f'og kl. 16–22 sto for {kveld} av dem ({fmt(100 * kveld / D["dager"])} %). '
               f'Billigst var det oftest {", ".join("kl. " + hh(h) for h in sorted(top_bil))}.')
hall_tekst = ('Isen tåler å bli kjølt litt ekstra noen timer før de dyre ettermiddags- og kveldstimene og å gå roligere i dem. '
              'De samme ettermiddagstimene er ofte når månedens effekttopp oppstår, så forkjøling tidlig på dagen kan også senke effektleddet i nettleien – '
              'så lenge forkjølingen ikke selv lager en ny topp. Forslaget under «I dag og i morgen» regner ut dette for hver dag.')

nov = {m['mnd']: m['dager'] for m in D['maaned']}

tpl = open(os.path.join(HERE, 'template.html')).read()
report_tpl = open(os.path.join(ROOT, 'rapport', 'template.html')).read()
base_css = re.search(r'<style>\n(.*?)</style>', report_tpl, re.S).group(1)
ctx = {
    'aar_lede': aar_lede, 'profil_lede': profil_lede, 'teller_lede': teller_lede, 'hall_tekst': hall_tekst,
    'dager': str(D['dager']), 'periode': f'{p0}–{p1}', 'nov25': str(nov.get(periode[0][:7], 0)), 'nov26': str(nov.get(periode[1][:7], 0)),
}
for k, v in ctx.items():
    tpl = tpl.replace('{{' + k + '}}', v)
tpl = tpl.replace('{{base_css}}', base_css)
left = [p.split('}}')[0] for p in tpl.split('{{')[1:] if p.split('}}')[0] not in ('data_json', 'd3', 'app_js')]
assert not left, left
late = {
    'data_json': json.dumps(D, ensure_ascii=False, separators=(',', ':')),
    'd3': open(os.path.join(ROOT, 'rapport', 'vendor', 'd3.min.js')).read(),
    'app_js': open(os.path.join(HERE, 'app.js')).read(),
}
for k, v in late.items():
    tpl = tpl.replace('{{' + k + '}}', v.replace('</script', '<\\/script'))
open(os.path.join(OUT_DIR, 'index.html'), 'w').write(tpl)
print('ok', os.path.getsize(os.path.join(OUT_DIR, 'index.html')))
print(aar_lede)
print(profil_lede)
print(teller_lede)
