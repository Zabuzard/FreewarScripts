// ==UserScript==
// @name        weather_hints
// @namespace   Zabuza
// @description Adds mouse-over hints to weather messages in the chat
// @include     *.freewar.de/freewar/internal/chattext.php*
// @version     1
// @grant       none
// ==/UserScript==

(function () {
  var weathers = {
    "Blizzard in Elufia": {
      hint: "Elufia wechselt von Moos nach Eis.",
      patterns: [
        /Ein Blizzard zieht von Ragnur nach Elufia und lässt dort alles gefrieren\./,
        /Die Bergspitze Elufias erstrahlt in einem hellen Schneeweiß\./,
        /Der Blizzard wütet weiter in Elufia und alles Grün weicht kaltem Schnee\./,
        /Der Blizzard aus Ragnur flaut langsam ab, zurück bleibt komplett vereistes Elufia\./,
      ]
    },
    "Brand in Pensal": {
      hint: "Pensal brennt, lösche es für seltene Items.",
      patterns: [
        /Ein schreckliches Feuer entflammt in Pensal und verbrennt das Land\./,
        /Die letzten Flammen in Pensal wurden von .+? gelöscht und die Brände wurden erfolgreich bekämpft\./,
      ]
    },
    "Die kühlen Winde von Elufia": {
      hint: "Elufia wechselt von Feuer nach Moos.",
      patterns: [
        /Die Lava in Elufia hat sich soweit abgekühlt durch die kühlen Winde aus Ragnur, dass erstes Leben an der Bergspitze zu sprießen beginnt\./,
        /Moose wachsen über der erkalteten Lava in Elufia\./,
        /Der Geruch frischen Lebens weht aus Elufia überallhin\./,
        /Elufia präsentiert sich komplett ergrünt, Leben sprießt, wo ehemals alles voller Lava war\./,
      ]
    },
    "Düsterfrostgeister": {
      hint: "Felder auf der Welt werden in ganzen Linien vereist.",
      patterns: [
        /Aus dem Wrack der Sonta Fahr erheben sich die Geister der Besatzung und schweben über die Welt, um sie in ein eisiges Grab zu verwandeln\./,
        /Eine Prozession aus Düsterfrostgeistern zieht über diese Welt und säumt ihren Weg mit tödlichem Eis\./,
        /Die Geister der Sonta Fahr schweben langsam in das Wrack zurück und überlassen die Welt ihrem eisigen Tod\./,
      ]
    },
    "Fauliger Geruch": {
      hint: "Erzeugt untote Bürger in Buran.",
      patterns: [
        /Fauliger Geruch steigt aus den Häusern von Buran empor\./,
        /Fauliger Geruch weht durch Buran und dutzende untote Bürger kommen aus ihren Häusern geklettert\./,
        /Der faulige Geruch In Buran wird vom Wind weggetragen\./,
      ]
    },
    "Fischsterben in Loranien": {
      hint: "Erzeugt tote Tar-Fische (Item, Vollheilung) in Loranien.",
      patterns: [
        /Seltsamer Geruch steigt vom See des Friedens in Loranien auf\./,
        /Im See des Friedens von Loranien kommt es zu einem eigenartigen Fischsterben\./,
      ]
    },
    "Frostwind": {
      hint: "Alle (bis auf Taruner) werden jedes mal 15s gestarrt.",
      patterns: [
        /Eisig kalter Wind kommt aus dem Norden und die Temperatur fällt schnell\. Es sieht aus, als zieht ein Froststurm auf\./,
        /Ein starker Froststurm bläst über das Land und die Kälte lässt alle Wesen an der Oberfläche außer Tarunern für kurze Zeit einfrieren\./,
        /Der Sturm lässt nach und die frostige Kälte weicht wieder normalem Wetter\./,
      ]
    },
    "Geburtstag": {
      hint: "Freewar hat heute Geburtstag (kein Effekt).",
      patterns: [
        /Die Welt beginnt bedrohlich zu knarzen\./,
        /Der Boden knarzt laut und es wirkt, als würde diese gesamte Welt auf einen Schlag deutlich altern\./,
      ]
    },
    "Gewitter": {
      hint: "Zufällige Spieler werden vom Blitz getroffen, zieht bis auf 1 LP ab.",
      patterns: [
        /Dicke Gewitterwolken ziehen im Westen auf\. Lauter Donner ist zu hören/,
        /Es gewittert stark und lauter Donner lässt die Welt erbeben\. .+? wird vom Blitz getroffen, überlebt jedoch schwer verletzt\./,
        /Die Gewitterwolken lösen sich auf und der Donner ist nur noch weit entfernt zu hören\./,
      ]
    },
    "Geysir-Ausbruch": {
      hint: "Erzeugt Geysir-Steine (wertvoll) in Dorea\. Spieler im Gebiet werden bis auf 1 LP verletzt.",
      patterns: [
        /Die Erde von Dorea bebt und die Geysire fangen in gleichem Rhythmus an, kleine Wasserfontänen zu spucken\./,
        /Die Geysire in Dorea brechen alle auf einmal aus und überschütten Dorea mit glühend heißem Wasser\./,
        /Die einzelnen Geysire in Dorea versiegen auf einen Schlag wieder und sprühen nur noch gelegentlich Wasser in die Luft\./,
      ]
    },
    "Giftiger Nebel": {
      hint: "Alle an der Oberfläche werden für 10min vergiftet.",
      patterns: [
        /Ein seltsam beißender Geruch zieht auf\. Dicker grüner und giftiger Nebel scheint aus dem Nichts zu kommen\./,
        /Giftiger Nebel vergiftet alle Wesen an der Oberfläche dieser Welt\./,
        /Langsam löst sich der giftige Nebel, ein feiner Geruch nach dem Gift bleibt jedoch noch in der Luft/,
      ]
    },
    "Hagel": {
      hint: "Verletzt jedesmal alle an der Oberfläche um 3 LP.",
      patterns: [
        /Vereinzelte, kleine Hagelkörner fallen vom Himmel\./,
        /Riesige Hagelkörner fallen vom Himmel und verwunden jedes Wesen an der Oberfläche um 3 Lebenspunkte\./,
        /Langsam hört es auf zu hageln, auf dem Boden liegen jedoch noch einige große Hagelkörner\./,
      ]
    },
    "Halloween": {
      hint: "Teleportiert jedesmal einen zufälligen Spieler umher.",
      patterns: [
        /In der Ferne hört man ein irres und schauriges Lachen\./,
        /Einige dunkle Schatten huschen über den Himmel und stürzen sich dann unter wahnsinnigem Lachen auf .+?/,
        /Das irre und schaurige Lachen verklingt in der Ferne\./,
      ]
    },
    "Himmelslichter": {
      hint: "Verstummt alle an der Oberfläche für 90s.",
      patterns: [
        /Am Himmel sind kleine Schlieren und grüne Lichter zu sehen\./,
        /Bunte Himmelslichter versetzen alle Wesen auf dieser Welt in staunen und die Welt verstummt\./,
        /Die Himmelslichter verblassen langsam, bis kaum mehr etwas von ihnen zu sehen ist\./,
      ]
    },
    "Insektenplage": {
      hint: "Jedesmal werden etwa 30 Pflanzen zerstört.",
      patterns: [
        /Tausende von kleinen Insekten schwirren aus dem Süden heran/,
        /Tausende von kleinen Insekten schwirren umher, und fressen dutzende Pflanzen auf\./,
        /Die Insekten schwirren weiter Richtung Norden\./,
      ]
    },
    "Inspirierende Brise": {
      hint: "Verkürzt jedesmal Lernzeit aller an der Oberfläche um 1min.",
      patterns: [
        /Eine inspirierende Brise weht aus dem Süden heran\./,
        /Eine inspirierende Brise weht umher, und verkürzt die Lernzeit von Charakterfähigkeiten aller Wesen an der Oberfläche um eine Minute\./,
        /Die inspirierende Brise löst sich auf und für kurze Zeit herrscht Windstille\./,
      ]
    },
    "Kanonendonner": {
      hint: "Erzeugt jedesmal Portalstäbe (1-6h haltbar).",
      patterns: [
        /Von der schwebenden Insel Itolos her ist ein lauter Knall zu hören\./,
        /Mit Donnergetöse feuert die riesige Kanone auf Itolos einen Portalstab in die Welt, der sich an dem Ort .+? in den Boden bohrt\./,
        /Mit Donnergetöse feuert die riesige Kanone auf Itolos einen Portalstab ab, der zusammen mit .+? an dem Ort .+? landet\./,
        /Die Kanone auf Itolos hat ihr unkontrolliertes Feuern eingestellt und wirkt so friedlich wie zuvor\./,
      ]
    },
    "Meteoritenhagel": {
      hint: "Erzeugt Bombenkrater (Loktit-Stein) auf der Welt.",
      patterns: [
        /Kleine schwarze Punkte sind am Himmel zu erkennen, die langsam größer werden\./,
        /Ein gigantischer Meteorit fällt glühend vom Himmel und schlägt in den Boden ein\./,
        /Am Himmel ist kein schwarzer Punkt mehr zu sehen\. Die Bedrohung durch Meteoriten scheint vorerst gebannt zu sein\./,
        /Ein dicker Feuerball zieht über den Himmel\. Danach sieht man mehrere kleine Sternschnuppen am Himmel\./,
      ]
    },
    "Nieselregen": {
      hint: "Erzeugt jedesmal etwa 40 schwache NPCs mit A:1-2.",
      patterns: [
        /Leichte Stratuswolken ziehen aus dem Norden heran\./,
        /Leichter Nieselregen fällt vom Himmel und lockt viele kleine und schwache Kreaturen aus ihren Löchern\./,
        /Der Nieselregen ist vorbei, Blumen blühen auf und die Wälder riechen nach neuer Frische\./,
      ]
    },
    "Phasenwind": {
      hint: "Regeneriert jedesmal Phasenenergie für alle an der Oberfläche.",
      patterns: [
        /Der Himmel wird von blauen Schwaden durchzogen\./,
        /Blaue Phasenschwaden wehen durch die Welt\. Alle Personen, welche die Fähigkeit besitzen Phasenenergie aufzunehmen, regenerieren dadurch etwas Phasenenergie\./,
        /Die Phasenschwaden verflüchtigen sich und nach kurzer Zeit wirkt die Luft wieder völlig normal\./,
      ]
    },
    "Portalsturm": {
      hint: "Erzeugt zufällige Portale.",
      patterns: [
        /Ein heftiger Sturm zieht auf und Raum sowie Zeit geraten ins Wanken\./,
        /Ein heftiger Portalsturm pflügt durch Raum und Zeit und hinterlässt hunderte Portale an der Oberfläche der Welt\./,
        /Der Portalsturm lässt nach aber viele Portale auf der Welt deuten noch auf den schrecklichen Sturm hin\./,
      ]
    },
    "Regen": {
      hint: "Heilt jedesmal all an der Oberfläche um 2 LP.",
      patterns: [
        /Am Horizont tauchen einzelne Regenwolken auf, die heilenden Regen mit sich bringen\./,
        /Es regnet in Strömen vom Himmel\. Durch den Regen heilen alle Wesen an der Oberfläche dieser Welt um 2 Lebenspunkte\./,
        /Die Regenwolken ziehen langsam weiter nach Süden und es hört auf zu regnen\./,
      ]
    },
    "Regenbogen": {
      hint: "Erzeugt Tautropfen (1-30min haltbar, für Mooszucht in UK).",
      patterns: [
        /Ein leuchtender Regenbogen-Vogel ist am Himmel zu erkennen\./,
        /Regenbögen spannen sich von einer Wolke zur nächsten\. Die Welt wird in prismatische Farben getaucht und Tautropfen glitzern auf dem Boden\./,
        /Die Farben der Regenbögen verblassen\./,
      ]
    },
    "Runensphäre": {
      hint: "Aktiviert jedesmal zufällige Effekte auf alle an der Oberfläche.",
      patterns: [
        /.+? kanalisiert seine magischen Fähigkeiten und erschafft eine mit uralten Runen überzogene, gigantische Sphäre, die in den Himmel aufsteigt und sich dort immer schneller zu drehen beginnt\./,
        /Die Runensphäre implodiert geräuschlos und bald schon deutet nichts mehr auf die magischen Kräfte hin, die freigesetzt wurden\./,
      ]
    },
    "Salzende Böen": {
      hint: "Erzeugt jedesmal mehrere Blutprobenwesen.",
      patterns: [
        /Ein Sturm braut sich an der Küste von Salthos zusammen\./,
        /Sturmböen peitschen über Salthos hinweg und verteilen merkwürdige Salze auf der Welt, die viele Wesen mutieren lassen\./,
        /Der Sturm an der Küste von Salthos ebbt wieder ab, nur salzige Flecken auf dem Boden erinnern an das Geschehen\./,
      ]
    },
    "Sandsturm": {
      hint: "Alle bis auf Taruner haben in Mentoran eine Laufzeit von 45s.",
      patterns: [
        /Ein starker Sturm zieht von Reikan Richtung Mentoran\./,
        /Ein Sandsturm ungeahnter Kraft wütet in Mentoran und hindert alle Wesen in Mentoran am weiterkommen\. Lediglich Taruner können sich in Mentoran ungehindert bewegen\./,
        /Der Sandsturm in Mentoran beruhigt sich wieder, und jede Düne der Wüste wurde scheinbar in eine andere Form gebracht\./,
      ]
    },
    "Schönes Wetter": {
      hint: "Erhöht die Spawnrate von NPCs an der Oberfläche deutlich.",
      patterns: [
        /Alle Wolken verziehen sich, und es sieht aus, als ob das Wetter unglaublich schön wird\./,
        /Atemberaubend schönes Wetter betört alle NPCs in dieser Welt und lässt viele neue NPCs entstehen\./,
        /Das Wetter normalisiert sich wieder und die ein oder andere Wolke ist zu sehen\./,
      ]
    },
    "Seelenstaub": {
      hint: "Gibt jedesmal allen an der Oberfläche Seelensicht (70s).",
      patterns: [
        /Glitzernder Seelenstaub zieht aus der Ferne heran\./,
        /Glitzernder Seelenstaub wirbelt an der Oberfläche entlang und verleiht allen Wesen die Fähigkeit geistlose Wesen in der Umgebung zu sehen\./,
        /Der glitzernde Seelenstaub wird immer dünner in der Luft, bis er schließlich ganz verschwindet\./,
      ]
    },
    "Silberschnee": {
      hint: "Erzeugt Silberschnee (wertvoll, Wolka) in Latenie und Ferdolien (Norden).",
      patterns: [
        /Dicke Schneewolken, welche silbern glitzern, ballen sich über Latenia\./,
        /Es schneit stark in Latenia\. Einige der Schneeflocken glitzern silbern und hüllen das Land in einen silbernen Mantel\./,
        /Die Wolken über Latenia verziehen sich und es hört auf zu schneien\./,
      ]
    },
    "Spiralpflanzen aus dem All": {
      hint: "Erzeugt Spiralpflanzen (Stufe 70-80, u.a. Chaoslabor und Torponschuppenpanzer) auf der Oberfläche.",
      patterns: [
        /Kleine Pollen oder Sporen ziehen durch die Luft und kommen vermutlich aus dem Weltraum\./,
        /Die Sporen in der Luft setzen sich auf dem Boden nieder und entfalten sich in sekundenschnelle zu fremdartigen Spiralpflanzen\./,
        /Man kann keine Sporen mehr in der Luft sehen, aber überall blühen diese fremdartigen Spiralpflanzen/,
      ]
    },
    "Sprühregen": {
      hint: "Erzeugt jedesmal Sprühregenwürmer (Invasions-NPC, keine Drops oder XP).",
      patterns: [
        /Ganz leichter Sprühregen setzt ein\./,
        /Leichter Sprühregen lockt unzählige Sprühregenwürmer an die Oberfläche dieser Welt\./,
        /Langsam hört es wieder auf zu regnen\./,
      ]
    },
    "Starker Wind": {
      hint: "Gegen Windrichtung laufen benötigt 10s zusätzliche Laufzeit.",
      patterns: [
        /Extrem starker Wind bläst aus dem .+?\. Ein Fortkommen gegen die Windrichtung ist kaum mehr möglich\./,
        /Extremster Wind bläst aus dem .+?\. Sich gegen die Windrichtung zu bewegen ist nur noch sehr schwer möglich\./,
        /Der Wind flaut langsam ab und läßt nach\./,
      ]
    },
    "Sturmböen": {
      hint: "Verletzt jedesmal NPCs um 50% LP. Fallen lösen schneller aus.",
      patterns: [
        /In Nawor kommt es zu heftigen Sturmböen\. Dabei werden Millionen von kleinen Kaktusstacheln gelöst und durch die Welt getragen/,
        /Sturmböen wirbeln Kaktuspfeile durch die ganze Welt und verwunden alle NPCs an der Oberfläche dieser Welt stark\./,
        /Die Sturmböen lassen nach und nur noch ein milder Wind ist zu spüren\./,
      ]
    },
    "Unheimliches Grollen": {
      hint: "Erzeugt magische Dampfwolken (Invasions-NPC, keine Drops aber 1 XP).",
      patterns: [
        /Tief unter der Erde gibt es einen lauten Knall und im Boden bilden sich große Risse\./,
        /Ein lautes Knarzen ist aus dem Boden zu hören und kurz darauf steigen magische Dämpfe vom Boden auf\./,
        /Die Risse im Boden schließen sich langsam wieder und das Knarzen verstummt plötzlich\./,
      ]
    },
    "Virenseuche": {
      hint: "Töte jedesmal bis zu 30 NPCs. Erzeugen virenverseuchter Schleim (magisch, nutzlos).",
      patterns: [
        /Ein eigenartiger Geruch zieht umher und viele Tiere beginnen wie wild zu husten\./,
        /Eine eigenartige Seuche geht umher, und lässt verschiedene Wesen an einem qualvollen Tod sterben\./,
        /Die Seuche scheint großteils vorbei zu sein, allerdings liegt immer noch ein unangenehmer Geruch in der Luft und man hört vereinzelte Tiere röcheln\./,
      ]
    },
    "Vulkanausbruch in Anatubien": {
      hint: "Verletzt alle im Vulkangebiet. Erzeugt Vulkangestein (wertvoll) und Heiße Lava (2min, Stätte der Wahrsager: Siramücken-Orakel, Fun-Item).",
      patterns: [
        /Dicker Qualm steigt aus dem Vulkan von Anatubien auf\./,
        /Gigantische Lavamassen werden aus dem Vulkan von Anatubien geschleudert und die Rauchsäule ist von überall aus zu sehen\./,
        /Der Vulkan von Anatubien beruhigt sich langsam und nur die Rauchsäule über dem Vulkan und leises Rumpeln deuten noch auf die Katastrophe hin\./,
      ]
    },
    "Vulkanausbruch in Elufia": {
      hint: "Elufia wechselt von Eis nach Feuer.",
      patterns: [
        /In einem ohrenbetäubenden Krachen birst die Bergspitze in Elufia und meterhohe Lavafontänen sind von Weitem her zu sehen\./,
        /Der Vulkan in Elufia spuckt gewaltige Mengen an heißer Lava und Asche in den Himmel und verbrennt alle Lebewesen in Elufia\./,
        /Lava rollt den Berg in Elufia hinab und lässt viel Eis in einer schmutzigen Wolke verdampfen\./,
        /Ganz Elufia ist ein einziges Feuer, von Schnee ist weit und breit nichts mehr zu sehen\./,
      ]
    },
    "Vulkanausbruch im brennenden Elufia": {
      hint: "Verletzt jedesmal alle in Elufia.",
      patterns: [
        /Ein Ring des Vulkans fällt plötzlich vom Himmel und landet im Vulkan, der daraufhin einen lauten Knall von sich gibt und große Mengen Lava und Asche in die Luft schleudert\./,
        /Der Vulkan in Elufia spuckt gewaltige Mengen an heißer Lava und Asche in den Himmel und verbrennt alle Lebewesen in Elufia\./,
        /Ein von dunklen Blitzen umgebener Sandsturm senkt sich herab\./,
        /Innerhalb des Sturmes formen sich tausende kleine Sandkörner zu einem Taruner mit dem Namen .+?\./,
      ]
    },
    "Warmer Goldstaub-Wind": {
      hint: "Erzeugt Goldstaub (wertvoll, Quests).",
      patterns: [
        /Warme Luft kommt aus dem Süden\./,
        /Die warme Luft, welche aus dem Süden kommt, trägt feinen Goldstaub mit sich\./,
        /Der seichte Wind aus dem Süden verstummt und es ist für kurze Zeit fast windstill\./,
      ]
    },
    "Weihnachtsmann": {
      hint: "Erzeugt Weihnachtsgeschenk (enthält Lebkuchen, Vollheilung).",
      patterns: [
        /In der Ferne hört man leise Glöckchen klingeln\./,
        /Unter ständigem Glöckchengeläute huscht ein großer Schlitten, gezogen von 9 Rentieren, an dessen Steuer ein dicker, rot gekleideter Mann sitzt über den Himmel und verliert dabei ein wenig von seiner Ladung\./,
        /Der Schlitten wird immer kleiner und auch das Klingeln der Glöckchen verstummt nach kurzer Zeit\./,
        /Unter ständigem Glöckchengeläute huscht ein großer Schlitten, gezogen von 9 Rentieren, an dessen Steuer ein dicker, rot gekleideter Mann sitzt über den Himmel und stellt fest, dass die Welt nicht artig war\./,
      ]
    },
    "Wolkenflug": {
      hint: "Erzeugt Wolkenstoff (6 Tage, wertvoll, Drop in Wolka um Betörung der Geistlosen herzustellen).",
      patterns: [
        /Dicke Wolken ziehen auf\./,
        /Dicke Wolken fliegen tief über das Land und lassen etwas Wolkenstoff zurück\./,
        /Die Wolken ziehen langsam wieder ab\./,
      ]
    },
    "Zauberpollenflug": {
      hint: "Erzeugt Zauberpollen (wertvoll, Wolka).",
      patterns: [
        /Aus dem Westen weht ein laues Lüftchen\. In der Ferne sieht man hunderte kleiner Dinge, die wie Sterne glitzern\./,
        /Die Luft trägt hunderte Zauberpollen durch die Lande, die magisch glitzern\./,
        /Die Zauberpollen werden weiter Richtung Osten getragen und sind schon bald nicht mehr zu sehen\./,
      ]
    },
    "Erdbeben": {
      hint: "Erzeugt Diamantader (kann in Gruppe mit Spitzhacke abgebaut werden um zufällige Edelsteine zu erhalten).",
      patterns: [
        /Der Erde beginnt zu beben\./,
        /Die Erde bebt so stark, dass kleine Risse in der Oberfläche entstehen, wodurch kleine Diamantadern empor stoßen\./,
        /Die Erde hat sich wieder beruhigt\./,
      ]
    },
    "Goldregen": {
      hint: "NPCs können Goldtropfen (Chaoslabor oder 50gm Shop) droppen.",
      patterns: [
        /Ein Goldregen bahnt sich an\./,
        /Ein mächtiger Goldregen stürmt über die Welt, deren goldige Tropfen von den geistlosen Wesen dieser Welt aufgesogen werden\./,
        /Der Goldregen zieht weiter\./,
      ]
    },
    "Mysteriöse Wolken": {
      hint: "Erzeugt Wissenszauber: Meteorologie oder verkürzt Laufzeit von Meteorologie für zufällige Spieler.",
      patterns: [
        /Über der Wetterstation bilden sich plötzlich pechschwarze Wolken und man hört, wie die Meteorologen aufgeregt diskutieren\./,
        /Mysteriöse, pechschwarze Wolken ziehen über die Welt und verdunkeln sie\./,
        /Den weisen Meteorologen gelingt es die mysteriösen Wolken zurück nach Etume zu locken und sie einzufangen\./,
        /Mysteriöse Wolken ziehen über .+? auf und verdunkeln für einige Sekunden alles um .+? herum\./,
      ]
    },
    "Sonnenbrand": {
      hint: "Verbrennt alle in Mentoran, Reikan, Nawor, Orewu und Azul (Sonnencreme schützt).",
      patterns: [
        /Die Sonne in Mentoran senkt sich beachtlich\./,
        /Die Sonne in Mentoran steht so tief, dass alle Wesen dieser Welt unerträgliche Verbrennungen erleiden. Lediglich Taruner können der starken Hitze standhalten\./,
        /Die Sonne in Mentoran entfernt sich wieder\./,
      ]
    },
    "Steinwurf": {
      hint: "Blockiert temporär Durchgänge zwischen Gebieten (Fliegen hilft, Steingipfel töten stoppt das Wetter).",
      patterns: [
        /Der lebende Steingipfel in Venost regt sich über das Wetter auf\./,
        /Der lebende Steingipfel in Venost ist so aufgebracht, dass er einen ganzen Felsbrocken losschleudert, der in erstaunlichem Bogen über die Welt fliegt, bis er irgendwo einschlägt\./,
        /Der lebende Steingipfel in Venost hat sich wieder beruhigt\./,
        /Als .+? den lebenden Steingipfel tötet, beendet er gleichzeitig die Unruhe des Steingipfels\./,
      ]
    },
    "Unkontrollierte Polarisation": {
      hint: "Polarisiert alle in eine bestimmte Richtung (beeinflusst Laufzeit, lockt Polarisations-Otter an).",
      patterns: [
        /Die Pole der Welt beginnen sich unkontrolliert auszurichten\./,
        /Die Pole der Welt sind Richtung .+? ausgerichtet, sodass alle Wesen der Welt dorthin hingezogen werden\./,
        /Die Pole der Welt richten sich wieder kontrolliert aus\./,
      ]
    },
    "Wirbelsturm": {
      hint: "Wind-Felder schleudern beim Betreten auf ein zufälliges Feld weg.",
      patterns: [
        /Ein Wirbelsturm bahnt sich an\./,
        /Auf Windfeldern wehen so starke Wirbelstürme, dass Wesen sich an diesen kaum festhalten können\./,
        /Auf Windfeldern der Inseln wehen so starke Wirbelstürme, dass Wesen sich dort kaum festhalten können/,
        /Der Wirbelsturm verschwindet wieder\./,
      ]
    },
    "Wundersamer Kugelflug": {
      hint: "Erzeugt jedesmal Wunderkugeln für zufällige Spieler.",
      patterns: [
        /Aus den Bergen von Etume steigen mehrere bunte Objekte in die Höhe auf und ziehen jegliche Aufmerksamkeit auf sich\./,
        /Eine magische Kugel landet vor .+? und springt aufgeregt herum\./,
        /Der Himmel normalisiert sich und es sind keine Objekte mehr zu sehen\./,
      ]
    },
    "Invasion der Schatten": {
      hint: "Erzeugt überall Schattenkreaturen. Droppen selten Truhe mit Schattenglas (Weltenspalter, Chaoslabor).",
      patterns: [
        /Als .+? den Weltenwandler tötet, hält dieser seine Finger nach oben und gibt ein letztes Kommando\. In Ryn sammeln sich Hunderte von Schattenkreaturen und bereiten sich auf eine Invasion dieser Welt vor\./,
        /Hunderte Schattenkreaturen strömen aus Ryn über die Welt\./,
        /Die letzten Schattenkreaturen begeben sich in die Höhlen und Dungeons und bevölkern den letzten Winkel dieser Welt\./,
      ]
    },
    "Segen des Kolrun": {
      hint: "Belebt alle NPC um ein zufälliges Feld wieder und alle Spieler erhalten Zeitkontrolle.",
      patterns: [
        /Als .+? den Äonenjäger besiegen, erstarkt der Geist der Welt merklich, was alle Lebewesen der Welt heilt und beschleunigt\./,
        /Sämtliche Lebewesen rund um Beispielort kommen hervor, um den Segen des Kolrun zu empfangen\./,
        /Der Segen wird wieder schwächer, bis er nur noch spurenhaft wahrzunehmen ist\./,
      ]
    },
    "Taubenflug": {
      hint: "Erzeugt Brieftaube des Auftragshauses (Remote-Annehmen/Abschließen von Aufträgen) im Inventar zufälliger Spieler.",
      patterns: [
        /.+? hat die Tür des Auftragshauses offen stehen gelassen und großes Unheil nimmt seinen Lauf\./,
        /.+? Brieftauben des Auftragshauses fliegen wie wild über die Welt\. .+? gelingt es eine einzufangen\./,
        /Alle Brieftauben des Auftragshauses konnten eingefangen werden und die Welt beruhigt sich langsam wieder\./,
      ]
    },
    "Magische Nebelwolken": {
      hint: "Alle an der Oberfläche erhalten Fliegen (3min). Erzeugt Nebelgebiete, welche über die Karte wandern. Dort gibt es Nebelzofen und auf der Nebelinsel gibt es Nebelprinzessin.",
      patterns: [
        /Ein heller Lichtstrahl bricht durch die dichte Nebeldecke über der Nebelinsel und schießt gen Himmel\./,
        /Magische Nebelwolken ziehen über die Welt Richtung Nebelinsel und verleihen jedem die Fähigkeit zu fliegen\./,
        /Die letzten Nebelwolken sind verschwunden und langsam beruhigen sich die Nebel auf der Nebelinsel wieder\./,
      ]
    },
    "Schwarm-Angriff": {
      hint: "Erzeugt Schwarm-Kriegerin (dropt Item um massive Steinplatte in Elufia weiter zu schwächen). Teil eines Welten-Events.",
      patterns: [
        /Am Horizont taucht ein Schwarm großer Insekten auf, die sich darauf vorbereiten, diese Welt zu vernichten\./,
        /Hunderte Schwarm-Kriegerinnen fallen über diese Welt her\./,
        /Der große Insektenschwarm am Horizont verschwindet langsam wieder\. Die Invasion scheint abgewendet zu sein\./,
      ]
    }
  };

  function getMessageText(message) {
    var clone = message.cloneNode(true);
    var time = clone.querySelector(".chattime");
    if (time) { time.remove(); }
    return clone.textContent.trim();
  }

  function handleMessage(message) {
    var text = getMessageText(message);
    Object.keys(weathers).forEach(function (weatherName) {
      var weather = weathers[weatherName];
      if (weather.patterns.some(function (pattern) {
        return pattern.test(text);
      })) {
        message.title = weatherName + ": " + weather.hint;
      }
    });
  }

  function handleMessages() {
    var messages = document.querySelectorAll("p.chattextinfo");
    for (var i = 0; i < messages.length; i++) {
      handleMessage(messages[i]);
    }
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].nodeType === 1 && nodes[j].matches("p.chattextinfo")) {
          handleMessage(nodes[j]);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  handleMessages();
})();
