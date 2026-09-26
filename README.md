# FreewarScripts

User-Scripts für das MMORPG [Freewar.de](https://www.freewar.de).

> ⚠️ Die Verwendung von User-Skripten ist in Freewar nicht erlaubt. Nutzung auf
> eigene Gefahr.

Über Github Pages gehosted:
[zabuzard.github.io/FreewarScripts](https://zabuzard.github.io/FreewarScripts/).
Den Source Code gibts bei
[GitHub: Zabuzard/FreewarScripts](https://github.com/Zabuzard/FreewarScripts).

Um ein Skript zu nutzen, installiere eins der folgenden Browser-Addons:

- [Tampermonkey](https://www.tampermonkey.net/) (alle)
- [Greasemonkey](https://addons.mozilla.org/de/firefox/addon/greasemonkey/)
  (Firefox)
- [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) (Safari)

und importiere dann das gewünschte Skript. Die Addons erkennen ein Userscript in
der Regel automatisch, wenn man auf den raw-Link in GitHub klickt und zeigen
direkt ein Installations-Popup an.

| Installation                                 | Übersicht                                 |
| -------------------------------------------- | ----------------------------------------- |
| ![Installation](https://i.vgy.me/6ILZz9.jpg) | ![Übersicht](https://i.vgy.me/c4sj7n.jpg) |

## Skripte

Skripte können im Verzeichnis
[scripts](https://github.com/Zabuzard/FreewarScripts/tree/main/scripts) gefunden
werden.

### `battle_calculator`

Berechnet automatisch ob ein Kampf gegen ein NPC ein Sieg oder eine Niederlage
wäre. Bei einer Niederlage wird der Schnellangriffs-Link vom NPC entfernt, so
dass man nicht ausversehen im Kampf gegen das NPC stirbt.

Auserdem werden weitere Informationen zum Kampf direkt angezeigt und farblich
hervorgehoben.

| Situation                         | Interface                                      |
| --------------------------------- | ---------------------------------------------- |
| Sieg                              | ![Winning](https://i.vgy.me/eQreH8.jpg)        |
| Niederlage (Link deaktiviert)     | ![Losing](https://i.vgy.me/JXpUUo.jpg)         |
| Hoher LP-Verlust oder niedrige LP | ![Warning](https://i.vgy.me/MiDFed.jpg)        |
| Unique-NPC                        | ![Unique-NPC](https://i.vgy.me/jjwLZL.jpg)     |
| Gruppen-NPC                       | ![Group-NPC](https://i.vgy.me/hYrDMa.jpg)      |
| (Super-) Resistenz-NPC            | ![Resistance-NPC](https://i.vgy.me/6p06ll.jpg) |

NPC können auch manuell als "verboten" markiert werden, das Interface entfernt
dann ebenfalls den Schnellangriffslink und zeigt `(nicht angreifen)` an.

NPC welche mit `(unbekannt)` markiert sind, fehlen zur Zeit in der NPC
Datenbank. Lebenspunkte und Angriffskraft des NPC sind dann nicht bekannt. Der
Schnellangriffslink bleibt dann jedoch aktiv.

Das Skript ist kompatibel mit Effekten wie Sicht des Lebens oder der
automatischen Sicht der Onlos und extrahiert bei Bedarf dynamisch die Werte des
NPCs. Ansonsten werden Daten aus FreewarWiki genommen.

Zur Nutzung müssen beide User-Scripts müssen installiert werden:

- `battle_calculator.user.js` - das Hauptskript
- `battle_calculator_stat_fetcher.user.js` - extrahiert aktuelle Lebenspunkte
  und Angriffskraft des Spielers

### `healthbar`

Zeigt neben den Lebenspunkten eine dynamische Lebenspunkte-Leiste an.

| Volle Lebenspunkte                          | Kritische Lebenspunkte                          |
| ------------------------------------------- | ----------------------------------------------- |
| ![Full Health](https://i.vgy.me/hseDsw.jpg) | ![Critical Health](https://i.vgy.me/3dhyPV.gif) |

### `fastspell_plus`

Erlaubt es Schnellzauber 5 bis 9, sowie Schnellzaubersets 2 bis 5 auch ohne
Sponsor zu nutzen. Auserdem können beliebig viele weitere Schnellzauber
hinzugefügt werden.

| Erstes Set                                 | Zweites Set                                 |
| ------------------------------------------ | ------------------------------------------- |
| ![First Page](https://i.vgy.me/ZgfapT.jpg) | ![Second Page](https://i.vgy.me/hBlD26.jpg) |

Schnellzauber müssen im Skript-Code manuell über die IDs der gewünschten Items
eingestellt werden. Da die ID jedes Items unterschiedlich ist, werden gruppierte
Items (z.B. mehrere Seelenkapseln) nicht automatisch unterstützt. Diese müssten
auf Schnellzauber 1 bis 4, welche von Freewar auch ohne Sponsor nativ angeboten
werden, gelegt werden.

### `chest_puzzle`

Zeigt beim Lösen eines Kisten-Rätsels den aktuellen Status direkt an, so dass
man sich beim Lösen nicht mehr nebenbei Notizen machen muss.

| Start                                 | Rechts-Rotation mit Feedback                        | Links-Rotation bei Tiefe 3                    | Zuvor entdeckte Gute/Schlechte Positionen           |
| ------------------------------------- | --------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| ![Start](https://i.vgy.me/Qjnas1.jpg) | ![Right with Feedback](https://i.vgy.me/Xqy6b0.jpg) | ![Left at Depth](https://i.vgy.me/Cg6pqk.jpg) | ![Memorized Positions](https://i.vgy.me/cDRZVF.jpg) |

### `job_details`

Fügt im Charaktermenü Details zum aktuellen Auftrag hinzu. Dazu zählen
insbesondere dynamische Daten, wie z.B. die Position, oder auch andere
Highlights aus der Auftragsbeschreibung.

![Job Details](https://i.vgy.me/SHvKLD.jpg)

Die Ziel-Position und Richtung wird auserdem auf der Karte hervorgehoben, so
dass man leichter hinfindet.

| Nordost                                 | Osten                                 | Sichtbar                                 |
| --------------------------------------- | ------------------------------------- | ---------------------------------------- |
| ![Nordost](https://i.vgy.me/9h8sWa.jpg) | ![Osten](https://i.vgy.me/cQAWM6.jpg) | ![Sichtbar](https://i.vgy.me/Xuscli.jpg) |

Zusätzlich werden einige Job-relevante NPC Spawns dyanmisch auf der Karte
markiert, sobald man den entsprechenden Auftrag hat.

![Job NPC](https://i.vgy.me/6GYADM.jpg)

### `job_frame_refresher`

Aktualisiert automatisch den Item-Frame, sobald ein neuer Auftrag am Haus der
Aufträge angenommen wurde. Dadurch greifen Benutzerdefinitierte Skripte, welche
mit dem Auftrags-Status im Inventar arbeiten direkt und besser.

## `chat_highlight`

Highlights certain chat messages. Can be configured in the user script using
regex patterns.

![Chat highlight](https://i.vgy.me/eQJ6rx.jpg)

## `statistic_highlight`

Hebt bestimmte Nachrichten im Statistik-Menü farblich hervor.

![Statistik](https://i.vgy.me/wVN04F.jpg)

## `aka_limit_display`

Fügt eine Prozentualanzeige des aktuellen Akademielimits (im Vergleich zu den
XP) dem Charakter-Menü hinzu, so dass man nicht mehr auf Details klicken muss.

- rot: unter 50% (man erhält keine XP mehr)
- orange: unter 90% (mit deaktiviertem PvP erhält man nur noch zu 30% XP)

![Aka Limit Display](https://i.vgy.me/vD3VKt.jpg)

## `weather_hints`

Fügt allen Wettereffekt-Nachrichten im Chat eine Erklärung hinzu, welche man bei
Mouse-Hover sehen kann.

![Wetter-Effekt](https://i.vgy.me/ee4HcL.jpg)

## `baru_schreck`

Visuelles Tool um die Baru-Schrecke leichter zu besiegen.

- `baru_schreck.user.js` muss von einem Spieler installiert sein, es extrahiert
  entsprechende Events aus dem Freewar-Chat und leitet sie zum Server weiter
- `server.py` muss im Hintergrund laufen und für alle Spieler erreichbar sein
  (siehe `endpoint` Variable).

Alle Spieler rufen dann `/baru_schreck` im Browser auf (zum Beispiel
`http://freewarscripts.duckdns.org/baru-schreck`) und haben somit ein Tool,
welches unter anderem anzeigt wann geschlagen werden muss bevor sich die
Baru-Schrecke selbstständig heilt.

![Demo](https://i.vgy.me/dgKEQJ.gif)

## `necklace_swap`

Fügt Symbole hinzu um Halsschmuck schnell zu und direkt zu wechseln. Symbole und
Item-Ids müssen zuvor im Code konfiguriert werden.

![icons](https://i.vgy.me/QLf5ln.jpg)

## `weapon_swap`

Fügt Symbole hinzu um alle Waffen schnell und direkt ab- oder anzulegen, sowie
um den Taucheranzug direkt auszurüsten. Symbole und Item-Ids müssen zuvor im
Code konfiguriert werden.

![Waffen-Tausch Symbole](https://i.vgy.me/TSmw3k.jpg)

## `quick_heal`

Fügt ein Symbol zur schnellen Heilung bei den Lebenspunkten hinzu. Die Item-ID
muss zuvor im Code konfiguriert werden (zum Beispiel ein Fels der
Phasenselbstheilung).

![Healing Symbol](https://i.vgy.me/jtKgtb.jpg)

## `ultra_hd_frameset`

Passt das Frameset von Freewar so an, dass es besser für 4K Displays geeignet
ist.

| Frameset                                 | FwWiki                                 |
| ---------------------------------------- | -------------------------------------- |
| ![Frameset](https://i.vgy.me/jQlrv7.jpg) | ![FwWiki](https://i.vgy.me/pVBT0w.jpg) |

Dabei wird die Karte zwischen Hauptanzeige und Inventar bewegt um die verfügbare
Weite zu füllen und die typischen Maus-Distanzen zu reduzieren. Die Karte ist
auserdem vergrößert.

Das Inventar hat dafür mehr Platz in der Höhe und der Bereich über der Karte
kann optional zum Beispiel das FreewarWiki anzeigen.

## `target_navigation`

Zwei Skripte, welche ein Eingabefeld für Zielkoordinaten zur Navigationshilfe
der Karte hinzufügt. Falls bekannt wird auch der Name des Gebiets angezeigt.

| Südost                                 | Sichtbar                                 |
| -------------------------------------- | ---------------------------------------- |
| ![Südost](https://i.vgy.me/cAj84v.jpg) | ![Sichtbar](https://i.vgy.me/S93RZ6.jpg) |

Das Skript `target_navigation_detection` scannt dann zusätzlich die Haupt-,
Chat- und Itemanzeige nach Koordinaten. Gefundene Koordinaten können dann zum
Start der Navigation angeklickt werden.

| Itemanzeige                                 | Chat                                 |
| ------------------------------------------- | ------------------------------------ |
| ![Itemanzeige](https://i.vgy.me/FrpXAD.jpg) | ![Chat](https://i.vgy.me/11Lxiq.jpg) |
