import React from 'react';

const MentionsLegales = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Mentions légales</h1>
      <p className="text-muted-foreground mb-6">Dernière mise à jour : 19 décembre 2025</p>

      <section className="prose max-w-none">
        <h2>Éditeur du site</h2>
        <p>
          Le site RealTech ("le Site") est édité par RealTech Holding.
          Siège social : Dakar, Sénégal.
        </p>

        <h2>Responsable de la publication</h2>
        <p>Sidy Diop — contact : sidydiop.boss@realtechprint.com</p>

        <h2>Hébergement</h2>
        <p>
          Le site est hébergé par le prestataire technique choisi par RealTech.
        </p>

        <h2>Propriété intellectuelle</h2>
        <p>
          L'ensemble du contenu présent sur ce site (textes, images, logos, éléments graphiques) est protégé par le droit d'auteur.
          Toute reproduction ou représentation totale ou partielle est interdite sans autorisation préalable.
        </p>

        <h2>Contact</h2>
        <p>Pour toute question juridique, veuillez contacter: sidydiop.boss@realtechprint.com</p>
      </section>
    </div>
  );
};

export default MentionsLegales;
