from database import engine
from models import Base
from sqlalchemy import text

def reset_database():
    print("⚠️ Démarrage de la réinitialisation TOTALE de la base de données...")

    with engine.connect() as conn:
        # 1. On coupe court aux erreurs de dépendance en rasant le schéma complet
        print("💥 Destruction radicale du schéma public (suppression en cascade)...")
        conn.execute(text("DROP SCHEMA public CASCADE;"))
        
        # 2. On recrée un schéma public tout neuf et vide
        print("✨ Recréation d'un schéma public vierge...")
        conn.execute(text("CREATE SCHEMA public;"))
        
        # 3. Autorisations par défaut pour la base
        conn.execute(text("GRANT ALL ON SCHEMA public TO postgres;"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
        
        # On valide ces grosses destructions
        conn.commit()

    # 4. On demande à SQLAlchemy de lire 'models.py' et de rebâtir les tables proprement
    print("🏗️ Création des nouvelles tables avec la bonne architecture...")
    Base.metadata.create_all(bind=engine)

    print("✅ Base de données réinitialisée avec succès !")
    print("🚀 Tu peux maintenant relancer FastAPI et créer ton premier compte utilisateur.")

if __name__ == "__main__":
    reset_database()