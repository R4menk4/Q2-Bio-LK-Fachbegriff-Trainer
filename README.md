# Fachbegriff-Trainer Populationsdynamik

Interaktiver Karteikartentrainer nach dem Vorbild des Genetik-Trainers unter
<https://r4menk4.github.io/Q1-Genetik/>.

## Enthaltene Funktionen

- Auswahl nach fachlichen Themen oder persönlichem Lernstand
- Fachbegriff oder Definition als Kartenvorderseite
- Modus zum Üben der Schreibweise
- Selbsteinschätzung in Einfach, Mittel und Schwer
- lokal im Browser gespeicherte Statistik
- responsive Darstellung für Computer, Tablet und Smartphone

## Lokal starten

Da die Begriffe aus einer JSON-Datei geladen werden, sollte der Ordner über einen
kleinen lokalen Webserver geöffnet werden. Im Ordner kann beispielsweise ausgeführt werden:

```powershell
python -m http.server 8000
```

Danach ist der Trainer unter <http://localhost:8000> erreichbar.

## Veröffentlichung

Der gesamte Ordner kann unverändert als GitHub-Pages-Repository verwendet werden.
Die Fachbegriffe befinden sich in `data/terms.json`.
