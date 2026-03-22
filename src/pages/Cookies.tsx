import React from 'react';

const Cookies = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Politique de cookies</h1>
      <p className="text-muted-foreground mb-6">Dernière mise à jour : 19 décembre 2025</p>

      <section className="prose max-w-none">
        <h2>Qu'est-ce qu'un cookie ?</h2>
        <p>
          Un cookie est un petit fichier texte placé sur votre terminal pour faciliter la navigation, mesurer l'audience ou mémoriser vos préférences.
        </p>

        <h2>Types de cookies utilisés</h2>
        <ul>
          <li>Cookies techniques nécessaires au fonctionnement du site</li>
          <li>Cookies analytiques pour améliorer l'expérience</li>
        </ul>

        <h2>Gérer les cookies</h2>
        <p>
          Vous pouvez configurer ou bloquer les cookies via les paramètres de votre navigateur. Le blocage peut affecter certaines fonctionnalités.
        </p>
      </section>
    </div>
  );
};

export default Cookies;
