import React from 'react';

const ConditionsGenerales = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Conditions Générales de Vente</h1>
      <p className="text-muted-foreground mb-6">Dernière mise à jour : 19 décembre 2025</p>

      <section className="prose max-w-none">
        <h2>Préambule</h2>
        <p>
          Les présentes conditions régissent la vente de produits et services proposés sur le site RealTech.
        </p>

        <h2>Commandes</h2>
        <p>
          Les commandes sont validées après confirmation du paiement et envoi d'un e-mail de confirmation. Les délais de livraison sont indicatifs.
        </p>

        <h2>Paiement</h2>
        <p>
          Le paiement s'effectue via les moyens proposés sur le site. Les prix affichés sont en FCFA et toutes taxes comprises sauf indication contraire.
        </p>

        <h2>Rétractation</h2>
        <p>
          Conformément à la législation applicable, les règles de rétractation s'appliquent selon la nature des produits et services. Pour toute question, contactez-nous.
        </p>

        <h2>Responsabilité</h2>
        <p>
          RealTech ne saurait être tenu responsable des dommages indirects résultant de l'utilisation du site ou des produits.
        </p>
      </section>
    </div>
  );
};

export default ConditionsGenerales;
