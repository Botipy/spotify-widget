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

## Udostępnianie znajomemu

Instalator jest samodzielny (zawiera wszystko), więc wystarczy wysłać link do **Releases**
albo sam plik `.exe` (ok. 115 MB). W instalatorze nie ma żadnych kont ani kluczy, każdy loguje się
sam. Znajomy ma dwie opcje:

1. **Własna aplikacja Spotify** (najprościej, ok. 5 minut): kroki z sekcji „Pierwsze logowanie”.
2. **Cudzy Client ID** (np. Twój): właściciel aplikacji musi w dashboardzie, w zakładce
   **User Management**, dodać e-mail znajomego (tryb deweloperski działa tylko dla osób z listy,
   do 25). Bez tego logowanie zwróci błąd.

Jeśli repo jest prywatne, znajomy nie pobierze pliku z Releases, dopóki nie dodasz go w
**Settings → Collaborators** (albo nie ustawisz repo jako publiczne).

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
| --- | --- |
| Windows ostrzega przy uruchomieniu | Plik jest niepodpisany. **Więcej informacji → Uruchom mimo to**. |
| Logowanie: błąd / „INVALID_CLIENT” | Sprawdź Client ID i czy Redirect URI to dokładnie `http://127.0.0.1:8888/callback`. |
| Logowanie: 403 / „user not registered” | Dodaj e-mail użytkownika w **User Management** aplikacji Spotify. |
| „Port 8888 zajęty” | Zamknij program używający portu 8888 i spróbuj ponownie. |
| Pauza/skip nie reagują | Spotify zwykle wymaga **Premium** do sterowania z zewnątrz i musi być uruchomione. |
| Brak playlisty (np. DJ, Daily Mix) | Wklej link do niej w polu wyszukiwania i naciśnij Enter. |

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
