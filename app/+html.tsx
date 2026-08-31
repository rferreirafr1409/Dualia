// app/+html.tsx
//
// Wrapper HTML racine pour la version web (Expo Router).
//
// GitHub Pages sert public/404.html pour toute page profonde, qui sauvegarde
// le chemin complet (pathname + search + hash) dans sessionStorage sous
// "chemin_avant_404", puis redirige vers /Dualia/. Le script ci-dessous,
// qui s'exécute ici avant tout code Expo Router, restaure ce chemin dans
// l'URL ET extrait immédiatement le access_token/refresh_token éventuel
// pour les stocker à part, sous une clé dédiée et stable
// ("dualia_reset_tokens"). Cette double sauvegarde est nécessaire car Expo
// Router nettoie parfois lui-même le hash de l'URL pendant son
// initialisation, après notre restauration mais avant le premier rendu de
// nos écrans — ce qui rendait le hash à nouveau invisible pour eux. En
// lisant sessionStorage plutôt que l'URL, reinitialiser-mot-de-passe.tsx
// n'est plus jamais exposé à cette course.

import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var chemin = sessionStorage.getItem('chemin_avant_404');
                  var hashADetecter = location.hash;

                  if (chemin) {
                    sessionStorage.removeItem('chemin_avant_404');
                    if (location.pathname === '/Dualia/' || location.pathname === '/Dualia') {
                      history.replaceState(null, '', chemin);
                      var indexHash = chemin.indexOf('#');
                      hashADetecter = indexHash >= 0 ? chemin.substring(indexHash) : '';
                    }
                  }

                  if (hashADetecter && hashADetecter.length > 1) {
                    var params = new URLSearchParams(hashADetecter.substring(1));
                    var access_token = params.get('access_token');
                    var refresh_token = params.get('refresh_token');
                    if (access_token && refresh_token) {
                      sessionStorage.setItem('dualia_reset_tokens', JSON.stringify({
                        access_token: access_token,
                        refresh_token: refresh_token,
                      }));
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}