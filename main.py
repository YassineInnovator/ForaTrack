from typing import List
from uuid import UUID
import uuid
import csv
import io
import os
from datetime import datetime
import logging  

from fastapi import Depends, FastAPI, HTTPException, Request, status, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware

# ---> AJOUTE CES 3 LIGNES ICI <---
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import jwt

# ---> IMPORT POUR LE PDF <---
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import auth
import models
import crud
import schemas
from database import SessionLocal, engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
  title="API ForaTrack",
  description="Système de gestion et de suivi des données géologiques de forages",
  version="1.0.2"
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler) 

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"], 
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

def custom_openapi():
  return get_openapi(
    title=app.title,
    version=app.version,
    description=app.description,
    routes=app.routes,
    )
app.openapi = custom_openapi

@app.middleware("http")
async def add_swagger_no_cache_headers(request: Request, call_next):
  response = await call_next(request)
  if request.url.path in {"/docs", "/redoc", "/openapi.json"}:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
  return response

def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()
    
models.Base.metadata.create_all(bind=engine)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login/")

# ==========================================
# AUTHENTIFICATION & SÉCURITÉ
# ==========================================
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
  credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expiré", headers={"WWW-Authenticate": "Bearer"},
  )
  try:
    payload = jwt.decode(token, str(auth.SECRET_KEY), algorithms=[auth.ALGORITHM])
    email = payload.get("sub")
    if email is None: raise credentials_exception
  except jwt.PyJWTError:
    raise credentials_exception
  
  utilisateur = crud.get_utilisateur_by_email(db, email=email)
  if utilisateur is None: raise credentials_exception
  return utilisateur
  
def get_admin_user(current_user: models.Utilisateur = Depends(get_current_user)):
    role_actuel = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    role_attendu = models.RoleUtilisateur.ADMIN.value
    if role_actuel.strip() != role_attendu.strip():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    return current_user
  
def get_terrain_utilisateur(current_user: models.Utilisateur = Depends(get_current_user)):
  role_actuel = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
  roles_autorises = [models.RoleUtilisateur.TERRAIN.value, models.RoleUtilisateur.ADMIN.value]
  if role_actuel.strip() not in [r.strip() for r in roles_autorises]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Réservé aux équipes terrain.")
  return current_user

@app.get("/", tags=["Racine"])
def racine():
    return {"status": "running", "message": "API ForaTrack opérationnelle."}

@app.get("/ping")
def tester_connexion():
    return {"status": "Succès", "message": "Le Backend FastAPI te dit bonjour ! 👋"}

@app.post("/login/", tags=["Authentification"])
@limiter.limit("5/minute")
def connexion(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    utilisateur = crud.get_utilisateur_by_email(db, email=form_data.username)
    if not utilisateur or not crud.pwd_context.verify(form_data.password, str(utilisateur.mot_de_passe_h)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects")
    access_token = auth.create_access_token(data={"sub": utilisateur.email})
    crud.enregistrer_action(db=db, utilisateur_id=utilisateur.id, action="Connexion réussie")
    return {"access_token": access_token, "token_type": "bearer"}

# ==========================================
# UTILISATEURS
# ==========================================
@app.post("/utilisateurs/", response_model=schemas.UtilisateurResponse, status_code=status.HTTP_201_CREATED, tags=["Utilisateurs"])
def inscrire_utilisateur(utilisateur: schemas.UtilisateurCreate, db: Session = Depends(get_db), admin_user: models.Utilisateur = Depends(get_admin_user)):
  if crud.get_utilisateur_by_email(db, email=utilisateur.email):
    raise HTTPException(status_code=400, detail="Email déjà enregistré.")
  return crud.create_utilisateur(db=db, utilisateur=utilisateur)

@app.get("/utilisateurs/", response_model=List[schemas.UtilisateurResponse], tags=["Utilisateurs"])
def lister_utilisateurs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), admin_user: models.Utilisateur = Depends(get_admin_user)):
  return crud.get_utilisateurs(db, skip=skip, limit=limit)

@app.patch("/utilisateurs/{utilisateur_id}", response_model=schemas.UtilisateurBase, tags=["Utilisateurs"])
def modifier_utilisateur(utilisateur_id: UUID, utilisateur_update: schemas.UtilisateurUpdate, db: Session = Depends(get_db), admin_user: models.Utilisateur = Depends(get_admin_user)):
  u = crud.update_utilisateur(db, utilisateur_id, utilisateur_update)
  if not u: raise HTTPException(status_code=404, detail="Utilisateur introuvable")
  return u

@app.delete("/utilisateurs/{utilisateur_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Utilisateurs"])
def supprimer_utilisateur(utilisateur_id: UUID, db: Session = Depends(get_db), admin_user: models.Utilisateur = Depends(get_admin_user)):
  if not crud.delete_utilisateur(db, utilisateur_id): raise HTTPException(status_code=404, detail="Introuvable")
  return None 

# ==========================================
# CHANTIERS & GALERIES
# ==========================================
@app.post("/chantiers/", response_model=schemas.ChantierResponse, status_code=status.HTTP_201_CREATED, tags=["Chantiers"])
def creer_un_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    return crud.create_chantier(db=db, chantier=chantier, utilisateur_id=user.id)
    
@app.get("/chantiers/", response_model=List[schemas.ChantierResponse], tags=["Chantiers"])
def lister_les_chantiers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    return crud.get_chantiers(db, skip=skip, limit=limit)

@app.post("/galeries/", response_model=schemas.GalerieResponse, tags=["Galeries"])
def creer_galerie(galerie: schemas.GalerieCreate, db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
  if not crud.get_chantier(db, galerie.chantier_id): raise HTTPException(status_code=404, detail="Chantier non trouvé")
  return crud.create_galerie(db=db, galerie=galerie, utilisateur_id=user.id)

@app.get("/chantiers/{chantier_id}/galeries", response_model=List[schemas.GalerieResponse], tags=["Galeries"])
def lister_galeries_chantier(chantier_id: UUID ,db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
  return crud.get_galeries_by_chantier(db=db, chantier_id=chantier_id)
  
# ==========================================
# FORAGES (Basique)
# ==========================================
@app.post("/forages/", response_model=schemas.ForageResponse, status_code=status.HTTP_201_CREATED, tags=["Forages"])
def creer_un_forage(forage: schemas.ForageCreate, db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    if forage.galerie_id and not crud.get_galerie(db=db, galerie_id=forage.galerie_id):
        raise HTTPException(status_code=404, detail="Galerie introuvable.")
    return crud.create_forage(db=db, forage=forage, utilisateur_id=user.id)
  
@app.get("/forages/{forage_id}", response_model=schemas.ForageCompletResponse, tags=["Forages"])
def obtenir_details_forage(forage_id: UUID, db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    db_forage = crud.get_forage(db, forage_id=forage_id)
    if not db_forage: raise HTTPException(status_code=404, detail="Forage introuvable.")
    return db_forage
  
@app.get("/rechercher/forages/", response_model=List[schemas.ForageResponse], tags=["Forages"])
def chercher_forage(terme_recherche: str, db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    return crud.get_forage_by_name(db=db, utilisateur=user, terme_recherche=terme_recherche)
    
@app.get("/afficher/forages/", response_model=List[schemas.ForageResponse], tags=["Forages"])
def lister_tous_les_forages(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    return crud.get_forages(db=db, utilisateur=user, skip=skip, limit=limit)

@app.patch("/modifier/forages/{forage_id}", response_model=schemas.ForageBase, tags=["Forages"])
def modifier_forage(forage_id: UUID, forage_update: schemas.ForageUpdate, db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
  db_forage = crud.update_forage(db=db, forage_update=forage_update, forage_id=forage_id, utilisateur_id=user.id)
  if not db_forage: raise HTTPException(status_code=404, detail="Forage introuvable")
  return db_forage

@app.delete("/supprimer/forages/{forage_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Forages"])
def supprimer_forage(forage_id: UUID, db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
  if not crud.delete_forage(db=db, forage_id=forage_id, utilisateur_id=user.id):
      raise HTTPException(status_code=404, detail="Forage introuvable")

# ==========================================
# WIZARD ET SAISIES TRANSACTIONNELLES
# ==========================================
@app.post("/releve-terrain/", tags=["Saisie Terrain"])
def enregistrer_saisie_terrain(payload: schemas.ReleveTerrainPayload, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    try:
        nouveau_forage = crud.sauvegarder_releve_terrain(db=db, payload=payload, utilisateur_id=terrain_user.id)
        # ⚠️ LA CORRECTION EST ICI : on utilise nouveau_forage.forage et plus nouveau_forage.id
        return {"status": "success", "message": f"Relevé sauvegardé avec succès", "forage_id": nouveau_forage.forage}
    except Exception as e:
        logger.error(f"Erreur transactionnelle : {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Erreur lors de la sauvegarde : {str(e)}")

@app.post("/echantillons/", tags=["Saisie Échantillons"])
def enregistrer_fiche_echantillons(payload: schemas.SaisieEchantillonPayload, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    try:
        forage = crud.sauvegarder_echantillons(db=db, payload=payload, utilisateur_id=terrain_user.id)
        return {"status": "success", "message": f"Échantillons sauvegardés pour le forage {forage.forage}"}
    except Exception as e:
        logger.error(f"Erreur sauvegarde échantillons : {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Erreur lors de la sauvegarde : {str(e)}")

# ==========================================
# RAPPORTS
# ==========================================
@app.get("/rapports/", response_model=List[schemas.RapportPDF], tags=["Rapports"])
def lister_rapports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_rapports(db=db, skip=skip, limit=limit)

@app.get("/rapports/{rapport_id}", response_model=schemas.RapportPDF, tags=["Rapports"])
def obtenir_rapport(rapport_id: UUID, db: Session = Depends(get_db)):
    rapport = crud.get_rapport(db=db, rapport_id=rapport_id)
    if not rapport: raise HTTPException(status_code=404, detail="Rapport non trouvé")
    return rapport

# ---> AJOUTE LA NOUVELLE ROUTE QUI CRÉE LE FICHIER <---
@app.post("/generer-rapport/", tags=["Rapports"])
def generer_et_telecharger_rapport(req: schemas.RapportGenerateRequest, db: Session = Depends(get_db)):
    if not req.forages:
        raise HTTPException(status_code=400, detail="Aucun forage sélectionné.")
        
    noms_reduits = "_".join(req.forages)[:30]
    nom_fichier = f"Rapport_Auscultation_{noms_reduits}.pdf"

    # 1. Vérification et création du dossier physique sur ton PC
    dossier = req.chemin_dossier if req.chemin_dossier else "."
    if not os.path.exists(dossier):
        try:
            os.makedirs(dossier)
        except Exception:
            dossier = "." # Si erreur, on sauvegarde dans le dossier courant
            
    chemin_complet = os.path.join(dossier, nom_fichier)

    # 2. Dessin du fichier PDF physique !
    c = canvas.Canvas(chemin_complet, pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, "Rapport d'Auscultation - GINGER CEBTP")
    
    c.setFont("Helvetica", 12)
    c.drawString(50, 710, f"Date de génération : {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    c.drawString(50, 680, f"Forages inclus dans ce rapport :")
    
    y = 650
    for nom in req.forages:
        db_forage = crud.get_forage(db, nom)
        if db_forage:
            texte = f"- {nom} (Type: {db_forage.type_forage or 'N/A'}, Orient.: {db_forage.orientation_strati or 'N/A'})"
        else:
            texte = f"- {nom} (Données introuvables)"
        c.drawString(70, y, texte)
        y -= 20
        
    c.save() # Le fichier est créé sur le disque dur !

    # 3. Sauvegarde dans la base de données
    nouveau_rapport = models.RapportPDF(
        forage=", ".join(req.forages),
        chemin_pdf=chemin_complet
    )
    db.add(nouveau_rapport)
    db.commit()

    # 4. On envoie le fichier directement au navigateur !
    return FileResponse(path=chemin_complet, filename=nom_fichier, media_type='application/pdf')

# ==========================================
# IMPORTATIONS CSV
# ==========================================
@app.post("/importer/oxydations/fichier-brut/", tags=["Importation"])
async def importer_fichier_brut_oxy(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contenu = await file.read()
    lecteur = csv.reader(io.StringIO(contenu.decode("utf-8")), delimiter=';')
    compteur, erreurs = 0, []

    def nettoyer_chiffre(val):
        if not val or str(val).strip() == "": return None
        try: return float(str(val).strip().replace('"', '').replace(',', '.'))
        except ValueError: return None

    for index, ligne in enumerate(lecteur, start=1):
        if not ligne: continue
        nom_brut = ligne[0].strip().replace('"', '') 
        if not nom_brut: continue
            
        corr = db.query(models.ForageMapping).filter(models.ForageMapping.forage_nom == nom_brut).first()
        if corr:
            nouvelle_ox = models.Oxydation(
                forage=nom_brut, forage_id=corr.forage_id,
                temps_apres_carottage_h=nettoyer_chiffre(ligne[1] if len(ligne)>1 else None),
                temps_apres_creusement_j=nettoyer_chiffre(ligne[2] if len(ligne)>2 else None),
                gypse=nettoyer_chiffre(ligne[3] if len(ligne)>3 else None),
                bioturbations_oxydees=nettoyer_chiffre(ligne[4] if len(ligne)>4 else None),
                patine_oxydation=nettoyer_chiffre(ligne[5] if len(ligne)>5 else None),
                oxydation_masse=nettoyer_chiffre(ligne[6] if len(ligne)>6 else None),
                gypse_sur_debris=nettoyer_chiffre(ligne[7] if len(ligne)>7 else None),
                bioturbations_sur_debris=nettoyer_chiffre(ligne[8] if len(ligne)>8 else None),
                patine_sur_debris=nettoyer_chiffre(ligne[9] if len(ligne)>9 else None)
            )
            db.add(nouvelle_ox)
            compteur += 1
        else:
            erreurs.append(f"Ligne {index}: Forage '{nom_brut}' introuvable.")
    db.commit()
    return {"status": "Importation terminée", "oxydations_inserees": compteur, "erreurs_mapping": erreurs}

@app.post("/importer/diagraphies/fichier-brut/", tags=["Importation"])
async def importer_fichier_diagrpahie(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contenu = await file.read()
    lecteur = csv.reader(io.StringIO(contenu.decode("utf-8")), delimiter=';')
    compteur, erreurs = 0, []

    def parse_date(d_str):
        try: return datetime.strptime(d_str.strip(), "%d/%m/%Y %H:%M:%S")
        except ValueError: return None
    def vers_bool(v): return str(v).strip() == "1"

    for index, ligne in enumerate(lecteur, start=1):
        if not ligne or len(ligne) < 11: continue
        nom_forage = ligne[1].replace('"', '')
        corr = db.query(models.ForageMapping).filter(models.ForageMapping.forage_nom == nom_forage).first()
                
        if corr:
            nouvelle_diag = models.Diagraphie(
                numero=ligne[0], forage_nom=nom_forage, forage_id=corr.forage_id,
                date_mesure=parse_date(ligne[2]),
                profondeur_max=float(ligne[3].replace('"', '')) if ligne[3].replace('"', '') else None,
                gamma_ray=vers_bool(ligne[4]), diametreur=vers_bool(ligne[5]),
                imagerie=vers_bool(ligne[6]), trajectometrie=vers_bool(ligne[7]),
                endoscope=vers_bool(ligne[8]), uv=vers_bool(ligne[9]), camera_axiale=vers_bool(ligne[10])
            )
            db.add(nouvelle_diag)
            compteur += 1
        else:
            erreurs.append(f"Ligne {index}: Forage '{nom_forage}' introuvable.")
    db.commit()
    return {"status": "Importation diagraphies terminée", "diagraphies_inserees": compteur, "erreurs": erreurs}
  
  
@app.post("/teneur-eau/", tags=["Saisie Teneur Eau"])
def enregistrer_fiche_teneur_eau(payload: schemas.SaisieTeneurEauPayload, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    try:
        forage = crud.sauvegarder_teneur_eau(db=db, payload=payload, utilisateur_id=terrain_user.id)
        return {"status": "success", "message": f"Fiche FT32 sauvegardée pour le forage {forage.forage}"}
    except Exception as e:
        logger.error(f"Erreur sauvegarde FT32 : {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Erreur lors de la sauvegarde : {str(e)}")