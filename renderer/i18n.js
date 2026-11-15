// Tłumaczenia (EN domyślnie, PL). Ten sam plik działa w procesie głównym (require) i w oknach (<script>).
(function () {
  const D = {
    en: {
      // --- proces główny ---
      tokenError: 'Token error', loginTimeout: 'Sign-in timed out', loginClose: 'You can close this tab.',
      loginFailed: 'Sign-in failed', loginError: 'Sign-in error', loginOk: 'Signed in to Spotify Widget ✔', portBusy: 'Port 8888 is in use: ',
      notTester: "Your account is not on the app's tester list. Ask the author to add your email in the Spotify dashboard.",
      rateLimit: 'Spotify is temporarily rate limiting requests. Try again in a moment.', noNet: 'No internet connection', errN: 'Error {n}',
      notTrack: 'This is not a track', notPlaylist: 'This is not a playlist', noDevice: 'No device. Start Spotify on your computer.',
      restricted: 'Spotify does not share the tracks of this playlist (only your own or shared ones). You can still play it as a whole.',
      updOnlyInstalled: 'Updates only work in the installed version.', updCheckFail: 'Could not check for updates',
      updDownloading: 'Downloading update {v}…', updLatest: 'You have the latest version ({v})',
      updInstalling: 'Update {v}: installing and restarting…', updReady: 'Update {v} is ready. It will install when you quit.',
      trayToggle: 'Show / hide panel', traySettings: 'Appearance & settings…', trayOnTop: 'Always on top', trayAutostart: 'Launch with Windows',
      trayVersion: 'Version {v}', trayAutoUpd: 'Update automatically on start', trayInstall: 'Install update and restart',
      trayCheck: 'Check for updates', trayLogout: 'Sign out of Spotify', trayQuit: 'Quit', settingsTitle: 'Spotify Widget – Settings',
      // --- widget ---
      nothingPlaying: 'Nothing playing', idleArtist: 'Play something or pick a playlist', copied: 'Copied ✔',
      enterClientId: 'Enter your Client ID', waitingBrowser: 'Waiting for sign-in in the browser…', signInFailed: 'Could not sign in',
      deviceLbl: 'Device: {d}', backToPlayer: 'Back to player', playlistsT: 'Playlists', noConn: 'No connection', unknownErr: 'unknown error',
      openedInSpotify: 'Opened in the Spotify app', nameHint: 'Click: play  ·  ≡ icon or right-click: tracks', noPlaylists: 'No playlists',
      showTracks: 'Show tracks', plFail: 'Could not load playlists ({e}). Click to retry', needPlScope: 'Missing playlist permission. Sign out and sign in again.',
      tracksFail: 'Could not load tracks', loading: 'Loading…', noTracks: 'No tracks', likedSongs: 'Liked Songs',
      heartOnlyTracks: 'Likes only work for tracks', heartRemove: 'Remove from Liked Songs', heartAdd: 'Add to Liked Songs',
      consent: 'Spotify needs one more permission (liked songs). Opening the browser…', consentFail: 'Could not grant permission',
      likeFail: 'Could not change the like', likedAdded: 'Added to Liked Songs', likedRemoved: 'Removed from Liked Songs',
      pomoLong: 'Long break', pomoShort: 'Break · ', pomoSession: 'Session ', exTrack: 'Example track', exArtist: 'Artist, Guest', exPlaylist: 'Playlist {n}',
      // --- HTML widgetu ---
      gripTip: 'Hold and drag to move', hide: 'Hide', hideTray: 'Hide to tray', loginHint: 'Paste the <b>Client ID</b> from <a href="#" id="devlink">developer.spotify.com</a> and add this Redirect URI there:',
      clickCopy: 'Click to copy', signIn: 'Sign in', searchPh: 'Search or paste a link…', pomodoro: 'Pomodoro', settingsTip: 'Appearance & settings',
      shuffle: 'Shuffle', prev: 'Previous', playPause: 'Play / pause', next: 'Next', volume: 'Volume', hoverCover: 'Hover over a cover to see its name',
      backToMusic: 'Back to music', modeFocus: 'Focus', modeShortLong: 'Short break', modeShort: 'Short', modeLongLong: 'Long break', modeLong: 'Long',
      restartBlock: 'Restart this block', startPause: 'Start / pause', skipBlock: 'Skip to the next block',
      // --- ustawienia ---
      settings: 'Settings', tabStyle: 'Style', tabBehavior: 'Behavior', tabSystem: 'System', tabPomodoro: 'Pomodoro', savedInstantly: 'Changes are saved instantly',
      pgAppearance: 'Appearance', pgBehavior: 'Behavior', pgSystem: 'System', pgPomodoro: 'Pomodoro',
      styleLead: 'Pick a preset and a panel size. Changes show on your desktop right away.', lblSize: 'Size', sizeStandard: 'Standard', sizeCompact: 'Minimal',
      lblPreview: 'Preview', prevPlayer: 'Player', prevPlaylists: 'Playlists', selected: 'Selected',
      behLead: 'How the panel behaves on your desktop.', onTop: 'Always on top', onTopSub: 'The panel never hides behind other windows.',
      autostart: 'Launch with Windows', autostartSub: 'The widget starts together with the system.', autostartOnlyInst: 'Only available in the installed version.',
      language: 'Language', languageSub: 'Language of the widget, settings and tray menu.',
      sysLead: 'Version, updates and account.', version: 'Version {v}', versionSub: 'Check if a newer version is available.', checkUpd: 'Check for updates',
      installRestart: 'Install and restart', updOnlyInstalledSub: 'Updates only work in the installed version.', updReadySub: 'A new version is downloaded and ready to install.',
      checking: 'Checking…', autoUpdate: 'Update automatically on start', autoUpdateSub: 'On launch it downloads a new version, installs it and restarts the widget.',
      account: 'Spotify account', checkingAcc: 'Checking…', signOut: 'Sign out', accIn: 'Signed in. Signing out clears the saved access to your account.',
      accOut: 'Not signed in.', accDone: 'Signed out.',
      pomoLead: 'A Pomodoro timer with its own layout. Turn it on and a clock icon appears in the widget to switch between music and the timer.',
      pomoEnable: 'Enable Pomodoro', pomoEnableSub: 'The timer keeps running in the background even when the widget is hidden.',
      hTimes: 'Times', own: 'Custom', tip2505: '25 min work, 5 min break, 15 min long break', tip4515: '45 min work, 15 min break, 30 min long break',
      tip5010: '50 min work, 10 min break, 20 min long break', tip9020: '90 min deep work, 20 min break, 30 min long break',
      focus: 'Focus', focusSub: 'Work time in minutes.', shortBreak: 'Short break', shortSub: 'Minutes.', longBreak: 'Long break', longSub: 'Minutes, after the last session of a cycle.',
      sessionsT: 'Sessions until a long break', sessionsSub: 'How many work blocks in one cycle.',
      hFlow: 'Flow', autoStart: 'Start the next block automatically', autoStartSub: 'Off: after each block the timer waits for you to start it.',
      soundT: 'Sound at the start of a block', soundSub: 'A short chime when work or a break begins.', soundWork: 'Work', soundBreak: 'Break',
      hMusic: 'Music', musicT: 'Music during Focus', musicSub: 'Music is paused during breaks. Requires signing in to Spotify.',
      playlistT: 'Playlist', musicDefaultNote: "By default Spotify's official focus playlist plays.", musicDefaultOpt: 'Default: official Spotify focus playlist',
      musicNeedLogin: 'Sign in to Spotify to choose', musicNeedLoginNote: 'Requires signing in to Spotify.', musicGroupSugg: 'Calm music for work (Spotify suggestions)',
      musicGroupMine: 'My playlists', musicChosen: 'Selected playlist', musicSelected: 'Selected: {n}', musicNoneChosen: "When you pick nothing, Spotify's official focus playlist plays.",
    },
    pl: {
      tokenError: 'Błąd tokena', loginTimeout: 'Upłynął czas logowania', loginClose: 'Możesz zamknąć tę kartę.',
      loginFailed: 'Logowanie nie powiodło się', loginError: 'Błąd logowania', loginOk: 'Zalogowano w Spotify Widget ✔', portBusy: 'Port 8888 zajęty: ',
      notTester: 'Twojego konta nie ma na liście testerów aplikacji. Poproś autora o dodanie Twojego e-maila w panelu Spotify.',
      rateLimit: 'Spotify chwilowo ogranicza zapytania. Spróbuj za chwilę.', noNet: 'Brak połączenia z internetem', errN: 'Błąd {n}',
      notTrack: 'To nie jest utwór', notPlaylist: 'To nie jest playlista', noDevice: 'Brak urządzenia. Uruchom Spotify na komputerze.',
      restricted: 'Spotify nie udostępnia utworów tej playlisty (tylko własne lub współdzielone). Możesz ją odtworzyć w całości.',
      updOnlyInstalled: 'Aktualizacje działają tylko w zainstalowanej wersji.', updCheckFail: 'Nie udało się sprawdzić aktualizacji',
      updDownloading: 'Pobieram aktualizację {v}…', updLatest: 'Masz najnowszą wersję ({v})',
      updInstalling: 'Aktualizacja {v}: instaluję i restartuję…', updReady: 'Aktualizacja {v} gotowa. Zainstaluje się po zamknięciu.',
      trayToggle: 'Pokaż / ukryj panel', traySettings: 'Wygląd i ustawienia…', trayOnTop: 'Zawsze na wierzchu', trayAutostart: 'Uruchamiaj z Windowsem',
      trayVersion: 'Wersja {v}', trayAutoUpd: 'Aktualizuj automatycznie przy starcie', trayInstall: 'Zainstaluj aktualizację i zrestartuj',
      trayCheck: 'Sprawdź aktualizacje', trayLogout: 'Wyloguj ze Spotify', trayQuit: 'Zamknij', settingsTitle: 'Spotify Widget – Ustawienia',
      nothingPlaying: 'Nic nie gra', idleArtist: 'Włącz coś albo wybierz playlistę', copied: 'Skopiowano ✔',
      enterClientId: 'Podaj Client ID', waitingBrowser: 'Czekam na logowanie w przeglądarce…', signInFailed: 'Nie udało się zalogować',
      deviceLbl: 'Urządzenie: {d}', backToPlayer: 'Wróć do playera', playlistsT: 'Playlisty', noConn: 'Brak połączenia', unknownErr: 'nieznany błąd',
      openedInSpotify: 'Otwarto w aplikacji Spotify', nameHint: 'Klik: odtwórz  ·  ikona ≡ lub prawy klik: utwory', noPlaylists: 'Brak playlist',
      showTracks: 'Pokaż utwory', plFail: 'Nie udało się pobrać playlist ({e}). Kliknij, aby ponowić', needPlScope: 'Brak uprawnień do playlist. Wyloguj i zaloguj ponownie.',
      tracksFail: 'Nie udało się pobrać utworów', loading: 'Ładowanie…', noTracks: 'Brak utworów', likedSongs: 'Polubione utwory',
      heartOnlyTracks: 'Polubienia działają tylko dla utworów', heartRemove: 'Usuń z polubionych', heartAdd: 'Dodaj do polubionych',
      consent: 'Spotify prosi o dodatkową zgodę (polubione). Otwieram przeglądarkę…', consentFail: 'Nie udało się nadać zgody',
      likeFail: 'Nie udało się zmienić polubienia', likedAdded: 'Dodano do polubionych', likedRemoved: 'Usunięto z polubionych',
      pomoLong: 'Długa przerwa', pomoShort: 'Przerwa · ', pomoSession: 'Sesja ', exTrack: 'Przykładowy utwór', exArtist: 'Wykonawca, Gość', exPlaylist: 'Playlista {n}',
      gripTip: 'Przytrzymaj i przeciągnij, żeby przesunąć', hide: 'Ukryj', hideTray: 'Ukryj do zasobnika', loginHint: 'Wklej <b>Client ID</b> z <a href="#" id="devlink">developer.spotify.com</a> i dodaj tam Redirect URI:',
      clickCopy: 'Kliknij, żeby skopiować', signIn: 'Zaloguj', searchPh: 'Szukaj lub wklej link…', pomodoro: 'Pomodoro', settingsTip: 'Wygląd i ustawienia',
      shuffle: 'Losowo', prev: 'Poprzedni', playPause: 'Odtwórz / pauza', next: 'Następny', volume: 'Głośność', hoverCover: 'Najedź na okładkę, aby zobaczyć nazwę',
      backToMusic: 'Wróć do muzyki', modeFocus: 'Focus', modeShortLong: 'Krótka przerwa', modeShort: 'Krótka', modeLongLong: 'Długa przerwa', modeLong: 'Długa',
      restartBlock: 'Zacznij blok od nowa', startPause: 'Start / pauza', skipBlock: 'Pomiń do następnego bloku',
      settings: 'Ustawienia', tabStyle: 'Style', tabBehavior: 'Zachowanie', tabSystem: 'System', tabPomodoro: 'Pomodoro', savedInstantly: 'Zmiany zapisują się od razu',
      pgAppearance: 'Wygląd', pgBehavior: 'Zachowanie', pgSystem: 'System', pgPomodoro: 'Pomodoro',
      styleLead: 'Wybierz preset i rozmiar panelu. Zmiany widać od razu na pulpicie.', lblSize: 'Rozmiar', sizeStandard: 'Standardowy', sizeCompact: 'Minimalistyczny',
      lblPreview: 'Podgląd', prevPlayer: 'Odtwarzacz', prevPlaylists: 'Playlisty', selected: 'Wybrany',
      behLead: 'Jak panel zachowuje się na pulpicie.', onTop: 'Zawsze na wierzchu', onTopSub: 'Panel nie chowa się za innymi oknami.',
      autostart: 'Uruchamiaj z Windowsem', autostartSub: 'Widget startuje razem z systemem.', autostartOnlyInst: 'Dostępne tylko w zainstalowanej wersji.',
      language: 'Język', languageSub: 'Język widgetu, ustawień i menu w zasobniku.',
      sysLead: 'Wersja, aktualizacje i konto.', version: 'Wersja {v}', versionSub: 'Sprawdź, czy jest nowsza wersja.', checkUpd: 'Sprawdź aktualizacje',
      installRestart: 'Zainstaluj i zrestartuj', updOnlyInstalledSub: 'Aktualizacje działają tylko w zainstalowanej wersji.', updReadySub: 'Nowa wersja jest pobrana i gotowa do instalacji.',
      checking: 'Sprawdzam…', autoUpdate: 'Aktualizuj automatycznie przy starcie', autoUpdateSub: 'Przy uruchomieniu pobiera nową wersję, instaluje ją i restartuje widget.',
      account: 'Konto Spotify', checkingAcc: 'Sprawdzam…', signOut: 'Wyloguj', accIn: 'Zalogowano. Wylogowanie wyczyści zapisany dostęp do konta.',
      accOut: 'Niezalogowano.', accDone: 'Wylogowano.',
      pomoLead: 'Timer Pomodoro z własnym układem. Włącz go, a w widgecie pojawi się ikona zegara, która przełącza muzykę i timer.',
      pomoEnable: 'Włącz Pomodoro', pomoEnableSub: 'Timer działa w tle także wtedy, gdy widget jest ukryty.',
      hTimes: 'Czasy', own: 'Własne', tip2505: '25 min praca, 5 min przerwa, 15 min długa', tip4515: '45 min praca, 15 min przerwa, 30 min długa',
      tip5010: '50 min praca, 10 min przerwa, 20 min długa', tip9020: '90 min praca (głęboka), 20 min przerwa, 30 min długa',
      focus: 'Focus', focusSub: 'Czas pracy w minutach.', shortBreak: 'Krótka przerwa', shortSub: 'Minuty.', longBreak: 'Długa przerwa', longSub: 'Minuty, po ostatniej sesji cyklu.',
      sessionsT: 'Sesje do długiej przerwy', sessionsSub: 'Ile bloków pracy w jednym cyklu.',
      hFlow: 'Przebieg', autoStart: 'Automatyczny start kolejnego bloku', autoStartSub: 'Wyłączone: po każdym bloku timer czeka na Twój start.',
      soundT: 'Dźwięk na początku bloku', soundSub: 'Krótki sygnał, gdy zaczyna się praca albo przerwa.', soundWork: 'Praca', soundBreak: 'Przerwa',
      hMusic: 'Muzyka', musicT: 'Muzyka podczas Focus', musicSub: 'Na przerwie muzyka jest pauzowana. Wymaga zalogowania do Spotify.',
      playlistT: 'Playlista', musicDefaultNote: 'Domyślnie gra oficjalna playlista Spotify do pracy.', musicDefaultOpt: 'Domyślnie: oficjalna playlista Spotify do pracy',
      musicNeedLogin: 'Zaloguj się do Spotify, aby wybrać', musicNeedLoginNote: 'Wymaga zalogowania do Spotify.', musicGroupSugg: 'Spokojna muzyka do pracy (propozycje Spotify)',
      musicGroupMine: 'Moje playlisty', musicChosen: 'Wybrana playlista', musicSelected: 'Wybrana: {n}', musicNoneChosen: 'Gdy nic nie wybierzesz, gra oficjalna playlista Spotify do pracy.',
    },
  };
  let lang = 'en';
  const api = {
    langs: ['en', 'pl'],
    setLang(l) { lang = D[l] ? l : 'en'; },
    getLang() { return lang; },
    t(k, v) {
      let s = (D[lang] && D[lang][k]) || D.en[k] || k;
      if (v) s = s.replace(/\{(\w+)\}/g, (m, n) => (v[n] != null ? v[n] : m));
      return s;
    },
    // Wypełnia elementy z data-i18n (tekst), data-i18n-html, data-i18n-title, data-i18n-ph (placeholder)
    apply(root) {
      root = root || document;
      root.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = api.t(e.dataset.i18n); });
      root.querySelectorAll('[data-i18n-html]').forEach((e) => { e.innerHTML = api.t(e.dataset.i18nHtml); });
      root.querySelectorAll('[data-i18n-title]').forEach((e) => { e.title = api.t(e.dataset.i18nTitle); });
      root.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.placeholder = api.t(e.dataset.i18nPh); });
      if (document.documentElement) document.documentElement.lang = lang;
    },
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.I18N = api;
})();
