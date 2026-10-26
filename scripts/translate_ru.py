#!/usr/bin/env python3
"""Translate visible Deathwatch UI and compendium text to Russian during CI build."""
import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
RU = ROOT / "lang" / "ru.json"
USER_FIELDS = {"name","description","shortdescription","text","label","title","hint","caption","summary","flavour","flavor","notes","descriptor","content","tooltip","placeholder","message","book","detail","details","specialrules","prerequisites","prerequisite","benefit","requirement","requirements","requirementstext","rulesummary","resulttext","replacementlabel","cursename","cursedescription","curselevel1name","curselevel1description","curselevel2name","curselevel2description","curselevel3name","curselevel3description","fulltext","bodytext","specialdescription"}
PROTECTED = re.compile(r'(<!--.*?-->|<[^>]*>|{{!--.*?--}}|{{.*?}}|\$\{.*?\}|&(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]+);)', re.S)
SCRIPT_STYLE = re.compile(r'(<(?:script|style)\b[^>]*>.*?</(?:script|style)\s*>)', re.I|re.S)
HTML_COMMENTS = re.compile(r'<!--.*?-->', re.S)
ATTR = re.compile(r'(?P<prefix>\b(?:title|placeholder|aria-label|alt|data-tooltip|data-label|aria-description)\s*=\s*)(?P<q>["\'])(?P<value>.*?)(?P=q)', re.I|re.S)
JS_KEYS = "label|name|title|content|hint|placeholder|tooltip|caption|message|description|confirm|cancel|ok|yes|no|footer|header|text|buttonText|emptyLabel|confirmText|cancelText|successMessage|errorMessage|infoMessage|dialogTitle|dialogContent|windowTitle|notification|helpText|submitLabel"
JS_DQ = re.compile(r'(\b(?:'+JS_KEYS+r')\s*:\s*)"((?:\\.|[^"\\])*)"', re.S)
JS_SQ = re.compile(r"(\b(?:"+JS_KEYS+r")\s*:\s*)'((?:\\.|[^'\\])*)'", re.S)
JS_ASSIGN = re.compile(r'(\b(?:innerHTML|textContent|innerText|placeholder|ariaLabel|title|tooltip)\s*=\s*)"((?:\\.|[^"\\])*)"', re.S)
JS_ASSIGN_SQ = re.compile(r"(\b(?:innerHTML|textContent|innerText|placeholder|ariaLabel|title|tooltip)\s*=\s*)'((?:\\.|[^'\\])*)'", re.S)
JS_NOTIFY = re.compile(r'((?:ui\.notifications|Notifications)\.(?:info|warn|error|success)\s*\(\s*)"((?:\\.|[^"\\])*)"')
JS_NOTIFY_SQ = re.compile(r"((?:ui\.notifications|Notifications)\.(?:info|warn|error|success)\s*\(\s*)'((?:\\.|[^'\\])*)'")
JS_SETATTR_DQ = re.compile(r'((?:\.setAttribute\s*\(\s*)["\'](?:title|placeholder|aria-label|alt|data-tooltip)["\']\s*,\s*)"((?:\\.|[^"\\])*)"', re.I)
JS_SETATTR_SQ = re.compile(r"((?:\.setAttribute\s*\(\s*)[\"'](?:title|placeholder|aria-label|alt|data-tooltip)[\"']\s*,\s*)'((?:\\.|[^'\\])*)'", re.I)
JS_ENUM_VALUE_RE = re.compile(r'\b(effectType|valueAffected|damageType|dmgType|location|resistDifficulty|modeRequirement|abilityCategory|abilityType)\s*:\s*["\']([^"\']+)["\']')
TICK = chr(96)
ALL_TICK = re.compile(TICK + r'(.*?)' + TICK, re.S)
JS_HTML_DQ = re.compile(r'(?P<q>")(?P<value>(?:\\.|[^"\\])*?<[/!]?[A-Za-z][^>]*>(?:\\.|[^"\\])*)(?P=q)', re.S)
JS_HTML_SQ = re.compile(r"(?P<q>')(?P<value>(?:\\.|[^'\\])*?<[/!]?[A-Za-z][^>]*>(?:\\.|[^'\\])*)(?P=q)", re.S)
JS_TEXT_VAR_DQ = re.compile(r'(\b(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:label|title|message|flavor|description|summary|notification|tooltip|dialogcontent|chatcontent|content|html|header|footer)\s*=\s*)"((?:\\.|[^"\\])*)"', re.S|re.I)
JS_TEXT_VAR_SQ = re.compile(r"(\b(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:label|title|message|flavor|description|summary|notification|tooltip|dialogcontent|chatcontent|content|html|header|footer)\s*=\s*)'((?:\\.|[^'\\])*)'", re.S|re.I)
JS_TEXT_CALL_DQ = re.compile(r'(\b[A-Za-z_$][\w$]*(?:build|create|make|format|show|render|display)[A-Za-z_$]*(?:Flavor|Message|Content|Dialog|Label|Title)\s*\(\s*)"((?:\\.|[^"\\])*)"', re.S|re.I)
JS_TEXT_CALL_SQ = re.compile(r"(\b[A-Za-z_$][\w$]*(?:build|create|make|format|show|render|display)[A-Za-z_$]*(?:Flavor|Message|Content|Dialog|Label|Title)\s*\(\s*)'((?:\\.|[^'\\])*)'", re.S|re.I)
JS_TICK_PROP = re.compile(r'(\b(?:content|template|html|message|description|label|title)\s*:\s*)' + TICK + r'(.*?)' + TICK, re.S)
JS_TICK_ASSIGN = re.compile(r'(\b(?:innerHTML|textContent|innerText)\s*=\s*)' + TICK + r'(.*?)' + TICK, re.S)
JS_TICK_VAR = re.compile(r'(\b(?:const|let|var)\s+(?:content|message|html|flavor|description|label|title|summary|notification|dialogContent|tooltip|chatContent|chatHtml)\s*=\s*)' + TICK + r'(.*?)' + TICK, re.S)
CONFIG_OBJ = re.compile(r'(DWConfig\.[A-Za-z0-9_]+\s*=\s*\{.*?^\s*\};)', re.S|re.M)
CONFIG_DQ = re.compile(r'(:\s*)"((?:\\.|[^"\\])*)"')
CONFIG_SQ = re.compile(r"(:\s*)'((?:\\.|[^'\\])*)'")

MANUAL = {
    "Awareness":"Внимательность",
    "Carouse":"Кутёж",
    "Charm":"Обаяние",
    "Climb":"Лазание",
    "Concealment":"Маскировка",
    "Contortionist":"Гибкость",
    "Deceive":"Обман",
    "Dodge":"Уклонение",
    "Evaluate":"Оценка",
    "Gamble":"Азартные игры",
    "Inquiry":"Расспросы",
    "Intimidate":"Запугивание",
    "Logic":"Логика",
    "Scrutiny":"Проницательность",
    "Search":"Поиск",
    "Silent Move":"Бесшумное передвижение",
    "Swim":"Плавание",
    "Acrobatics":"Акробатика",
    "Athletics":"Атлетика",
    "Command":"Командование",
    "Chem-Use":"Использование химикатов",
    "Demolitions":"Подрывное дело",
    "Drive - Ground":"Вождение: наземный транспорт",
    "Drive - Hover/Skimmer":"Вождение: ховер-транспорт",
    "Drive - Walker":"Управление шагоходом",
    "Interrogation":"Допрос",
    "Invocation":"Призывание",
    "Lip Reading":"Чтение по губам",
    "Literacy":"Грамотность",
    "Medicae":"Медицина",
    "Psyniscience":"Псай-наука",
    "Survival":"Выживание",
    "Tech-Use":"Использование технологий",
    "Tracking":"Выслеживание",
    "Wrangling":"Обращение с животными",
    "Energy":"Энергетический",
    "Explosive":"Взрывной",
    "Impact":"Ударный",
    "Rending":"Режущий",
    "Trivial":"Тривиальная",
    "Elementary":"Элементарная",
    "Simple":"Простая",
    "Easy":"Лёгкая",
    "Routine":"Рутинная",
    "Ordinary":"Обычная",
    "Challenging":"Сложная",
    "Difficult":"Трудная",
    "Hard":"Тяжёлая",
    "Very Hard":"Очень тяжёлая",
    "Arduous":"Изнурительная",
    "Punishing":"Мучительная",
    "Hellish":"Адская",
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
    "Basic":"Основное оружие","Heavy":"Тяжёлое оружие","Pistol":"Пистолетное оружие","Melee":"Ближний бой","Thrown":"Метательное оружие",
    "Chapter":"Орден","Codex":"Кодекс","Divination":"Прорицание","Nurgle":"Нургл","Slaanesh":"Слаанеш",
    "Telekinesis":"Телекинез","Telepathy":"Телепатия","Tyranid":"Тираниды","Tzeentch":"Тзинч","Unaligned":"Без покровителя",
    "Single":"Одиночный выстрел","Semi-Auto":"Полуавтоматический огонь","Full-Auto":"Автоматический огонь",
    "Head":"Голова","Body":"Тело","Arm":"Рука","Left Arm":"Левая рука","Right Arm":"Правая рука",
    "Left Leg":"Левая нога","Right Leg":"Правая нога","Leg":"Нога","Location":"Место попадания","Range":"Дистанция",
    "Pen":"Пробитие","RoF":"Скорострельность","Clip":"Магазин","Ammo":"Боеприпасы","Qty":"Количество","Wt":"Вес","Req":"Требование",
    "None":"Нет","Off":"Выкл.","On":"Вкл.","Enabled":"Включено","Disabled":"Отключено",
    "Solo Mode":"Одиночный режим","Squad Mode":"Режим отряда","Attack Pattern":"Атака по схеме","Defensive Stance":"Оборонительная стойка",
    "Righteous Fury":"Праведная ярость","Perils of the Warp":"Опасности Варпа","Flame Attack":"Огненная атака",
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
MANUAL.update({"Deathwatch Core Rulebook":"Основная книга правил Deathwatch","Core Rulebook":"Основная книга правил","Profile":"Профиль","Health":"Здоровье","Fatigue":"Усталость","Wounds":"Раны"})
MANUAL.update({
    "Basic":"Основное оружие","Heavy":"Тяжёлое оружие","Pistol":"Пистолетное оружие",
    "Melee":"Ближний бой","Thrown":"Метательное оружие","Ranged":"Дальний бой",
    "Mounted":"Установленное","Chapter":"Орден","Codex":"Кодекс",
    "Divination":"Предсказание","Telepathy":"Телепатия","Telekinesis":"Телекинез",
    "Tzeentch":"Тзинч","Nurgle":"Нургл","Slaanesh":"Слаанеш","Unaligned":"Непокорённый",
    "Respected":"Уважаемый","Distinguished":"Почётный","Distinguised":"Почётный",
    "Disinguished":"Почётный","Famed":"Знаменитый","Hero":"Герой","Special":"Особое",
    "Head":"Голова","Body":"Тело","Arm":"Рука","Leg":"Нога",
    "Self":"На себя","None":"Нет","Yes":"Да","No":"Нет","Full":"Полное действие",
    "Half":"Половина действия","Free":"Свободное действие","Free Action":"Свободное действие",
    "Half Action":"Половина действия","Full Action":"Полное действие","Reaction":"Реакция",
    "reaction":"Реакция","free":"Свободное действие","half":"Половина действия","full":"Полное действие",
    "Half or Reaction":"Половина действия или реакция","2 Full":"2 полных действия","3 Full":"3 полных действия",
    "4 Full":"4 полных действия","5 Full":"5 полных действий","2Full":"2 полных действия",
    "Extended (2)":"Длительное (2)","Extended (3)":"Длительное (3)","Extended (5)":"Длительное (5)","Extended (10)":"Длительное (10)",
    "All":"Все","Black Templars":"Чёрные Храмовники","Blood Angels":"Кровавые Ангелы",
    "Dark Angels":"Тёмные Ангелы","Iron Hands":"Железные Руки","Novamarines":"Новомаринцы",
    "Raptors":"Рапторы","Space Wolves":"Космические Волки","Storm Wardens":"Стражи Бури",
    "Ultramarines":"Ультрамарины","Apothecary":"Апотекарий","Assault Marine":"Штурмовик",
    "Devastator Marine":"Девастатор","Librarian":"Библиарий","Tactical Marine":"Тактический десантник",
    "Techmarine":"Технодесантник","Chaplain":"Капеллан","Specialty Name":"Название специализации",
    "The Red Thirst":"Красная жажда","Black Rage":"Чёрная ярость",
    "Ranged":"Дальнобойное оружие","Mounted":"Установленное оружие","n/a":"Не применимо",
    "ws":"Ближний бой","bs":"Стрельба","str":"Сила","tg":"Стойкость","ag":"Ловкость",
    "int":"Интеллект","per":"Восприятие","wil":"Сила воли","fs":"Общительность","fel":"Общительность",
    "interaction":"Взаимодействие","solo":"Индивидуальный режим","squad":"Режим отряда",
    "chapter":"Орден","codex":"Кодекс","attack-pattern":"План атаки","defensive-stance":"Оборонительная стойка",
    "characteristic-bonus":"Бонус характеристики","skill":"Навык","characteristic":"Характеристика",
    "armor":"Броня","movement":"Перемещение","critical-damage":"Критический урон","weapon-damage":"Урон оружия",
    "psy-rating":"Рейтинг псайкера","movement-multiplier":"Множитель перемещения","weapon-blast":"Радиус взрыва",
    "weapon-penetration":"Пробитие оружия","weapon-damage-override":"Замена урона оружия","custom":"Особый",
    "behavior":"Поведение","characteristic-post-multiplier":"Множитель характеристики","magnitude-bonus-damage":"Бонус урона орды",
    "weapon-range":"Дальность оружия","initiative":"Инициатива","wounds":"Раны","weapon-rof":"Скорострельность оружия",
    "righteous-fury-threshold":"Порог Праведной ярости","ignores-natural-armour":"Игнорирует естественную броню",
    "characteristic-damage":"Урон характеристике","weapon-penetration-modifier":"Модификатор пробития оружия",
    "weapon-felling":"Поражение устойчивых целей","premature-detonation":"Преждевременная детонация",
    "weapon-devastating":"Опустошающее оружие","movement-restriction":"Ограничение перемещения",
    "modifier":"Модификатор","weapon-weight":"Вес оружия","challenging":"Сложная",
    "Solo Mode":"Индивидуальный режим","Squad Mode":"Режим отряда",
    "Characteristics":"Характеристики","Inventory":"Инвентарь","Combat":"Бой","Skills":"Навыки",
    "Ranged Weapons":"Стрелковое оружие","Melee Weapons":"Оружие ближнего боя","Grenades":"Гранаты",
    "Recalculate":"Пересчитать","Edit Cohesion":"Изменить сплочённость","Confirm":"Подтвердить","Roll":"Бросок"
})
GLOSSARY = {k: v for k, v in existing.items() if isinstance(v, str) and v.strip() and v.strip() != k.strip()}
GLOSSARY.update(MANUAL)

DISPLAY_VALUE_KEYS = {"range","reload","renown","dmgtype","damagetype","location","class","action","sustained","opposed","specialty","chapter","effecttype","valueaffected","type","resistdifficulty","moderequirement","abilitycategory","abilitytype","curselevel1target","curselevel2target","curselevel3target"}
TECHNICAL_KEYS = {
    "_id","id","_sourceid","sourceid","type","img","src","path","folder","folderid",
    "uuid","slug","key","systemid","compendiumid","formula","roll","expression","range",
    "reload","rof","availability","class","damagetype","dmgtype","location","action",
    "sustained","opposed","renown","specialty","chapter","valueaffected","effecttype",
    "flags","tag","page","value","base","max","min","modifier","rank","weight","cost",
    "price","units","coordinates","x","y","z","width","height","font","fontfamily",
    "size","opacity","tint","rotation","scale","sort","sortorder","pack","permission",
    "image","thumbnail","macrotype","source","kind","targetid","targettype"
}
display_values = set()

def likely_prose(value):
    if not isinstance(value, str):
        return False
    text = value.strip()
    if not eligible(text) or not re.search(r"\\s", text):
        return False
    if any(token in text for token in ("{{", "}}", "${", "@UUID", "@Compendium")):
        return False
    if re.fullmatch(r"[A-Za-z0-9_./\\-]+", text):
        return False
    words = re.findall(r"[A-Za-zА-Яа-яЁё]{2,}", text)
    return len(words) >= 2

if "--validate" in sys.argv:
    print("Localization script syntax and regular-expression patterns are valid.")
    sys.exit(0)

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
    # Text in attributes of embedded HTML (for example title and placeholder) is user-facing too.
    for match in ATTR.finditer(s):
        store.update(plain_parts(match.group("value")))

class MT:
    def __init__(self):
        self.cache = {}
        self.count = 0
        self.fail = 0
        self.cache_file = ROOT.parent / ".cache" / "translation-cache.json"
        if self.cache_file.exists():
            try:
                cached = json.loads(self.cache_file.read_text(encoding="utf-8"))
                if isinstance(cached, dict):
                    self.cache.update({k: v for k, v in cached.items() if isinstance(k, str) and isinstance(v, str)})
                print(f"[CACHE] Loaded {len(self.cache)} cached translations.")
            except Exception as exc:
                print(f"[CACHE] Could not read translation cache: {exc}")
        # Current curated glossary always wins over older machine-generated cache values.
        self.cache.update(GLOSSARY)
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
        def attr_sub(m):
            return m.group("prefix")+m.group("q")+self.rich(m.group("value"))+m.group("q")
        s=ATTR.sub(attr_sub,s)
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
                elif isinstance(v,str) and k.lower() in DISPLAY_VALUE_KEYS and eligible(v):
                    display_values.add(v.strip())
                    add(v,phrases)
                elif isinstance(v,str) and k.lower() not in TECHNICAL_KEYS and likely_prose(v):
                    # Catch readable fields with names that differ between compendium types.
                    add(v,phrases)
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
    for rx in (JS_DQ,JS_SQ,JS_ASSIGN,JS_ASSIGN_SQ,JS_NOTIFY,JS_NOTIFY_SQ,JS_SETATTR_DQ,JS_SETATTR_SQ):
        for m in rx.finditer(raw):
            val=m.group(2)
            if chr(36)+"{" not in val and "{{" not in val: add(val,phrases)
    for rx in (JS_TICK_PROP, JS_TICK_ASSIGN, JS_TICK_VAR, JS_TEXT_VAR_DQ, JS_TEXT_VAR_SQ, JS_TEXT_CALL_DQ, JS_TEXT_CALL_SQ):
        for m in rx.finditer(raw):
            add(m.group(2), phrases)
    for m in JS_ENUM_VALUE_RE.finditer(raw):
        display_values.add(m.group(2).strip())
        add(m.group(2), phrases)
    for m in ALL_TICK.finditer(raw):
        add(m.group(1), phrases)
    for rx in (JS_HTML_DQ, JS_HTML_SQ):
        for m in rx.finditer(raw):
            add(m.group("value"), phrases)

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
            elif isinstance(v,str) and k.lower() not in TECHNICAL_KEYS and likely_prose(v): out[k]=translator.rich(v)
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
    text = p.read_text(encoding="utf-8")
    text = text.replace("{{system.dmgType}}", "{{localize system.dmgType}}")
    text = text.replace("{{item.system.class}}", "{{localize item.system.class}}")
    text = text.replace("{{item.system.specialty}}", "{{localize item.system.specialty}}")
    text = text.replace("{{item.system.chapter}}", "{{localize item.system.chapter}}")
    text = text.replace("{{chapterDemeanour.system.chapter}}", "{{localize chapterDemeanour.system.chapter}}")
    text = text.replace("{{item.system.range}}", "{{localize item.system.range}}")
    text = text.replace("{{item.system.action}}", "{{localize item.system.action}}")
    text = text.replace("{{item.system.location}}", "{{localize item.system.location}}")
    text = text.replace("{{item.system.damageType}}", "{{localize item.system.damageType}}")
    text = text.replace("{{modifier.effectType}}", "{{localize modifier.effectType}}")
    text = text.replace("{{modifier.type}}", "{{localize modifier.type}}")
    text = text.replace("{{modifier.valueAffected}}", "{{localize modifier.valueAffected}}")
    text = text.replace("{{trauma.system.resistDifficulty}}", "{{localize trauma.system.resistDifficulty}}")
    text = text.replace("{{system.activeCurse.target}}", "{{localize system.activeCurse.target}}")
    text = text.replace("{{system.modeRequirement}}", "{{localize system.modeRequirement}}")
    text = text.replace("{{system.abilityCategory}}", "{{localize system.abilityCategory}}")
    text = text.replace("{{system.abilityType}}", "{{localize system.abilityType}}")
    text = text.replace("{{substring item.system.renown 0 4}}", "{{substring (localize item.system.renown) 0 4}}")
    if p.name == "item-weapon-sheet.html":
        old_class = '<input type="text" name="system.class" value="{{system.class}}" />'
        localized_class = """<select name="system.class">
            <option value="Basic" {{#if (eq system.class "Basic")}}selected{{/if}}>Основное оружие</option>
            <option value="Heavy" {{#if (eq system.class "Heavy")}}selected{{/if}}>Тяжёлое оружие</option>
            <option value="Pistol" {{#if (eq system.class "Pistol")}}selected{{/if}}>Пистолетное оружие</option>
            <option value="Melee" {{#if (eq system.class "Melee")}}selected{{/if}}>Ближний бой</option>
            <option value="Thrown" {{#if (eq system.class "Thrown")}}selected{{/if}}>Метательное оружие</option>
            <option value="Ranged" {{#if (eq system.class "Ranged")}}selected{{/if}}>Дальнобойное оружие</option>
            <option value="Mounted" {{#if (eq system.class "Mounted")}}selected{{/if}}>Установленное оружие</option>
            <option value="n/a" {{#if (eq system.class "n/a")}}selected{{/if}}>Не применимо</option>
        </select>"""
        text = text.replace(old_class, localized_class)
        old_reload = '<input type="text" name="system.reload" value="{{system.reload}}" />'
        localized_reload = """<select name="system.reload">
            <option value="" {{#unless system.reload}}selected{{/unless}}>—</option>
            <option value="Full" {{#if (eq system.reload "Full")}}selected{{/if}}>Полное действие</option>
            <option value="2 Full" {{#if (eq system.reload "2 Full")}}selected{{/if}}>2 полных действия</option>
            <option value="2Full" {{#if (eq system.reload "2Full")}}selected{{/if}}>2 полных действия</option>
            <option value="3 Full" {{#if (eq system.reload "3 Full")}}selected{{/if}}>3 полных действия</option>
            <option value="4 Full" {{#if (eq system.reload "4 Full")}}selected{{/if}}>4 полных действия</option>
            <option value="5 Full" {{#if (eq system.reload "5 Full")}}selected{{/if}}>5 полных действий</option>
            <option value="Half" {{#if (eq system.reload "Half")}}selected{{/if}}>Половина действия</option>
            <option value="—" {{#if (eq system.reload "—")}}selected{{/if}}>—</option>
            <option value="–" {{#if (eq system.reload "–")}}selected{{/if}}>–</option>
            <option value="-" {{#if (eq system.reload "-")}}selected{{/if}}>-</option>
        </select>"""
        text = text.replace(old_reload, localized_reload)

    renown_input = '<input type="text" name="system.renown" value="{{system.renown}}" />'
    renown_select = """<select name="system.renown">
        <option value="" {{#unless system.renown}}selected{{/unless}}>—</option>
        <option value="Respected" {{#if (eq system.renown "Respected")}}selected{{/if}}>Уважаемый</option>
        <option value="Distinguished" {{#if (eq system.renown "Distinguished")}}selected{{/if}}>Почётный</option>
        <option value="Distinguised" {{#if (eq system.renown "Distinguised")}}selected{{/if}}>Почётный</option>
        <option value="Disinguished" {{#if (eq system.renown "Disinguished")}}selected{{/if}}>Почётный</option>
        <option value="Famed" {{#if (eq system.renown "Famed")}}selected{{/if}}>Знаменитый</option>
        <option value="Hero" {{#if (eq system.renown "Hero")}}selected{{/if}}>Герой</option>
        <option value="Special" {{#if (eq system.renown "Special")}}selected{{/if}}>Особое</option>
    </select>"""
    text = text.replace(renown_input, renown_select)

    if p.name == "item-psychic-power-sheet.html":
        pairs = [
            ('<input type="text" name="system.action" value="{{system.action}}" placeholder="Full, Half, Free" class="stat-input" />',
             """<select name="system.action" class="stat-input">
                <option value="" {{#unless system.action}}selected{{/unless}}>—</option>
                <option value="Half" {{#if (eq system.action "Half")}}selected{{/if}}>Половина действия</option>
                <option value="Half Action" {{#if (eq system.action "Half Action")}}selected{{/if}}>Половина действия</option>
                <option value="half" {{#if (eq system.action "half")}}selected{{/if}}>Половина действия</option>
                <option value="Full" {{#if (eq system.action "Full")}}selected{{/if}}>Полное действие</option>
                <option value="Full Action" {{#if (eq system.action "Full Action")}}selected{{/if}}>Полное действие</option>
                <option value="full" {{#if (eq system.action "full")}}selected{{/if}}>Полное действие</option>
                <option value="Free" {{#if (eq system.action "Free")}}selected{{/if}}>Свободное действие</option>
                <option value="Free Action" {{#if (eq system.action "Free Action")}}selected{{/if}}>Свободное действие</option>
                <option value="free" {{#if (eq system.action "free")}}selected{{/if}}>Свободное действие</option>
                <option value="Reaction" {{#if (eq system.action "Reaction")}}selected{{/if}}>Реакция</option>
                <option value="reaction" {{#if (eq system.action "reaction")}}selected{{/if}}>Реакция</option>
                <option value="Half or Reaction" {{#if (eq system.action "Half or Reaction")}}selected{{/if}}>Половина действия или реакция</option>
                <option value="Extended (2)" {{#if (eq system.action "Extended (2)")}}selected{{/if}}>Длительное (2)</option>
                <option value="Extended (3)" {{#if (eq system.action "Extended (3)")}}selected{{/if}}>Длительное (3)</option>
                <option value="Extended (5)" {{#if (eq system.action "Extended (5)")}}selected{{/if}}>Длительное (5)</option>
                <option value="Extended (10)" {{#if (eq system.action "Extended (10)")}}selected{{/if}}>Длительное (10)</option>
                <option value="Special" {{#if (eq system.action "Special")}}selected{{/if}}>Особое</option>
             </select>"""),
            ('<input type="text" name="system.opposed" value="{{system.opposed}}" placeholder="Yes/No" class="stat-input" />',
             """<select name="system.opposed" class="stat-input">
                <option value="" {{#unless system.opposed}}selected{{/unless}}>—</option>
                <option value="Yes" {{#if (eq system.opposed "Yes")}}selected{{/if}}>Да</option>
                <option value="No" {{#if (eq system.opposed "No")}}selected{{/if}}>Нет</option>
             </select>"""),
            ('<input type="text" name="system.sustained" value="{{system.sustained}}" placeholder="Yes/No" class="stat-input" />',
             """<select name="system.sustained" class="stat-input">
                <option value="" {{#unless system.sustained}}selected{{/unless}}>—</option>
                <option value="No" {{#if (eq system.sustained "No")}}selected{{/if}}>Нет</option>
                <option value="Yes" {{#if (eq system.sustained "Yes")}}selected{{/if}}>Да</option>
                <option value="None" {{#if (eq system.sustained "None")}}selected{{/if}}>Нет</option>
                <option value="Free Action" {{#if (eq system.sustained "Free Action")}}selected{{/if}}>Свободное действие</option>
                <option value="Half Action" {{#if (eq system.sustained "Half Action")}}selected{{/if}}>Половина действия</option>
             </select>"""),
            ('<input type="text" name="system.damageType" value="{{system.damageType}}" placeholder="Energy, Impact" class="stat-input" />',
             """<select name="system.damageType" class="stat-input">
                <option value="" {{#unless system.damageType}}selected{{/unless}}>—</option>
                <option value="Energy" {{#if (eq system.damageType "Energy")}}selected{{/if}}>Энергетический</option>
                <option value="Explosive" {{#if (eq system.damageType "Explosive")}}selected{{/if}}>Взрывной</option>
                <option value="Impact" {{#if (eq system.damageType "Impact")}}selected{{/if}}>Ударный</option>
                <option value="Rending" {{#if (eq system.damageType "Rending")}}selected{{/if}}>Режущий</option>
             </select>""")
        ]
        for old, new in pairs:
            text = text.replace(old, new)

    if p.name == "item-critical-effect-sheet.html":
        old_location = '<input type="text" name="system.location" value="{{system.location}}" placeholder="e.g., Head, Body, Arm, Leg" />'
        new_location = """<select name="system.location">
            <option value="" {{#unless system.location}}selected{{/unless}}>—</option>
            <option value="Head" {{#if (eq system.location "Head")}}selected{{/if}}>Голова</option>
            <option value="Body" {{#if (eq system.location "Body")}}selected{{/if}}>Тело</option>
            <option value="Arm" {{#if (eq system.location "Arm")}}selected{{/if}}>Рука</option>
            <option value="Leg" {{#if (eq system.location "Leg")}}selected{{/if}}>Нога</option>
        </select>"""
        old_damage = '<input type="text" name="system.damageType" value="{{system.damageType}}" placeholder="e.g., Impact, Energy, Rending" />'
        new_damage = """<select name="system.damageType">
            <option value="" {{#unless system.damageType}}selected{{/unless}}>—</option>
            <option value="Energy" {{#if (eq system.damageType "Energy")}}selected{{/if}}>Энергетический</option>
            <option value="Explosive" {{#if (eq system.damageType "Explosive")}}selected{{/if}}>Взрывной</option>
            <option value="Impact" {{#if (eq system.damageType "Impact")}}selected{{/if}}>Ударный</option>
            <option value="Rending" {{#if (eq system.damageType "Rending")}}selected{{/if}}>Режущий</option>
        </select>"""
        text = text.replace(old_location, new_location).replace(old_damage, new_damage)

    p.write_text(translate_html(text),encoding="utf-8")

def config_sub(m):
    block=m.group(1)
    # Translate only presentation maps. Enum values in WeaponDamageType and other
    # gameplay config maps must remain canonical English, since mechanics compare them.
    if "DWConfig.Skills" in block or "DWConfig.CharacteristicWords" in block:
        block=CONFIG_DQ.sub(lambda x:x.group(1)+'"'+translator.simple(x.group(2))+'"',block)
        block=CONFIG_SQ.sub(lambda x:x.group(1)+"'"+translator.simple(x.group(2))+"'",block)
    elif "DWConfig.TestDifficulties" in block:
        block=re.sub(r'(\blabel\s*:\s*)"([^"]*)"',lambda x:x.group(1)+'"'+translator.simple(x.group(2))+'"',block)
        block=re.sub(r"(\blabel\s*:\s*)'([^']*)'",lambda x:x.group(1)+"'"+translator.simple(x.group(2))+"'",block)
    return block

def js_sub(p, raw):
    raw=CONFIG_OBJ.sub(config_sub,raw)
    def dq(m): return m.group(1)+'"'+translator.rich(m.group(2))+'"'
    def sq(m): return m.group(1)+"'"+translator.rich(m.group(2))+"'"
    raw=JS_DQ.sub(dq,raw)
    raw=JS_SQ.sub(sq,raw)
    raw=JS_ASSIGN.sub(dq,raw)
    raw=JS_ASSIGN_SQ.sub(sq,raw)
    raw=JS_NOTIFY.sub(dq,raw)
    raw=JS_NOTIFY_SQ.sub(sq,raw)
    raw=JS_SETATTR_DQ.sub(dq,raw)
    raw=JS_SETATTR_SQ.sub(sq,raw)
    raw=JS_TICK_PROP.sub(lambda m:m.group(1)+TICK+translator.rich(m.group(2))+TICK,raw)
    raw=JS_TICK_ASSIGN.sub(lambda m:m.group(1)+TICK+translator.rich(m.group(2))+TICK,raw)
    raw=JS_TICK_VAR.sub(lambda m:m.group(1)+TICK+translator.rich(m.group(2))+TICK,raw)
    raw=JS_TEXT_VAR_DQ.sub(dq,raw)
    raw=JS_TEXT_VAR_SQ.sub(sq,raw)
    raw=JS_TEXT_CALL_DQ.sub(dq,raw)
    raw=JS_TEXT_CALL_SQ.sub(sq,raw)
    raw=JS_HTML_DQ.sub(lambda m:m.group("q")+translator.rich(m.group("value"))+m.group("q"),raw)
    raw=JS_HTML_SQ.sub(lambda m:m.group("q")+translator.rich(m.group("value"))+m.group("q"),raw)
    raw=ALL_TICK.sub(lambda m:TICK+translator.rich(m.group(1))+TICK,raw)
    # Display enums in chat strings through localization; raw game values stay canonical.
    for enum in ("dmgType","damageType","critLocation","location"):
        raw=raw.replace("$" + "{" + enum + "}", "$" + "{game.i18n.localize(" + enum + ")}")
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
    for value in display_values:
        if eligible(value):
            ru[value] = translator.cache.get(value, value)
    # Ship the generated translation memory inside lang/ru.json so runtime localization
    # and later build caches can reuse exactly the same labels and text fragments.
    ru.update({k: v for k, v in translator.cache.items() if isinstance(k, str) and isinstance(v, str) and k != v})
    RU.write_text(json.dumps(ru,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

# Persist machine translations outside the distributable source tree. GitHub Actions
# restores this file from its cache on the next build, avoiding thousands of repeat requests.
translator.cache_file.parent.mkdir(parents=True, exist_ok=True)
translator.cache_file.write_text(json.dumps(translator.cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"[CACHE] Saved {len(translator.cache)} translations to {translator.cache_file}.")

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
