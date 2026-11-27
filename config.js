// Connexion au serveur Supabase.
// La « clé publique » (anon) est faite pour être visible : la sécurité est assurée
// par les règles de la base (chaque joueur ne peut lire que ses propres données
// et ne peut rien modifier directement). Ne JAMAIS mettre la clé « service_role » ici.
window.CLUTCH_CONFIG = {
  url: '',   // ex. https://abcdefgh.supabase.co
  cle: ''    // clé « anon public »
};
