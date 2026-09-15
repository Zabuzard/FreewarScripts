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

| Situation                                 | Interface                                           |
| ----------------------------------------- | --------------------------------------------------- |
| Start                                     | ![Start](https://i.vgy.me/Qjnas1.jpg)               |
| Rechts-Rotation mit Feedback              | ![Right with Feedback](https://i.vgy.me/Xqy6b0.jpg) |
| Links-Rotation bei Tiefe 3                | ![Left at Depth](https://i.vgy.me/Cg6pqk.jpg)       |
| Zuvor entdeckte Gute/Schlechte Positionen | ![Memorized Positions](https://i.vgy.me/cDRZVF.jpg) |

### `job_details`

Fügt im Charaktermenü Details zum aktuellen Auftrag hinzu. Dazu zählen
insbesondere dynamische Daten, wie z.B. die Position, oder auch andere
Highlights aus der Auftragsbeschreibung.

![Job Details](https://i.vgy.me/KqhyeH.jpg)

### `job_frame_refresher`

Aktualisiert automatisch den Item-Frame, sobald ein neuer Auftrag am Haus der
Aufträge angenommen wurde. Dadurch greifen Benutzerdefinitierte Skripte, welche
mit dem Auftrags-Status im Inventar arbeiten direkt und besser.
