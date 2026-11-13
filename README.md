# Spotify Widget

Minimalistyczna nakładka Spotify na pulpit (Windows). Mały, zawsze widoczny panel:
okładka, tytuł, pasek postępu, play/pauza/skip, losowo, głośność i szybki wybór playlist.
Kolor akcentu dopasowuje się do okładki aktualnego utworu.

## Instalacja (dla użytkownika)

1. Wejdź w zakładkę **Releases** tego repo i pobierz `Spotify-Widget-Setup-x.y.z.exe`.
2. Uruchom plik. Instaluje się bez pytań i od razu startuje (Windows SmartScreen może
   ostrzec, bo plik nie jest podpisany: **Więcej informacji → Uruchom mimo to**).
3. Przy pierwszym uruchomieniu zaloguj się przez Spotify (patrz niżej).

Odinstalowanie: **Ustawienia → Aplikacje → Spotify Widget**.

## Pierwsze logowanie (raz)

Spotify wymaga własnej aplikacji, żeby sterować odtwarzaniem:

1. Wejdź na <https://developer.spotify.com/dashboard> → **Create app**.
2. W **Redirect URI** dodaj dokładnie: `http://127.0.0.1:8888/callback`
   (nakładka pokazuje ten adres, klik go kopiuje). Zaznacz **Web API**.
3. Skopiuj **Client ID** z ustawień aplikacji, wklej w nakładce i kliknij **Zaloguj**.

> Do sterowania odtwarzaniem Spotify zwykle wymaga konta **Premium**.
> Spotify musi być uruchomione na komputerze (albo na innym urządzeniu).

## Obsługa

- **☰** – playlisty zamiast playera (to samo okno). Szukaj, klikaj, albo wklej link
  do playlisty/albumu/wykonawcy i naciśnij Enter. **Esc** lub strzałka wraca do playera.
  Na górze listy jest **DJ (Spotify AI)**.
- **Przeciąganie** – złap za górny pasek albo okładkę. Pozycja jest zapamiętywana.
- **Ikona w zasobniku** – pokaż/ukryj, zawsze na wierzchu, start z Windowsem, wylogowanie, zamknij.

## Dla developerów

```bash
npm install
npm start          # uruchom w trybie dev
npm run dist       # zbuduj instalator do folderu dist/
```

Wydanie nowej wersji: podbij `version` w `package.json`, potem

```bash
git tag v1.0.0
git push --tags
```

GitHub Actions zbuduje instalator i dołączy go do Release automatycznie
(`.github/workflows/release.yml`).

## Dane i prywatność

Ustawienia i token odświeżania są w `%APPDATA%\spotify-widget` (token szyfrowany
przez Windows). Nakładka łączy się wyłącznie ze Spotify.
