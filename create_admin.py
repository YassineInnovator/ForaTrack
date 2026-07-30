from database import SessionLocal
from models import Utilisateur, RoleUtilisateur
from crud import pwd_context

def creer_premier_admin():
    db = SessionLocal()
    
    # On vérifie si l'utilisateur existe déjà
    email_admin = "admin@groupeginger.com"
    existant = db.query(Utilisateur).filter(Utilisateur.email == email_admin).first()
    
    if existant:
        print("L'utilisateur existe déjà !")
        return

    # On crée l'utilisateur avec un mot de passe haché (sécurisé)
    mot_de_passe_clair = "Ginger@2026!"
    nouvel_admin = Utilisateur(
        nom="Sondier",
        prenom="Daniel",
        email=email_admin,
        role=RoleUtilisateur.ADMIN,
        mot_de_passe_h=pwd_context.hash(mot_de_passe_clair) # Le cryptage se fait ici !
    )
    
    db.add(nouvel_admin)
    db.commit()
    print(f"✅ Compte '{email_admin}' créé avec succès !")
    print(f"🔑 Mot de passe : {mot_de_passe_clair}")

if __name__ == "__main__":
    creer_premier_admin()