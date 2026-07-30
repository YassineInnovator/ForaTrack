from sqlalchemy.orm import Session
from uuid import UUID
import models
import schemas
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_utilisateur_by_email(db: Session, email: str):
    return db.query(models.Utilisateur).filter(models.Utilisateur.email == email).first()

def get_utilisateurs(db: Session, skip: int = 0, limit: int = 20):
    return db.query(models.Utilisateur).offset(skip).limit(limit).all()

def create_utilisateur(db: Session, utilisateur: schemas.UtilisateurCreate):
    mot_de_passe_hache = pwd_context.hash(utilisateur.mot_de_passe)
    db_utilisateur = models.Utilisateur(
        nom=utilisateur.nom, prenom=utilisateur.prenom, email=utilisateur.email,
        role=utilisateur.role, mot_de_passe_h=mot_de_passe_hache
    )
    db.add(db_utilisateur)
    db.commit()
    db.refresh(db_utilisateur)
    return db_utilisateur 

def get_chantier(db: Session, chantier_id: UUID):
    return db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()

def get_chantiers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Chantier).offset(skip).limit(limit).all()

def create_chantier(db: Session, chantier: schemas.ChantierCreate, utilisateur_id: UUID):
    db_chantier = models.Chantier(nom_chantier=chantier.nom_chantier)
    db.add(db_chantier)
    db.commit()
    db.refresh(db_chantier)
    return db_chantier

def get_galerie(db: Session, galerie_id: UUID):
    return db.query(models.Galeries).filter(models.Galeries.id == galerie_id).first()

def get_galeries_by_chantier(db: Session, chantier_id: UUID):
    return db.query(models.Galeries).filter(models.Galeries.chantier_id == chantier_id).all()

def create_galerie(db: Session, galerie: schemas.GalerieCreate, utilisateur_id: UUID):
    db_galerie = models.Galeries(**galerie.model_dump())
    db.add(db_galerie)
    db.commit()
    db.refresh(db_galerie)
    return db_galerie

def get_forage(db: Session, forage_id: str):
    return db.query(models.Forage).filter(models.Forage.forage == forage_id).first()

def get_forages(db: Session, utilisateur: models.Utilisateur, skip: int = 0, limit: int = 100):
    return db.query(models.Forage).filter(models.Forage.est_actif == True).offset(skip).limit(limit).all()
  
def get_forage_by_name(db: Session, utilisateur: models.Utilisateur, terme_recherche: str):
    return db.query(models.Forage).filter(models.Forage.forage.ilike(f"%{terme_recherche}%")).all()

def update_forage(db: Session, forage_id: str, forage_update: schemas.ForageUpdate, utilisateur_id: UUID):
    db_forage = get_forage(db=db, forage_id=forage_id)
    if not db_forage: return None
    for key, value in forage_update.model_dump(exclude_unset=True).items():
        setattr(db_forage, key, value)
    db.commit()
    db.refresh(db_forage)
    return db_forage

def delete_forage(db: Session, forage_id: str, utilisateur_id: UUID) -> bool:
    db_forage = get_forage(db, forage_id)
    if not db_forage or not db_forage.est_actif: return False
    db_forage.est_actif = False 
    db.commit()
    enregistrer_action(db, utilisateur_id, f"Suppression logique du forage : {db_forage.forage}")
    return True

# ==========================================
# SAUVEGARDES METIER (Forage, Echantillons, Teneur Eau)
# ==========================================
def sauvegarder_releve_terrain(db: Session, payload: schemas.ReleveTerrainPayload, utilisateur_id: UUID):
    db_forage = db.query(models.Forage).filter(models.Forage.forage == payload.en_tete.nom_forage).first()
    if not db_forage:
        db_forage = models.Forage(
            forage=payload.en_tete.nom_forage, nom_fichier=payload.en_tete.nom_fichier,
            debut_foration=payload.en_tete.date_foration, debut_du_suivi=payload.en_tete.date_debut_suivi,
            fin_du_suivi=payload.en_tete.date_fin_suivi, type_forage=payload.en_tete.type_forage,
            orientation_bv=payload.en_tete.orientation_bv, azimuth_bv=payload.en_tete.azimuth_bv,
            orientation_strati=payload.en_tete.orientation_strati, calci=payload.en_tete.calci,
            teneur_eau=payload.en_tete.teneur_eau, cree_par=utilisateur_id
        )
        db.add(db_forage)
        db.flush()

    for gen in payload.generatrices:
        db.add(models.Generatrice(**gen.model_dump(), forage=db_forage.forage))

    for struct in payload.structures:
        s = struct.model_dump()
        db.add(models.EDZReel(
            forage=db_forage.forage, cote_fracture=s.get('cote'), gen_num=s.get('gen_num'),
            gen_orientee=s.get('gen_orientee'), plumoses_fines=s.get('plumoses_fines'),
            plumoses_gross=s.get('plumoses_gross'), stries_fines=s.get('stries_fines'),
            stries=s.get('stries'), strie_patine=s.get('strie_patine'), mixte=s.get('mixte'),
            indeterminee=s.get('indeterminee'), remarques=s.get('remarques'),
            gypse_struct=s.get('gypse'), bioturbations_struct=s.get('bioturbations'),
            patine_struct=s.get('patine'), direction=s.get('mb_dir'), pendage=s.get('mb_pen'),
            pitch=s.get('mb_pitch'), jeu=s.get('mb_jeu')
        ))
    db.commit()
    db.refresh(db_forage)
    enregistrer_action(db, utilisateur_id, f"Saisie terrain pour le forage {db_forage.forage}")
    return db_forage

def sauvegarder_echantillons(db: Session, payload: schemas.SaisieEchantillonPayload, utilisateur_id: UUID):
    db_forage = db.query(models.Forage).filter(models.Forage.forage == payload.forage_name).first()
    if not db_forage:
        db_forage = models.Forage(forage=payload.forage_name, cree_par=utilisateur_id)
        db.add(db_forage)
        db.flush()
    for ech in payload.echantillons:
        db.add(models.Echantillon(**ech.model_dump(), forage=db_forage.forage))
    db.commit()
    enregistrer_action(db, utilisateur_id, f"A enregistré {len(payload.echantillons)} échantillons")
    return db_forage

def sauvegarder_teneur_eau(db: Session, payload: schemas.SaisieTeneurEauPayload, utilisateur_id: UUID):
    db_forage = db.query(models.Forage).filter(models.Forage.forage == payload.forage_name).first()
    if not db_forage:
        db_forage = models.Forage(forage=payload.forage_name, cree_par=utilisateur_id)
        db.add(db_forage)
        db.flush()

    def clean_float(val):
        if val in (None, "", "-"): return None
        try: return float(str(val).replace(',', '.'))
        except ValueError: return None

    for m in payload.mesures:
        db.add(models.TeneurEau(
            forage=db_forage.forage, identifiant=m.identifiant, cote_tete=clean_float(m.coteTete),
            cote_pied=clean_float(m.cotePied), h105=clean_float(m.h105), h150=clean_float(m.h150),
            s105=clean_float(m.s105), s150=clean_float(m.s150), hp105=clean_float(m.hp105), hp150=clean_float(m.hp150)
        ))
    db.commit()
    enregistrer_action(db, utilisateur_id, f"A enregistré {len(payload.mesures)} mesures de teneur en eau")
    return db_forage

def get_rapports(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.RapportPDF).order_by(models.RapportPDF.date_creation.desc()).offset(skip).limit(limit).all()

def get_rapport(db: Session, rapport_id: UUID):
    return db.query(models.RapportPDF).filter(models.RapportPDF.id == rapport_id).first()

def enregistrer_action(db: Session, utilisateur_id: UUID, action: str):
    nouveau_log = models.LogAction(utilisateur_id=utilisateur_id, action=action)
    db.add(nouveau_log)
    db.commit()
    return nouveau_log