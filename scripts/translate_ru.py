#!/usr/bin/env python3
"""Translate visible Deathwatch UI and compendium text to Russian during CI build."""
import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
RU = ROOT / "lang" / "ru.json"
USER_FIELDS = {"name","description","text","label","title","hint","caption","summary","flavour","flavor","notes","descriptor","effect","content","tooltip","placeholder","message"}
PROTECTED = re.compile(r'(<[^>]*>|{{!--.*?--}}|{{.*?}}|\$\{.*?\}|&(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]+);)', re.S)
SCRIPT_STYLE = re.compile(r'(<(?:script|style)\b[^>]*>.*?</(?:script|style)\s*>)', re.I|re.S)
HTML_COMMENTS = re.compile(r'<!--.*?-->', re.S)
ATTR = re.compile(r'(?P<prefix>\b(?:title|placeholder|aria-label|alt|data-tooltip|data-label|aria-description)\s*=\s*)(?P<q>["\'])(?P<value>.*?)(?P=q)', re.I|re.S)
JS_KEYS = "label|title|content|hint|placeholder|tooltip|caption|message|description|confirm|cancel|ok|yes|no|footer|header|text|buttonText|emptyLabel|confirmText|cancelText|successMessage|errorMessage|infoMessage|dialogTitle|dialogContent|windowTitle|notification|helpText|submitLabel"
JS_DQ = re.compile(r'(\b(?:'+JS_KEYS+r')\s*:\s*)"((?:\\.|[^"\\])*)"', re.S)
JS_SQ = re.compile(r"(\b(?:"+JS_KEYS+r")\s*:\s*)'((?:\\.|[^'\\])*)'", re.S)
JS_ASSIGN = re.compile(r'(\b(?:innerHTML|textContent|innerText|placeholder|ariaLabel|title|tooltip)\s*=\s*)"((?:\\.|[^"\\])*)"', re.S)
JS_NOTIFY = re.compile(r'((?:ui\.notifications|Notifications)\.(?:info|warn|error|success)\s*\(\s*)"((?:\\.|[^"\\])*)"')
TICK = chr(96)
JS_TICK_PROP = re.compile(r'(\\b(?:content|template|html|message|description|label|title)\\s*:\\s*)' + TICK + r'(.*?)' + TICK, re.S)
JS_TICK_ASSIGN = re.compile(r'(\\b(?:innerHTML|textContent|innerText)\\s*=\\s*)' + TICK + r'(.*?)' + TICK, re.S)
CONFIG_OBJ = re.compile(r'(DWConfig\.[A-Za-z0-9_]+\s*=\s*\{.*?^\s*\};)', re.S|re.M)
CONFIG_DQ = re.compile(r'(:\s*)"((?:\\.|[^"\\])*)"')
CONFIG_SQ = re.compile(r"(:\s*)'((?:\\.|[^'\\])*)'")

MANUAL = {
    "Security":"Безопасность","Shadowing":"Слежка","Sleight of Hand":"Ловкость рук",
    "Speak Language - Eldar":"Знание языка: эльдарский","Speak Language - Hight Gothic":"Знание языка: высокий готик",
    "Speak Language - Kroot":"Знание языка: круут","Speak Language - Low Gothic":"Знание языка: низкий готик",
    "Speak Language - Ork":"Знание языка: орочий","Speak Language - Techna-Lingua":"Знание языка: техно-лингва",
    "Speak Language - Tau":"Знание языка: тау","Navigation - Surface":"Навигация: поверхность",
    "Navigation - Stellar":"Навигация: звёздная навигация","Performer - Dancer":"Исполнительство: танец",
    "Performer - Musician":"Исполнительство: музыка","Performer - Singer":"Исполнительство: пение",
    "Performer - Storyteller":"Исполнительство: рассказывание историй","Pilot - Personal":"Пилотирование: личный транспорт",
    "Pilot - Flyer":"Пилотирование: летательные аппараты","Pilot - Space Craft":"Пилотирование: космические корабли",
    "Tactics - Air Combat":"Тактика: воздушный бой","Tactics - Armoured":"Тактика: бронетехника",
    "Tactics - Assault Doctrine":"Тактика: штурмовая доктрина","Tactics - Defensive Doctrine":"Тактика: оборонительная доктрина",
    "Tactics - Orbital Drop":"Тактика: орбитальное десантирование","Tactics - Recon and Stealth":"Тактика: разведка и скрытность",
    "Trade - Archaeologist":"Ремесло: археология","Trade - Armourer":"Ремесло: оружейное дело","Trade - Astrographer":"Ремесло: астрография",
    "Cipher - Inquisition":"Шифры: Инквизиция","Lore: Forbidden - Archeotech":"Запретные знания: археотех",
    "Lore: Forbidden - The Black Library":"Запретные знания: Чёрная библиотека","Lore: Forbidden - Daemonology":"Запретные знания: демонология",
    "Lore: Forbidden - Heresy":"Запретные знания: ересь","Lore: Forbidden - The Inquisition":"Запретные знания: Инквизиция",
    "Lore: Forbidden - Mutants":"Запретные знания: мутанты","Lore: Forbidden - Psykers":"Запретные знания: псайкеры",
    "Lore: Forbidden - The Traitor Legions":"Запретные знания: легионы-предатели","Lore: Forbidden - The Warp":"Запретные знания: Варп",
    "Lore: Forbidden - Xenos":"Запретные знания: ксеносы","Lore: Scholastic - Archaic":"Академические знания: древности",
    "Lore: Scholastic - Astromancy":"Академические знания: астромантия","Lore: Scholastic - Beasts":"Академические знания: звери",
    "Lore: Scholastic - Bureaucracy":"Академические знания: бюрократия","Lore: Scholastic - Chymistry":"Академические знания: алхимия",
    "Lore: Scholastic - Codex Astartes":"Академические знания: Кодекс Астартес","Lore: Scholastic - Cryptology":"Академические знания: криптология",
    "Lore: Scholastic - Heraldry":"Академические знания: геральдика","Lore: Scholastic - Judgement":"Академические знания: правосудие",
    "Lore: Scholastic - Legend":"Академические знания: легенды","Lore: Scholastic - Numerology":"Академические знания: нумерология",
    "Lore: Scholastic - Occult":"Академические знания: оккультизм","Lore: Scholastic - Philosophy":"Академические знания: философия",
    "Lore: Scholastic - Tactica Imperialis":"Академические знания: Имперская тактика",
    "Profile":"Профиль","Chapter":"Орден","Specialty":"Специализация","Rank":"Звание",
    "Attributes":"Характеристики","Abilities":"Способности","Gear":"Снаряжение","Augmentations":"Аугментации",
    "Psychic Powers":"Психические силы","Character":"Персонаж","Effects":"Эффекты",
    "Basic Skills":"Основные навыки","Advanced Skills":"Продвинутые навыки","Name":"Имя",
    "Remove Chapter":"Убрать орден","Remove Specialty":"Убрать специализацию",
    "Drop Chapter Here":"Перетащите сюда орден","Drop Specialty Here":"Перетащите сюда специализацию",
    "Damage Type":"Тип урона","Damage":"Урон","Description":"Описание","Modifiers":"Модификаторы","Source":"Источник",
    "Weapons":"Оружие","Armor":"Броня","Ammunition":"Боеприпасы","Talents":"Таланты","Traits":"Особенности",
    "Critical Effects":"Критические эффекты","Save":"Сохранить","Cancel":"Отмена","Close":"Закрыть","Delete":"Удалить",
    "Edit":"Изменить","Create":"Создать","Search":"Поиск","Settings":"Настройки","Yes":"Да","No":"Нет",
}
FOLDERS = {
    "Imperial":"Империум","Ork":"Орки","Tau":"Тау","Tyranid":"Тираниды","Melee":"Ближний бой",
    "Energy":"Энергетический","Explosive":"Взрывной","Impact":"Ударный","Rending":"Режущий",
    "Arm":"Рука","Body":"Тело","Head":"Голова","Leg":"Нога","Human":"Люди","Chaos":"Хаос",
    "Ammunition":"Боеприпасы","Armor":"Броня","Battle Traumas":"Боевые травмы","Chapters":"Орденские главы",
    "Critical Effects":"Критические эффекты","Cybernetics":"Кибернетика","Demeanours":"Черты характера",
    "Enemies":"Противники","Gear":"Снаряжение","Implants":"Импланты","Macros":"Макросы",
    "Psychic Powers":"Психические силы","Specialties":"Специализации","Talents":"Таланты","Traits":"Особенности",
    "Weapon Qualities":"Качества оружия","Weapon Upgrades":"Улучшения оружия","Weapons":"Оружие"
}
existing = {}
if RU.exists():
    try: existing = json.loads(RU.read_text(encoding="utf-8"))
    except Exception: pass
GLOSSARY = {**existing, **MANUAL}

def eligible(s):
    t = s.strip()
    if not t or not re.search(r"[A-Za-z]", t): return False
    if re.fullmatch(r"[A-Z0-9_ -]{1,5}", t): return False
    if t.startswith(("http://","https://","systems/","icons/","@UUID","@Compendium")): return False
    if re.fullmatch(r"[a-zA-Z0-9_./-]+\.m?js", t): return False
    return True

def plain_parts(s):
    return [p.strip() for p in PROTECTED.split(s) if p and not PROTECTED.fullmatch(p) and eligible(p)]

def add(s, store):
    store.update(plain_parts(s))

class MT:
    def __init__(self): self.cache = dict(GLOSSARY); self.count = 0; self.fail = 0
    def batch(self, texts):
        sep = "ZXQSEP98371QXZ"
        q = "\n" + ("\n"+sep+"\n").join(texts) + "\n"
        url = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode({"client":"gtx","sl":"en","tl":"ru","dt":"t","q":q})
        req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r: data = json.loads(r.read().decode("utf-8"))
        rendered = "".join(x[0] for x in data[0] if isinstance(x,list) and x and isinstance(x[0],str))
        parts = rendered.split(sep)
        if len(parts) != len(texts): raise RuntimeError("Translation separator not preserved")
        return {a:b.strip() or a for a,b in zip(texts,parts)}
    def prepare(self, phrases):
        pending = sorted(x for x in phrases if x not in self.cache and eligible(x))
        batches=[]; batch=[]; size=0
        for text in pending:
            if batch and (len(batch)>=10 or size+len(text)>1400):
                batches.append(batch); batch=[]; size=0
            batch.append(text); size += len(text)
        if batch: batches.append(batch)
        for i,b in enumerate(batches,1):
            result=None
            for attempt in range(3):
                try: result=self.batch(b); break
                except Exception as e:
                    if attempt<2: time.sleep(1.3*(attempt+1))
                    else: print("[WARN] batch failed, fallback to single phrases:", e)
            if result is None:
                result={}
                for text in b:
                    try: result.update(self.batch([text]))
                    except Exception as e:
                        self.fail += 1; result[text]=text; print("[WARN] skipped:", text[:90], e)
                    time.sleep(.15)
            for a,bv in result.items():
                self.cache[a]=bv
                if a != bv: self.count+=1
            if i%10==0 or i==len(batches): print(f"[TRANSLATE] {i}/{len(batches)} batches, {self.count} phrases translated")
            time.sleep(.12)
    def simple(self,s):
        if not isinstance(s,str) or not eligible(s): return s
        lead=s[:len(s)-len(s.lstrip())]; trail=s[len(s.rstrip()):]; core=s.strip()
        return lead+self.cache.get(core,core)+trail
    def rich(self,s):
        if not isinstance(s,str): return s
        return "".join(p if not p or PROTECTED.fullmatch(p) else self.simple(p) for p in PROTECTED.split(s))

translator=MT(); phrases=set()

# Collect natural language in all pack-source JSON and display-data JSON.
for p in ROOT.rglob("*.json"):
    rel=p.relative_to(ROOT).as_posix()
    if rel in {"system.json","lang/ru.json"} or rel.startswith("node_modules/"): continue
    try: obj=json.loads(p.read_text(encoding="utf-8"))
    except Exception: continue
    def scan(x):
        if isinstance(x,dict):
            for k,v in x.items():
                if isinstance(v,str) and k.lower() in USER_FIELDS: add(v,phrases)
                elif isinstance(v,str) and k.lower()=="descriptor": add(v,phrases)
                else: scan(v)
        elif isinstance(x,list):
            for v in x: scan(v)
    scan(obj)

html_files=list(ROOT.rglob("*.html"))
for p in html_files:
    raw=HTML_COMMENTS.sub("",p.read_text(encoding="utf-8"))
    for region in SCRIPT_STYLE.split(raw):
        if not region or SCRIPT_STYLE.fullmatch(region): continue
        for _,_,value in ATTR.findall(region): add(value,phrases)
        for piece in PROTECTED.split(region):
            if piece and not PROTECTED.fullmatch(piece): add(piece,phrases)

js_files=list(ROOT.rglob("*.mjs"))+list(ROOT.rglob("*.js"))
for p in js_files:
    raw=p.read_text(encoding="utf-8")
    for block in CONFIG_OBJ.findall(raw):
        for rx in (CONFIG_DQ,CONFIG_SQ):
            for m in rx.finditer(block): add(m.group(2),phrases)
    for rx in (JS_DQ,JS_SQ,JS_ASSIGN,JS_NOTIFY):
        for m in rx.finditer(raw):
            val=m.group(2)
            if chr(36)+"{" not in val and "{{" not in val: add(val,phrases)
    for rx in (JS_TICK_PROP, JS_TICK_ASSIGN):
        for m in rx.finditer(raw):
            add(m.group(2), phrases)

folder_labels = set()
pack_source = ROOT / "packs-source"
if pack_source.exists():
    for folder in pack_source.rglob("*"):
        if folder.is_dir() and not folder.name.startswith("_"):
            label = " ".join(word[:1].upper() + word[1:] for word in folder.name.split("-"))
            folder_labels.add(label)
            add(label, phrases)

print(f"[SCAN] {len(phrases)} unique English phrases found.")
translator.prepare(phrases)

def translate_json(x):
    if isinstance(x,dict):
        out={}
        for k,v in x.items():
            if isinstance(v,str) and k.lower() in USER_FIELDS: out[k]=translator.rich(v)
            elif isinstance(v,str) and k.lower()=="descriptor": out[k]=translator.simple(v)
            else: out[k]=translate_json(v)
        return out
    if isinstance(x,list): return [translate_json(v) for v in x]
    return x

for p in ROOT.rglob("*.json"):
    rel=p.relative_to(ROOT).as_posix()
    if rel in {"system.json","lang/ru.json"} or rel.startswith("node_modules/"): continue
    try: obj=json.loads(p.read_text(encoding="utf-8"))
    except Exception: continue
    p.write_text(json.dumps(translate_json(obj),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

def translate_html(raw):
    def attr_sub(m):
        return m.group("prefix")+m.group("q")+translator.rich(m.group("value"))+m.group("q")
    def region_sub(region):
        region=ATTR.sub(attr_sub,region)
        return "".join(piece if not piece or PROTECTED.fullmatch(piece) else translator.simple(piece) for piece in PROTECTED.split(region))
    return "".join(x if not x or SCRIPT_STYLE.fullmatch(x) else region_sub(x) for x in SCRIPT_STYLE.split(raw))

for p in html_files:
    p.write_text(translate_html(p.read_text(encoding="utf-8")),encoding="utf-8")

def config_sub(m):
    block=m.group(1)
    for rx in (CONFIG_DQ,CONFIG_SQ):
        block=rx.sub(lambda x:x.group(1)+x.group(2)+translator.simple(x.group(2))+x.group(3),block)
    return block

def js_sub(p, raw):
    raw=CONFIG_OBJ.sub(config_sub,raw)
    def dq(m): return m.group(1)+'"'+translator.rich(m.group(2))+'"'
    def sq(m): return m.group(1)+"'"+translator.rich(m.group(2))+"'"
    raw=JS_DQ.sub(dq,raw)
    raw=JS_SQ.sub(sq,raw)
    raw=JS_ASSIGN.sub(dq,raw)
    raw=JS_NOTIFY.sub(dq,raw)
    raw=JS_TICK_PROP.sub(lambda m:m.group(1)+TICK+translator.rich(m.group(2))+TICK,raw)
    raw=JS_TICK_ASSIGN.sub(lambda m:m.group(1)+TICK+translator.rich(m.group(2))+TICK,raw)
    return raw.replace("systems/deathwatch/","systems/deathwatch-ru/")

for p in js_files:
    p.write_text(js_sub(p,p.read_text(encoding="utf-8")),encoding="utf-8")

# Update the language dictionary with curated translations and translate missing direct localize keys.
if RU.exists():
    try: ru=json.loads(RU.read_text(encoding="utf-8"))
    except Exception: ru={}
    ru.update(MANUAL)
    localize_patterns=[re.compile(r'(?:game\.)?i18n\.localize\(\s*["\']([^"\']+)["\']\s*\)'),re.compile(r'{{localize\s+["\']([^"\']+)["\']')]
    for p in js_files+html_files:
        raw=p.read_text(encoding="utf-8")
        for pat in localize_patterns:
            for m in pat.finditer(raw):
                key=m.group(1)
                if key not in ru and " " in key and eligible(key): ru[key]=translator.cache.get(key,key)
    RU.write_text(json.dumps(ru,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

# Path references must resolve under the fork's ID.
for p in ROOT.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in {".html",".json",".mjs",".js",".css"}: continue
    try: raw=p.read_text(encoding="utf-8")
    except Exception: continue
    fixed=raw.replace("systems/deathwatch/","systems/deathwatch-ru/")
    if fixed != raw: p.write_text(fixed,encoding="utf-8")

# Upstream compiler generates pack folders in English; translate folder display labels and stats ID.
compiler=ROOT.parent/"builds"/"scripts"/"compilePacks.mjs"
if compiler.exists():
    src=compiler.read_text(encoding="utf-8")
    old="const folderName = item.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');"
    folder_translation = {label: FOLDERS.get(label, translator.cache.get(label, label)) for label in folder_labels}
    folder_translation.update(FOLDERS)
    folder_obj=json.dumps(folder_translation,ensure_ascii=False)
    new="const folderNameEn = item.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');\n            const folderName = ("+folder_obj+")[folderNameEn] || folderNameEn;"
    src=src.replace(old,new).replace("systemId: 'deathwatch'","systemId: 'deathwatch-ru'")
    compiler.write_text(src,encoding="utf-8")
print(f"[DONE] {translator.count} phrases translated. Fallback failures: {translator.fail}.")
print("[NOTICE] Machine-generated Warhammer terminology should be proofread; the build log records translation failures.")
