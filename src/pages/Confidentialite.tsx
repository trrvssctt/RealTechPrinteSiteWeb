import React from 'react';

const Confidentialite = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Politique de confidentialité</h1>
      <p className="text-muted-foreground mb-6">Dernière mise à jour : 19 décembre 2025</p>

      <section className="prose max-w-none">
        <h2>Collecte des données</h2>
        <p>
          Nous collectons uniquement les données nécessaires au fonctionnement du site et à la réalisation des commandes (nom, e-mail, téléphone, adresse de livraison, informations de commande).
        </p>

        <h2>Finalités</h2>
        <p>
          Les informations recueillies sont utilisées pour traiter les commandes, contacter les clients, fournir le support, et améliorer nos services.
        </p>

        <h2>Conservation</h2>
        <p>
          Les données sont conservées pendant la durée nécessaire au respect des obligations légales et à la gestion des relations clients.
        </p>

        <h2>Droits des personnes</h2>
        <p>
          Conformément à la réglementation applicable, vous disposez d'un droit d'accès, de rectification, de suppression et d'opposition. Pour exercer vos droits, contactez-nous à sidydiop.boss@realtechprint.com.
        </p>

        <h2>Cookies</h2>
        <p>
          Le site utilise des cookies techniques et analytiques. Vous pouvez gérer vos préférences via votre navigateur.
        </p>
      </section>
    </div>
  );
};

export default Confidentialite;
