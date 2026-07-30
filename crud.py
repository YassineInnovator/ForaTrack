from sqlalchemy.orm import Session
from uuid import UUID
import models
import schemas
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

### UTILISATEUR ###
def get_utilisateur(db: Session, utilisateur_id: UUID):
    return db.query(models.Utilisateur).filter(models.Utilisateur.id == utilisateur_id).first()
  
def get_utilisateur_by_email(db: Session, email: str):
    return db.query(models.Utilisateur).filter(models.Utilisateur.email == email).first()

def get_utilisateurs(db: Session, skip: int = 0, limit: int = 20):
  return db.query(models.Utilisateur).offset(skip).limit(limit).all()

def create_utilisateur(db: Session, utilisateur: schemas.UtilisateurCreate):
  mot_de_passe_hache = pwd_context.hash(utilisateur.mot_de_passe)
  db_utilisateur = models.Utilisateur(
    nom=utilisateur.nom,
    prenom=utilisateur.prenom,
    email=utilisateur.email,
    role=utilisateur.role,
    mot_de_passe_h=mot_de_passe_hache
  )
  db.add(db_utilisateur)
  db.commit()
  db.refresh(db_utilisateur)
  return db_utilisateur 

def update_utilisateur(db: Session, utilisateur_id: UUID, utilisateur_update: schemas.UtilisateurUpdate):
  db_utilisateur = db.query(models.Utilisateur).filter(models.Utilisateur.id == utilisateur_id).first()
  if not db_utilisateur:
    return None
  update_data = utilisateur_update.model_dump(exclude_unset=True)
  if "mot_de_passe" in update_data:
      mot_de_passe_clair = update_data.pop("mot_de_passe")
      update_data["mot_de_passe_h"] = pwd_context.hash(mot_de_passe_clair)
  for key, value in update_data.items():
      setattr(db_utilisateur, key, value)
  db.commit()
  db.refresh(db_utilisateur)
  return db_utilisateur

def delete_utilisateur(db: Session, utilisateur_id: UUID) -> bool:
  db_utilisateur = db.query(models.Utilisateur).filter(models.Utilisateur.id == utilisateur_id).first()
  if not db_utilisateur:
      return False
  db.delete(db_utilisateur)
  db.commit()
  return True

### CHANTIER ###
def get_chantier(db: Session, chantier_id: UUID):
  return db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()

def get_chantiers(db: Session, skip: int = 0, limit: int = 100):
  return db.query(models.Chantier).offset(skip).limit(limit).all()

def create_chantier(db: Session, chantier: schemas.ChantierCreate, utilisateur_id: UUID):
  db_chantier = models.Chantier(nom_chantier=chantier.nom_chantier)
  db.add(db_chantier)
  db.commit()
  db.refresh(db_chantier)
  enregistrer_action(db, utilisateur_id, f"Création du chantier : {db_chantier.nom_chantier}")
  return db_chantier

### GALERIES ###
def get_galerie(db: Session, galerie_id: UUID):
  return db.query(models.Galeries).filter(models.Galeries.id == galerie_id).first()

def get_galeries_by_chantier(db: Session, chantier_id: UUID):
  return db.query(models.Galeries).filter(models.Galeries.chantier_id == chantier_id).all()

def create_galerie(db: Session, galerie: schemas.GalerieCreate, utilisateur_id: UUID):
  db_galerie = models.Galeries(**galerie.model_dump())
  db.add(db_galerie)
  db.commit()
  db.refresh(db_galerie)
  enregistrer_action(db, utilisateur_id, f"Création de la galerie : {db_galerie.nom_galerie}")
  return db_galerie

### FORAGE BASIQUE ###
def get_forage(db: Session, forage_id: str):
    # La clé primaire est maintenant le nom du forage
    return db.query(models.Forage).filter(models.Forage.forage == forage_id).first()

def get_forages(db: Session, utilisateur: models.Utilisateur, skip: int = 0, limit: int = 100):
    requete = db.query(models.Forage).filter(models.Forage.est_actif == True)
    return requete.offset(skip).limit(limit).all()
  
def get_forage_by_name(db: Session, utilisateur: models.Utilisateur, terme_recherche: str):
  return db.query(models.Forage).filter(models.Forage.forage.ilike(f"%{terme_recherche}%")).all()

def update_forage(db: Session, forage_id: str, forage_update: schemas.ForageUpdate, utilisateur_id: UUID):
  db_forage = get_forage(db=db, forage_id=forage_id)
  if not db_forage : 
    return None
  update_data = forage_update.model_dump(exclude_unset=True)
  for key, value in update_data.items():
    setattr(db_forage, key, value)
  db.commit()
  db.refresh(db_forage)
  return db_forage

def delete_forage(db: Session, forage_id: str, utilisateur_id: UUID) -> bool:
    db_forage = get_forage(db, forage_id)
    if not db_forage or not db_forage.est_actif: # type: ignore
        return False
    nom_forage_supprime = db_forage.forage
    db_forage.est_actif = False # type: ignore
    db.commit()
    enregistrer_action(db, utilisateur_id, f"🗑️ Suppression logique (archivage) du forage : {nom_forage_supprime}")
    return True

# ==========================================
# SAUVEGARDE TRANSACTIONNELLE TERRAIN (Fiches 1, 2, 3)
# ==========================================
def sauvegarder_releve_terrain(db: Session, payload: schemas.ReleveTerrainPayload, utilisateur_id: UUID):
    
    # 1. Gérer le Forage (Création ou Mise à jour)
    db_forage = db.query(models.Forage).filter(models.Forage.forage == payload.en_tete.nom_forage).first()
    
    if not db_forage:
        db_forage = models.Forage(
            forage=payload.en_tete.nom_forage,
            nom_fichier=payload.en_tete.nom_fichier,
            debut_foration=payload.en_tete.date_foration,
            debut_du_suivi=payload.en_tete.date_debut_suivi,
            fin_du_suivi=payload.en_tete.date_fin_suivi,
            type_forage=payload.en_tete.type_forage,
            orientation_bv=payload.en_tete.orientation_bv,
            azimuth_bv=payload.en_tete.azimuth_bv,
            orientation_strati=payload.en_tete.orientation_strati,
            calci=payload.en_tete.calci,
            teneur_eau=payload.en_tete.teneur_eau,
            cree_par=utilisateur_id
        )
        db.add(db_forage)
        db.flush() # flush() prépare l'insertion

    # 2. Insérer les Génératrices
    for gen in payload.generatrices:
        # On utilise forage=db_forage.forage (la chaîne de caractère)
        nouvelle_gen = models.Generatrice(**gen.model_dump(), forage=db_forage.forage)
        db.add(nouvelle_gen)

    # 3. Insérer les Structures
    for struct in payload.structures:
        # Le mapping Python <-> BD pour EDZReel
        struct_data = struct.model_dump()
        
        # Adaptation des noms de colonnes React -> Postgres
        edz_struct = models.EDZReel(
            forage=db_forage.forage,
            cote_fracture=struct_data.get('cote'),
            gen_num=struct_data.get('gen_num'),
            gen_orientee=struct_data.get('gen_orientee'),
            plumoses_fines=struct_data.get('plumoses_fines'),
            plumoses_gross=struct_data.get('plumoses_gross'),
            stries_fines=struct_data.get('stries_fines'),
            stries=struct_data.get('stries'),
            strie_patine=struct_data.get('strie_patine'),
            mixte=struct_data.get('mixte'),
            indeterminee=struct_data.get('indeterminee'),
            remarques=struct_data.get('remarques'),
            gypse_struct=struct_data.get('gypse'),
            bioturbations_struct=struct_data.get('bioturbations'),
            patine_struct=struct_data.get('patine'),
            direction=struct_data.get('mb_dir'),
            pendage=struct_data.get('mb_pen'),
            pitch=struct_data.get('mb_pitch'),
            jeu=struct_data.get('mb_jeu')
        )
        db.add(edz_struct)

    # 4. Valider la transaction complète
    db.commit()
    db.refresh(db_forage)
    
    enregistrer_action(db, utilisateur_id, f"A saisi un relevé terrain complet pour le forage {db_forage.forage}")
    return db_forage

# ==========================================
# SAUVEGARDE ÉCHANTILLONS (Fiche 4 - FT06b)
# ==========================================
def sauvegarder_echantillons(db: Session, payload: schemas.SaisieEchantillonPayload, utilisateur_id: UUID):
    
    db_forage = db.query(models.Forage).filter(models.Forage.forage == payload.forage_name).first()
    if not db_forage:
        db_forage = models.Forage(forage=payload.forage_name, cree_par=utilisateur_id)
        db.add(db_forage)
        db.flush()
        
    for ech in payload.echantillons:
        # On utilise forage=db_forage.forage (la chaîne de caractère)
        nouvel_ech = models.Echantillon(**ech.model_dump(), forage=db_forage.forage)
        db.add(nouvel_ech)
        
    db.commit()
    enregistrer_action(db, utilisateur_id, f"A enregistré {len(payload.echantillons)} échantillons pour le forage {db_forage.forage}")
    return db_forage

def enregistrer_action(db: Session, utilisateur_id: UUID, action: str):
  nouveau_log = models.LogAction(utilisateur_id=utilisateur_id, action=action)
  db.add(nouveau_log)
  db.commit()
  db.refresh(nouveau_log)
  return nouveau_log

# ==========================================
# RAPPORTS PDF
# ==========================================
def get_rapports(db: Session, skip: int = 0, limit: int = 100):
    # On récupère les rapports du plus récent au plus ancien
    return db.query(models.RapportPDF).order_by(models.RapportPDF.date_creation.desc()).offset(skip).limit(limit).all()

def get_rapport(db: Session, rapport_id: UUID):
    return db.query(models.RapportPDF).filter(models.RapportPDF.id == rapport_id).first()
  
  
#SAUVEGARDE TENEUR EN EAU (Fiche Excel FT32)
# ==========================================
def sauvegarder_teneur_eau(db: Session, payload: schemas.SaisieTeneurEauPayload, utilisateur_id: UUID):
    # Chercher si le forage existe, sinon le créer
    db_forage = db.query(models.Forage).filter(models.Forage.forage == payload.forage_name).first()
    if not db_forage:
        db_forage = models.Forage(forage=payload.forage_name, cree_par=utilisateur_id)
        db.add(db_forage)
        db.flush()

    # Fonction pour nettoyer les textes (virgules, tirets, vides) et les passer en décimal
    def clean_float(val):
        if val in (None, "", "-"): return None
        try: return float(str(val).replace(',', '.'))
        except ValueError: return None

    # Insérer toutes les lignes du tableau Excel
    for m in payload.mesures:
        nouvelle_mesure = models.TeneurEau(
            forage=db_forage.forage,
            identifiant=m.identifiant,
            cote_tete=clean_float(m.coteTete),
            cote_pied=clean_float(m.cotePied),
            humide_105=clean_float(m.humide105),
            humide_150=clean_float(m.humide150),
            sec_105=clean_float(m.sec105),
            sec_150=clean_float(m.sec150),
            hp_105=clean_float(m.hp105),
            hp_150=clean_float(m.hp150)
        )
        db.add(nouvelle_mesure)

    db.commit()
    enregistrer_action(db, utilisateur_id, f"A enregistré {len(payload.mesures)} mesures de teneur en eau (FT32) pour le forage {db_forage.forage}")
    return db_forage