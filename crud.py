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
  
def create_utilisateur(db: Session, utilisateur: schemas.UtilisateurCreate):
  mot_de_passe_hache = pwd_context.hash(utilisateur.mot_de_passe)
  
  db_utilisateur = models.Utilisateur(
    nom=utilisateur.nom,
    prenom=utilisateur.prenom,
    email=utilisateur.email,
    role=utilisateur.role,
    mot_de_passe_h=mot_de_passe_hache   # On l'insère dans la BDD
  )
  db.add(db_utilisateur)
  db.commit()
  db.refresh(db_utilisateur)
  return db_utilisateur

### CHANTIER ###

def get_chantier(db: Session, chantier_id: UUID):
  return db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()

def get_chantiers(db: Session, skip: int = 0, limit: int = 100):
  return db.query(models.Chantier).offset(skip).limit(limit).all()

def create_chantier(db: Session, chantier: schemas.ChantierCreate):
  db_chantier = models.Chantier(**chantier.model_dump())
  db.add(db_chantier)
  db.commit()
  db.refresh(db_chantier)
  return db_chantier


### GALERIES ###

def get_galerie(db: Session, galerie_id: UUID):
  return db.query(models.Galeries).filter(models.Galeries.id == galerie_id).first()

def get_galeries_by_chantier(db: Session, chantier_id: UUID):
  return db.query(models.Galeries).filter(models.Galeries.chantier_id == chantier_id).all()

def create_galerie(db: Session, galerie: schemas.GalerieCreate):
  db_galerie = models.Galeries(**galerie.model_dump())
  db.add(db_galerie)
  db.commit()
  db.refresh(db_galerie)
  return db_galerie


### FORAGE ###

def get_forage(db: Session, forage_id: UUID):
    return db.query(models.Forage).filter(models.Forage.id == forage_id).first()

def get_forages(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Forage).offset(skip).limit(limit).all()

def create_forage(db: Session, forage: schemas.ForageCreate):
    db_forage = models.Forage(**forage.model_dump())
    db.add(db_forage)
    db.commit()
    db.refresh(db_forage)
    return db_forage
  
  
### MEASURES & MEDIAS 

# --- Oxydation ---
def create_oxydation(db: Session, oxydation: schemas.OxydationCreate):
    db_oxydation = models.Oxydation(**oxydation.model_dump())
    db.add(db_oxydation)
    db.commit()
    db.refresh(db_oxydation)
    return db_oxydation

def get_oxydations_by_forage(db: Session, forage_id: UUID):
    return db.query(models.Oxydation).filter(models.Oxydation.forage_id == forage_id).all()
  

# --- Diagraphie ---
def create_diagraphie(db: Session, diagraphie: schemas.DiagraphieCreate):
    db_diagraphie = models.Diagraphie(**diagraphie.model_dump())
    db.add(db_diagraphie)
    db.commit()
    db.refresh(db_diagraphie)
    return db_diagraphie

def get_diagraphies_by_forage(db: Session, forage_id: UUID):
    return db.query(models.Diagraphie).filter(models.Diagraphie.forage_id == forage_id).all()
  


# --- Media ---
def create_media(db: Session, media: schemas.MediaCreate):
    db_media = models.Media(**media.model_dump())
    db.add(db_media)
    db.commit()
    db.refresh(db_media)
    return db_media

def get_medias_by_forage(db: Session, forage_id: UUID):
    return db.query(models.Media).filter(models.Media.forage_id == forage_id).all()